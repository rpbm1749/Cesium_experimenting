from shapely.geometry import Polygon
from shapely.validation import make_valid

def make_valid_polygon(coords):
    poly = Polygon(coords)
    poly = make_valid(poly)
    if poly.is_empty:
        raise ValueError("Invalid polygon after fixing")
    return poly
