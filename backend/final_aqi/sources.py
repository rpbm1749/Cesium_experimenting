import geopandas as gpd
import os
from shapely.geometry import Polygon
from config import UTM_EPSG, POINT_SPACING, INDUSTRY_Q

# Get the directory of the current file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Data files are in the parent directory (backend/)
DATA_DIR = os.path.join(BASE_DIR, "..")

# ------------------ ROADS ------------------

def get_road_sources(poly_utm, Q_totals):
    roads_path = os.path.join(DATA_DIR, "blr_roads.geojson")
    if not os.path.exists(roads_path):
        return []
    
    roads = gpd.read_file(roads_path).to_crs(epsg=UTM_EPSG)

    # Clip to polygon
    roads = roads[roads.geometry.intersects(poly_utm)]
    if roads.empty:
        return []

    total_length = roads.geometry.length.sum()
    if total_length == 0:
        return []

    sources = []

    for geom in roads.geometry:
        if geom is None or geom.is_empty:
            continue

        # Check if geometry is LineString or MultiLineString
        if geom.geom_type not in ['LineString', 'MultiLineString']:
            continue

        n = int(geom.length // POINT_SPACING)
        for i in range(n):
            p = geom.interpolate(i * POINT_SPACING)
            Qs = {
                g: (Q_totals[g] / total_length) * POINT_SPACING
                for g in Q_totals
            }
            sources.append((p.x, p.y, Qs, 1.5))  # road height ~1.5m

    return sources


# ------------------ INDUSTRY ------------------

def get_industry_sources(poly_utm):
    industry_path = os.path.join(DATA_DIR, "blr_industry.geojson")
    if not os.path.exists(industry_path):
        return []
        
    inds = gpd.read_file(industry_path).to_crs(epsg=UTM_EPSG)
    inds = inds[inds.geometry.intersects(poly_utm)]

    if inds.empty:
        return []

    sources = []

    for geom in inds.geometry:
        if geom is None or geom.is_empty:
            continue

        area = geom.area
        if area > 20000:
            Qs = INDUSTRY_Q["large"]
        elif area > 5000:
            Qs = INDUSTRY_Q["medium"]
        else:
            Qs = INDUSTRY_Q["small"]

        c = geom.centroid
        sources.append((c.x, c.y, Qs, 30))  # stack height ~30m

    return sources


# ------------------ BUILDINGS ------------------

def get_building_sources(poly_utm, building_emissions):
    buildings_path = os.path.join(DATA_DIR, "blr_buildings.geojson")
    if not os.path.exists(buildings_path):
        return []
        
    bldgs = gpd.read_file(buildings_path).to_crs(epsg=UTM_EPSG)
    bldgs = bldgs[bldgs.geometry.intersects(poly_utm)]

    if bldgs.empty:
        return []

    sources = []

    for geom in bldgs.geometry:
        if geom is None or geom.is_empty:
            continue

        c = geom.centroid
        sources.append((c.x, c.y, building_emissions, 8))  # avg building height

    return sources


# ------------------ GREEN COVER ------------------

def get_green_cover(poly_utm, buffer_dist=150):
    green_path = os.path.join(DATA_DIR, "blr_green.geojson")
    if not os.path.exists(green_path):
        return gpd.GeoDataFrame()
        
    green = gpd.read_file(green_path).to_crs(epsg=UTM_EPSG)

    buffered_poly = poly_utm.buffer(buffer_dist)

    # Clip green areas to buffer
    clipped = green.copy()
    clipped["intersect_geom"] = green.geometry.intersection(buffered_poly)
    clipped = clipped[~clipped["intersect_geom"].is_empty]

    # Area contribution
    clipped["effective_area"] = clipped["intersect_geom"].area

    # Drop very tiny contributions (noise)
    clipped = clipped[clipped["effective_area"] > 50]  # m² threshold

    clipped = clipped.set_geometry("intersect_geom")
    return clipped


# ================== TEST BLOCK ==================

if __name__ == "__main__":
    # Test area: Jayanagar (WGS84)
    test_coords = [
        (77.5700, 12.9150),
        (77.5750, 12.9150),
        (77.5750, 12.9200),
        (77.5700, 12.9200),
        (77.5700, 12.9150)
    ]

    poly_wgs = Polygon(test_coords)
    gdf_wgs = gpd.GeoDataFrame(index=[0], crs="EPSG:4326", geometry=[poly_wgs])
    poly_utm = gdf_wgs.to_crs(epsg=UTM_EPSG).geometry[0]

    dummy_road_Q = {"pm2_5": 0.8, "co": 12.5}
    dummy_building_Q = {"pm2_5": 0.002, "co": 0.01}

    print("--- LOCAL DATA TEST ---")

    roads = get_road_sources(poly_utm, dummy_road_Q)
    print(f"Road Points: {len(roads)}")

    industries = get_industry_sources(poly_utm)
    print(f"Industrial Points: {len(industries)}")

    buildings = get_building_sources(poly_utm, dummy_building_Q)
    print(f"Building Points: {len(buildings)}")
    
    green = get_green_cover(poly_utm)
    if not green.empty:
        print(f"Green Areas: {len(green)} | Total Area: {green.geometry.area.sum():.1f} m²")
    else:
        print("Green Areas: None")

    if buildings:
        x, y, Qs, h = buildings[0]
        print("\nSample Building Source:")
        print(f"({x:.2f}, {y:.2f}), height={h}m, Q={Qs}")
