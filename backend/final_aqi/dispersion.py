import numpy as np
from gaussian_plume import gaussian_plume

def run_dispersion(sources, receptors, wind, built_frac=0.2):
    """
    Runs the Gaussian plume model for all sources.
    Incorporates urban roughness effect on wind speed.
    """
    if not sources:
        return {}

    # Adjust wind speed based on built-up fraction (roughness)
    # Higher built_frac -> higher roughness -> lower effective wind speed at ground level
    # Typical urban roughness z0 ranges from 0.1 to 2.0
    z0 = 0.1 + (built_frac * 1.5) 
    # Logarithmic wind profile approximation: u(z) = u_ref * ln(z/z0) / ln(z_ref/z0)
    # We'll use a simple scaling factor for ground-level dispersion
    wind_factor = np.log(10 / z0) / np.log(10 / 0.1) # Normalized to z0=0.1
    effective_wind_speed = max(0.5, wind["speed"] * wind_factor)

    gases = list(sources[0][2].keys())
    C_totals = {g: np.zeros(len(receptors)) for g in gases}

    for x, y, Qs, H in sources:
        C_unit = gaussian_plume(1.0, x, y, H, effective_wind_speed, wind["dir"], receptors)
        for gas in gases:
            C_totals[gas] += C_unit * Qs.get(gas, 0)

    return C_totals

def apply_urban_modifiers(C_totals, built_frac, green_frac):
    """
    Applies land cover modifiers:
    1. Built-up: Street canyon trapping (Trapping factor)
    2. Green Cover: Dry deposition (Removal factor)
    """
    # Dry deposition constants (k) - slightly increased for better responsiveness
    DEPOSITION_K = {
        'pm2_5': 0.35, 'pm10': 0.50, 'so2': 0.40,
        'no2': 0.25, 'co': 0.10, 'o3': 0.45, 'no': 0.15
    }
    
    # Trapping coefficient for built-up area - slightly increased
    TRAPPING_ALPHA = 0.40 

    for gas in C_totals:
        gas_lower = gas.lower()
        k = DEPOSITION_K.get(gas_lower, 0.05)
        
        # Trapping increases with built_frac
        trapping = (1 + TRAPPING_ALPHA * built_frac)
        
        # Deposition decreases concentration exponentially with green_frac
        deposition = np.exp(-k * green_frac)
        
        C_totals[gas] *= (trapping * deposition)
        
    return C_totals
