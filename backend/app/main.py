from fastapi import FastAPI
from shapely.geometry import Polygon
import geopandas as gpd
from fastapi.middleware.cors import CORSMiddleware

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
