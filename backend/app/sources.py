import geopandas as gpd
import osmnx as ox
from .config import UTM_EPSG, POINT_SPACING, INDUSTRY_Q

# --- Your existing functions ---

def get_road_sources(poly_utm, Q_totals):
    poly_wgs = gpd.GeoSeries([poly_utm], crs=UTM_EPSG).to_crs(epsg=4326).iloc[0]
    G = ox.graph_from_polygon(poly_wgs, network_type="drive")
    edges = ox.graph_to_gdfs(G, nodes=False).to_crs(epsg=UTM_EPSG)

    total_length = edges.length.sum()
    if total_length == 0:
        return []

    sources = []
    for geom in edges.geometry:
        n = int(geom.length // POINT_SPACING)
        for i in range(n):
            p = geom.interpolate(i * POINT_SPACING)
            Qs = {g: (Q_totals[g] / total_length) * POINT_SPACING for g in Q_totals}
            sources.append((p.x, p.y, Qs, 1.5))
    return sources

def get_industry_sources(poly_utm):
    poly_wgs = (
        gpd.GeoSeries([poly_utm], crs=UTM_EPSG)
        .to_crs(epsg=4326)
        .iloc[0]
    )

    try:
        inds = ox.features_from_polygon(
            poly_wgs,
            tags={"landuse": "industrial"}
        )
    except Exception:
        # 👈 THIS IS THE FIX
        return []

    if inds.empty:
        return []

    inds = inds.to_crs(epsg=UTM_EPSG)
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
        sources.append((c.x, c.y, Qs, 30))

    return sources

# --- New functions for Buildings and Green Cover ---

def get_building_sources(poly_utm, building_emissions):
    """
    Fetches all buildings and returns them as point sources at their centroids.
    building_emissions: a dict like {'pm2_5': 0.001} representing avg emission per building.
    """
    poly_wgs = gpd.GeoSeries([poly_utm], crs=UTM_EPSG).to_crs(epsg=4326).iloc[0]
    # Fetch all buildings
    bldgs = ox.features_from_polygon(poly_wgs, tags={"building": True})
    
    if bldgs.empty:
        return []

    bldgs = bldgs.to_crs(epsg=UTM_EPSG)
    sources = []

    for geom in bldgs.geometry:
        if geom is None or geom.is_empty:
            continue
        
        # We use the centroid to represent the building as a point source
        c = geom.centroid
        # Emission height for buildings is typically lower than industry (e.g., 5-10m)
        sources.append((c.x, c.y, building_emissions, 8))

    return sources

def get_green_cover(poly_utm):
    """
    Fetches parks, forests, and grass areas. 
    Returns a GeoDataFrame of the shapes (useful for calculating absorption/sinks).
    """
    poly_wgs = gpd.GeoSeries([poly_utm], crs=UTM_EPSG).to_crs(epsg=4326).iloc[0]
    
    # Define tags for green/natural spaces
    green_tags = {
        "leisure": ["park", "garden"],
        "landuse": ["grass", "forest", "orchard"],
        "natural": ["wood", "scrub"]
    }
    
    green_areas = ox.features_from_polygon(poly_wgs, tags=green_tags)
    
    if green_areas.empty:
        return gpd.GeoDataFrame()

    return green_areas.to_crs(epsg=UTM_EPSG)