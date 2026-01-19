import geopandas as gpd
from shapely.geometry import Polygon


DATA_DIR = "."
# ---------------- CONFIG (LOCAL TESTING) ----------------

# Bengaluru UTM Zone → EPSG:32643 (WGS 84 / UTM zone 43N)
UTM_EPSG = 32643

# Distance between emission points on roads (meters)
POINT_SPACING = 20

# Industry emission profiles (example values)
INDUSTRY_Q = {
    "large": {"pm2_5": 0.05, "co": 1.5},
    "medium": {"pm2_5": 0.02, "co": 0.8},
    "small": {"pm2_5": 0.005, "co": 0.2}
}


# ------------------ ROADS ------------------

def get_road_sources(poly_utm, Q_totals):
    roads = gpd.read_file(f"{DATA_DIR}/blr_roads.geojson").to_crs(epsg=UTM_EPSG)

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
    inds = gpd.read_file(f"{DATA_DIR}/blr_industry.geojson").to_crs(epsg=UTM_EPSG)
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
    bldgs = gpd.read_file(f"{DATA_DIR}/blr_buildings.geojson").to_crs(epsg=UTM_EPSG)
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
    green = gpd.read_file("blr_green.geojson").to_crs(epsg=UTM_EPSG)

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