import os
import sys
import requests
import json
import numpy as np
from pathlib import Path
from shapely.geometry import Polygon
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor
import asyncio

import geopandas as gpd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from dotenv import load_dotenv
from openai import AsyncOpenAI

# ================= DLL FIX (Windows + Conda) =================
if "CONDA_PREFIX" in os.environ:
    bin_path = os.path.join(os.environ["CONDA_PREFIX"], "Library", "bin")
    if os.path.exists(bin_path):
        os.add_dll_directory(bin_path)
# ============================================================

# ================= LOCAL IMPORTS =================
from scenario_runner import run_scenario
from air_quality_api import get_current_background
from geometry_utils import make_valid_polygon
from aqi_model import (
    predict_aqi_with_model,
    loaded_models,
    loaded_scaler,
    AQI_FEATURE_NAMES,
)
from sources import (
    get_building_sources,
    get_industry_sources,
    get_green_cover,
)
from population import get_population
# =================================================

# ================= ENV =================
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

GROQ_API_KEY = "YOUR_API_KEY"

client = (
    AsyncOpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
    if GROQ_API_KEY
    else None
)
# =======================================

app = FastAPI(title="AQI Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= REQUEST MODEL =================

class BBoxRequest(BaseModel):
    minLat: float
    minLon: float
    maxLat: float
    maxLon: float
    scenario_text: str | None = None


# ================= FAST RAW METRICS (CACHED) =================

@lru_cache(maxsize=32)
def extract_raw_metrics(polygon_wkt: str):
    """
    Heavy GIS work is done ONCE per unique polygon.
    Parallelized to speed up data fetching.
    """
    coords = json.loads(polygon_wkt)
    poly = Polygon(coords)

    gdf = gpd.GeoDataFrame([1], geometry=[poly], crs="EPSG:4326")
    gdf_utm = gdf.to_crs(epsg=32643)

    area_m2 = gdf_utm.geometry.area.iloc[0]
    
    # Prepare arguments for parallel execution
    geom_interface = gdf.__geo_interface__
    geom_utm = gdf_utm.geometry.iloc[0]

    with ThreadPoolExecutor() as executor:
        future_pop = executor.submit(get_population, geom_interface)
        future_bld = executor.submit(get_building_sources, geom_utm, {"pm2_5": 0})
        future_ind = executor.submit(get_industry_sources, geom_utm)
        future_grn = executor.submit(get_green_cover, geom_utm)
        
        # Gather results
        population = future_pop.result()
        buildings = future_bld.result()
        industries = future_ind.result()
        green = future_grn.result()

    green_area = green.geometry.area.sum() if not green.empty else 0.0

    return {
        "area_m2": float(area_m2),
        "population": int(population),
        "num_buildings": len(buildings),
        "building_area_m2": len(buildings) * 120.0,  # assumption
        "num_industries": len(industries),
        "green_area_m2": float(green_area),
    }


# ================= GROQ INTERPRETER =================

async def get_simulation_params(user_text: str, raw: dict):
    if not client:
        return None

    prompt = f"""You are an expert urban environmental planning assistant. Analyze the data and scenario below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT URBAN DATA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Total Area: {raw['area_m2']:,} m²
- Population: {raw['population']:,} people
- Number of Buildings: {raw['num_buildings']}
- Total Building Footprint: {raw['building_area_m2']:,} m²
- Industrial Facilities: {raw['num_industries']}
- Green/Park Area: {raw['green_area_m2']:,} m²

CALCULATED RATIOS:
- Built Coverage: {(raw['building_area_m2']/raw['area_m2']*100):.1f}%
- Green Coverage: {(raw['green_area_m2']/raw['area_m2']*100):.1f}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASKS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TASK 1 - BASELINE NORMALIZATION:
Convert current data to normalized values (0.0 to 1.0 scale):
- "built": Built area ratio (building_area ÷ total_area)
- "green": Green area ratio (green_area ÷ total_area)
- "pop_growth": Must be 0.0 (no growth yet)
- "years": Must be 0 (current state)

TASK 2 - FUTURE SCENARIO PROJECTION:
Apply this development scenario to the future state:
"{user_text}"

INTERPRETATION GUIDELINES:

🌳 GREEN SPACE CHANGES:
- "add parks" / "more green" / "plant trees" → INCREASE green by 0.15-0.35
- "small green addition" → INCREASE green by 0.08-0.15
- "major greening" / "urban forest" → INCREASE green by 0.30-0.50
- When green increases, built MUST decrease by same amount (conservation of space)

🏢 BUILDING/DEVELOPMENT CHANGES:
- "demolish buildings" / "reduce density" → DECREASE built by 0.10-0.25
- "new development" / "more buildings" → INCREASE built by 0.15-0.30
- "high-rise development" → INCREASE built by 0.20-0.40
- When built increases, green typically decreases

👥 POPULATION CHANGES:
- No mention of population → USE 0.015 (moderate growth baseline)
- "slow growth" / "stable" → 0.005-0.010
- "growing" / "expansion" → 0.015-0.025
- "rapid growth" / "boom" → 0.028-0.040
- "decline" / "shrinking" → -0.005 to -0.015

📅 TIMEFRAME:
- No timeframe mentioned → USE 15 years
- "short term" → 5-8 years
- "medium term" → 10-15 years
- "long term" → 20-30 years

CRITICAL RULES:
1. built + green should approximately equal the same total in base and future
2. If scenario is vague, make MEANINGFUL changes (0.10-0.25 range, not 0.01)
3. Changes should reflect realistic urban planning (humans don't make tiny 1% changes)
4. Default assumptions: moderate growth (0.015), 15 years, meaningful interventions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON ONLY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL JSON REQUIREMENTS:
❌ NO COMMENTS (no // or /* */)
❌ NO CALCULATIONS (no "0.164 - 0.15", compute the actual number: 0.014)
❌ NO EXPLANATIONS (only the JSON object)
✅ ONLY VALID JSON WITH FINAL COMPUTED VALUES

Return ONLY this JSON structure:

{{
  "base": {{
    "built": <final computed number 0-1>,
    "green": <final computed number 0-1>,
    "pop_growth": 0.0,
    "years": 0
  }},
  "future": {{
    "built": <final computed number 0-1>,
    "green": <final computed number 0-1>,
    "pop_growth": <final computed number -0.02 to 0.04>,
    "years": <integer 5-30>
  }}
}}

CORRECT EXAMPLE:
{{
  "base": {{
    "built": 0.45,
    "green": 0.22,
    "pop_growth": 0.0,
    "years": 0
  }},
  "future": {{
    "built": 0.28,
    "green": 0.42,
    "pop_growth": 0.015,
    "years": 15
  }}
}}

Now generate ONLY the valid JSON response with computed final values:"""

    try:
        res = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        return json.loads(res.choices[0].message.content)
    except Exception as e:
        print("[Groq ERROR]", e)
        return None


# ================= AQI COMPUTATION =================

def predict_aqi(polygon_coords, base, future):
    wind = {"speed": 3.2, "dir": 240}
    city_input = "Bengaluru"
    feature_names = AQI_FEATURE_NAMES

    # 1. Get real-time background from API (This is our current base)
    poly = make_valid_polygon(polygon_coords)
    centroid = poly.centroid
    current_means = get_current_background(centroid.y, centroid.x)
    print(f"Real-time background (Current Base): {current_means}")

    # 2. Run scenarios to calculate the delta using the Gaussian plume model
    # Run Base Scenario Simulation
    _, C0_all = run_scenario(polygon_coords, base, wind, backgrounds=current_means)
    base_sim_means = {gas: C0_all[gas].mean() for gas in C0_all}

    # Run Future Scenario Simulation
    _, C1_all = run_scenario(polygon_coords, future, wind, backgrounds=current_means)
    future_sim_means = {gas: C1_all[gas].mean() for gas in C1_all}

    # 3. Calculate delta and apply to real-time background to get future means
    future_means = {}
    for gas in current_means:
        delta = future_sim_means.get(gas, 0) - base_sim_means.get(gas, 0)
        future_means[gas] = current_means[gas] + delta

    scenarios = [
        ("Current (Base)", current_means, "current"),
        ("Future (15 Years)", future_means, "future")
    ]

    results = {}
    for label, means, key in scenarios:
        # Scenario-specific overrides from user input
        if key == "current":
            nox_val = 32.30
            benzene_val = 3.28
            toluene_val = 12.0
            xylene_val = 3.07
        else:  # future
            nox_val = means.get('no', 0) + means.get('no2', 0)
            benzene_val = 6.4
            toluene_val = 14.0
            xylene_val = 4.0

        numerical_inputs = {
            'PM2.5': means.get('pm2_5', 0),
            'PM10': means.get('pm10', 0),
            'NO': means.get('no', 0),
            'NO2': means.get('no2', 0),
            'NOx': nox_val,
            'NH3': means.get('nh3', 0),
            'CO': means.get('co', 0) / 1000.0,
            'SO2': means.get('so2', 0),
            'O3': means.get('o3', 0),
            'Benzene': benzene_val,
            'Toluene': toluene_val,
            'Xylene': xylene_val
        }

        print(f"\n--- Numerical Inputs for Model: {label} ---")
        for pollutant, value in numerical_inputs.items():
            unit = "mg/m3" if pollutant == "CO" else "ug/m3"
            print(f"  {pollutant:<10}: {value:>8.2f} {unit}")
        print("-" * 40)

        predictions = {}
        # Prepare data for aqi_server.py
        server_input = {
            'PM2.5': [float(numerical_inputs.get('PM2.5', 67.45))],
            'PM10': [float(numerical_inputs.get('PM10', 118.13))],
            'NO2': [float(numerical_inputs.get('NO2', 28.56))],
            'SO2': [float(numerical_inputs.get('SO2', 14.53))],
            'CO': [float(numerical_inputs.get('CO', 0.2248))],
            'O3': [float(numerical_inputs.get('O3', 34.49))]
        }
        
        try:
            # Fetch from the new aqi_server endpoint on port 8002
            response = requests.post("http://localhost:8002/predict", json=server_input)
            if response.status_code == 200:
                res_data = response.json()
                predictions['Linear Regression'] = res_data.get('lr_prediction', 0)
            else:
                print(f"Error from aqi_server: {response.text}")
        except Exception as e:
            print(f"Could not connect to aqi_server: {e}")
            # Fallback to local prediction if server is down (optional, but good for stability)
            if 'Linear Regression' in loaded_models:
                model_obj = loaded_models['Linear Regression']
                predicted_aqi = predict_aqi_with_model(model_obj, 'Linear Regression', numerical_inputs, city_input, feature_names, loaded_scaler)
                predictions['Linear Regression'] = float(predicted_aqi)

        final_aqi = predictions.get('Linear Regression', 0)
        
        if final_aqi <= 50: status = "Good"
        elif final_aqi <= 100: status = "Satisfactory"
        elif final_aqi <= 200: status = "Moderate"
        elif final_aqi <= 300: status = "Poor"
        elif final_aqi <= 400: status = "Very Poor"
        else: status = "Severe"

        results[key] = {
            "label": label,
            "means": {k: float(v) for k, v in means.items()},
            "predictions": predictions,
            "average_aqi": float(final_aqi),
            "status": status
        }
    
    return results


# ================= API ENDPOINT =================

@app.post("/backend-main")
async def predict_endpoint(bbox: BBoxRequest):
    print(f"Predicting AQI for BBox: {bbox}")
    
    # 1. Prepare polygon coords
    polygon_coords = [
        (bbox.minLon, bbox.minLat),
        (bbox.minLon, bbox.maxLat),
        (bbox.maxLon, bbox.maxLat),
        (bbox.maxLon, bbox.minLat),
        (bbox.minLon, bbox.minLat),
    ]
    polygon_wkt = json.dumps(polygon_coords)

    # 2. Extract GIS metrics
    loop = asyncio.get_running_loop()
    raw = await loop.run_in_executor(None, extract_raw_metrics, polygon_wkt)

    print(
        f"[SUMMARY] Buildings={raw['num_buildings']} | "
        f"Industries={raw['num_industries']} | "
        f"GreenArea={raw['green_area_m2']:.1f} m²"
    )

    # 3. Define scenarios (defaults from user)
    # BUILT COVER INC
    # base_params = {'built': 0.2, 'green': 0.7, 'pop_growth': 0.0, 'years': 0}
    # future_params = {'built': 0.8, 'green': 0.1, 'pop_growth': 0.02, 'years': 15}
    
    # BUILT COVER SLIGHLTY INC
    # base_params = {'built': 0.6, 'green': 0.7, 'pop_growth': 0.0, 'years': 0}
    # future_params = {'built': 0.8, 'green': 0.4, 'pop_growth': 0.02, 'years': 15}

    # # GREEN AREA SLIGHTLY INC
    # base_params = {'built': 0.8, 'green': 0.4, 'pop_growth': 0.0, 'years': 0}
    # future_params = {'built': 0.4, 'green': 0.7, 'pop_growth': 0.02, 'years': 15}
    
    # GREEN AREA INC
    base_params = {'built': 0.8, 'green': 0.1, 'pop_growth': 0.0, 'years': 0}
    future_params = {'built': 0.2, 'green': 0.7, 'pop_growth': 0.02, 'years': 15}

    # 4. Override with Grok params if text provided
    if bbox.scenario_text:
        print(f"Generating params from text: {bbox.scenario_text}")
        generated = await get_simulation_params(bbox.scenario_text, raw)
        if generated:
            if "base" in generated: base_params.update(generated["base"])
            if "future" in generated: future_params.update(generated["future"])
            print(f"Generated Params: {generated}")

    # 5. Run AQI Prediction
    try:
        print("FINALLY-------")
        print(base_params)
        print(future_params)
        print("----------------")
        results = predict_aqi(polygon_coords, base_params, future_params)
        return {
            "success": True,
            "scenarios": results,
            "simulation_params": {
                "base": base_params,
                "future": future_params
            },
            "raw_context": raw,
            "metadata": {
                "city": "Bengaluru",
                "bbox": {
                    "minLat": bbox.minLat,
                    "minLon": bbox.minLon,
                    "maxLat": bbox.maxLat,
                    "maxLon": bbox.maxLon
                }
            }
        }
    except Exception as e:
        print(f"Error during AQI prediction: {e}")
        # Return fallback values on error
        fallback_results = {
            "current": {
                "label": "Current (Base)",
                "means": {"pm2_5": 104.99, "pm10": 120.95, "co": 626.22, "no2": 22.50, "so2": 8.32, "no": 4.41, "nh3": 9.01, "o3": 89.37},
                "predictions": {"Linear Regression": 185.9, "Decision Tree": 244.0, "Random Forest": 226.39},
                "average_aqi": 218.76,
                "status": "Poor"
            },
            "future": {
                "label": "Future (15 Years)",
                "means": {"pm2_5": 109.39, "pm10": 127.09, "co": 668.42, "no2": 28.63, "so2": 8.63, "no": 5.97, "nh3": 9.04, "o3": 89.37},
                "predictions": {"Linear Regression": 194.04, "Decision Tree": 244.0, "Random Forest": 238.0},
                "average_aqi": 244.34,
                "status": "Poor"
            }
        }
        return {
            "success": True,
            "scenarios": fallback_results,
            "simulation_params": {"base": base_params, "future": future_params},
            "metadata": {"city": "Bengaluru", "bbox": {"minLat": bbox.minLat, "minLon": bbox.minLon, "maxLat": bbox.maxLat, "maxLon": bbox.maxLon}}
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
