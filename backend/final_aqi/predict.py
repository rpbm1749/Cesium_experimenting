import os
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

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

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

WRONG EXAMPLES (DO NOT DO THIS):
❌ "built": 0.164 - 0.15  (compute it: 0.014)
❌ "green": 0.051 + 0.15  (compute it: 0.201)
❌ // This is a comment  (no comments allowed)

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
    results = {}

    for label, params in [("current", base), ("future", future)]:
        _, C = run_scenario(polygon_coords, params, wind)
        means = {g: C[g].mean() for g in C}

        inputs = {
            "PM2.5": means.get("pm2_5", 0),
            "PM10": means.get("pm10", 0),
            "NO": means.get("no", 0),
            "NO2": means.get("no2", 0),
            "NOx": means.get("no", 0) + means.get("no2", 0),
            "NH3": means.get("nh3", 0),
            "CO": means.get("co", 0) / 1000,
            "SO2": means.get("so2", 0),
            "O3": means.get("o3", 0),
            "Benzene": 6.32,
            "Toluene": 11.75,
            "Xylene": 1.0,
        }

        preds = {
            name: float(
                predict_aqi_with_model(
                    model,
                    name,
                    inputs,
                    "Bengaluru",
                    AQI_FEATURE_NAMES,
                    loaded_scaler,
                )
            )
            for name, model in loaded_models.items()
        }

        avg = float(np.mean(list(preds.values())))
        status = (
            "Good" if avg <= 50 else
            "Satisfactory" if avg <= 100 else
            "Moderate" if avg <= 200 else
            "Poor" if avg <= 300 else
            "Very Poor" if avg <= 400 else
            "Severe"
        )

        results[label] = {
            "label": label,
            "means": means,
            "predictions": preds,
            "average_aqi": avg,
            "status": status,
        }

    return results


# ================= API ENDPOINT =================

@app.post("/predict")
async def predict_endpoint(bbox: BBoxRequest):

    polygon_coords = [
        (bbox.minLon, bbox.minLat),
        (bbox.minLon, bbox.maxLat),
        (bbox.maxLon, bbox.maxLat),
        (bbox.maxLon, bbox.minLat),
        (bbox.minLon, bbox.minLat),
    ]

    polygon_wkt = json.dumps(polygon_coords)

    # Run GIS in thread pool to avoid blocking loop
    loop = asyncio.get_running_loop()
    raw = await loop.run_in_executor(None, extract_raw_metrics, polygon_wkt)

    print(
        f"[SUMMARY] Buildings={raw['num_buildings']} | "
        f"Industries={raw['num_industries']} | "
        f"GreenArea={raw['green_area_m2']:.1f} m²"
    )

    params = await get_simulation_params(bbox.scenario_text or "", raw)

    if not params:
        return {"success": False, "error": "Groq failed"}

    print(f"\n[GROQ OUTPUT] Base: {params['base']}")
    print(f"[GROQ OUTPUT] Future: {params['future']}\n")

    results = predict_aqi(
        polygon_coords,
        params["base"],
        params["future"],
    )

    return {
        "success": True,
        "scenarios": results,
        "simulation_params": params,
        "raw_context": raw,
        "metadata": {
            "city": "Bengaluru",
            "bbox": {
                "minLat": bbox.minLat,
                "maxLat": bbox.maxLat,
                "minLon": bbox.minLon,
                "maxLon": bbox.maxLon,
            },
        },
    }


# ================= RUN =================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
