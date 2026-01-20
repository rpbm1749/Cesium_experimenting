import geopandas as gpd
from geometry_utils import make_valid_polygon
from air_quality_api import get_current_background
from population import get_population
from vehicle_emissions import estimate_vehicle_emissions
from sources import get_road_sources, get_industry_sources
from receptors import build_receptors
from dispersion import run_dispersion, apply_urban_modifiers
from config import UTM_EPSG, UNIT_CONV
import json

def run_scenario(polygon_coords, scenario, wind, backgrounds=None):
    poly_wgs = make_valid_polygon(polygon_coords)

    gdf = gpd.GeoDataFrame(
        geometry=[poly_wgs],
        crs="EPSG:4326"
    ).to_crs(epsg=UTM_EPSG)

    poly_utm = gdf.geometry.iloc[0]
    centroid = poly_wgs.centroid

    geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [polygon_coords]
            },
            "properties": {}
        }]
    }

    # Get current background if not provided
    if backgrounds is None:
        backgrounds = get_current_background(centroid.y, centroid.x)

    pop = get_population(geojson)
    pop *= (1 + scenario["pop_growth"]) ** scenario["years"]

    Qs_vehicle = estimate_vehicle_emissions(pop)

    vehicle_sources = get_road_sources(poly_utm, Qs_vehicle)
    industry_sources = get_industry_sources(poly_utm)

    print(f"  [Info] Road point sources found: {len(vehicle_sources)}")
    print(f"  [Info] Industrial sources found: {len(industry_sources)}")

    sources = vehicle_sources + industry_sources
    receptors = build_receptors(poly_utm)

    C_disp = run_dispersion(sources, receptors, wind, built_frac=scenario["built"])
    C_disp = apply_urban_modifiers(C_disp, scenario["built"], scenario["green"])

    # Final concentrations
    C_final = {}
    for gas in C_disp:
        C_final[gas] = (C_disp[gas] * UNIT_CONV) + backgrounds.get(gas, 0)

    return receptors, C_final
