import numpy as np
from gaussian_plume import gaussian_plume

def run_dispersion(sources, receptors, wind):
    if not sources:
        return {}

    gases = list(sources[0][2].keys())
    C_totals = {g: np.zeros(len(receptors)) for g in gases}

    for x, y, Qs, H in sources:
        C_unit = gaussian_plume(1.0, x, y, H, wind["speed"], wind["dir"], receptors)
        for gas in gases:
            C_totals[gas] += C_unit * Qs.get(gas, 0)

    return C_totals

def apply_urban_modifiers(C_totals, built_frac, green_frac):
    for gas in C_totals:
        C_totals[gas] *= (1 + 0.1 * built_frac)
        C_totals[gas] *= (1 - 0.15 * green_frac)
    return C_totals
