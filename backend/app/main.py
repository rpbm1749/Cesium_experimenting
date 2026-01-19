from fastapi import FastAPI
from shapely.geometry import Polygon
import geopandas as gpd
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
import numpy as np

# Add final_aqi to sys.path so its internal imports work
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FINAL_AQI_PATH = os.path.join(BASE_DIR, "final_aqi")
if FINAL_AQI_PATH not in sys.path:
    sys.path.append(FINAL_AQI_PATH)

# Now import from final_aqi
try:
    # Since we added FINAL_AQI_PATH to sys.path, we can import its modules directly
    import main as aqi_main
    run_aqi_prediction = aqi_main.predict_aqi
except ImportError as e:
    print(f"Error importing from final_aqi: {e}")
    run_aqi_prediction = None

from app.schemas import BBoxRequest
from app.sources import (
    get_road_sources,
    get_industry_sources,
    get_building_sources,
    get_green_cover
)
from app.config import UTM_EPSG

app = FastAPI(title="Urban Analysis Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze")
def analyze_bbox(bbox: BBoxRequest):
    print("Running bro....")
    # 1️⃣ Convert bbox → polygon (WGS84)
    poly_wgs = Polygon([
        (bbox.minLon, bbox.minLat),
        (bbox.maxLon, bbox.minLat),
        (bbox.maxLon, bbox.maxLat),
        (bbox.minLon, bbox.maxLat),
        (bbox.minLon, bbox.minLat),
    ])

    # 2️⃣ Convert to UTM
    gdf = gpd.GeoDataFrame(
        geometry=[poly_wgs],
        crs="EPSG:4326"
    )
    poly_utm = gdf.to_crs(epsg=UTM_EPSG).geometry[0]

    # 3️⃣ Call your friend’s logic
    road_Q = {"pm2_5": 1.0, "co": 10.0}
    building_Q = {"pm2_5": 0.002, "co": 0.01}

    roads = get_road_sources(poly_utm, road_Q)
    industries = get_industry_sources(poly_utm)
    buildings = get_building_sources(poly_utm, building_Q)
    green = get_green_cover(poly_utm)

    # 4️⃣ Return JSON-friendly output
    return {
        "roads": len(roads),
        "industries": len(industries),
        "buildings": len(buildings),
        "green_area_m2": float(green.geometry.area.sum()) if not green.empty else 0
    }


@app.post("/predict")
def predict_aqi_endpoint(bbox: BBoxRequest):
    print(f"Predicting AQI for BBox: {bbox}")
    
    if run_aqi_prediction is None:
        return {"error": "AQI Simulation modules not loaded correctly"}

    # 1️⃣ Prepare polygon coords for final_aqi
    polygon_coords = [
        (bbox.minLon, bbox.minLat),
        (bbox.minLon, bbox.maxLat),
        (bbox.maxLon, bbox.maxLat),
        (bbox.maxLon, bbox.minLat),
        (bbox.minLon, bbox.minLat),
    ]

    # 2️⃣ Define scenarios (defaults)
    base_params = {"pop_growth": 0.0, "years": 0, "built": 0.4, "green": 0.2}
    future_params = {"pop_growth": -0.025, "years": 15, "built": 0.1, "green": 0.9}

    # 3️⃣ Run AQI Prediction
    try:
        results = run_aqi_prediction(polygon_coords, base_params, future_params)
        return {
            "success": True,
            "scenarios": results,
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
        return {"error": str(e)}
