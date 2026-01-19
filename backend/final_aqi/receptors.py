import numpy as np

def build_receptors(poly_utm, spacing=250):
    minx, miny, maxx, maxy = poly_utm.bounds
    xs = np.arange(minx, maxx, spacing)
    ys = np.arange(miny, maxy, spacing)
    return np.array([(x, y) for x in xs for y in ys])
