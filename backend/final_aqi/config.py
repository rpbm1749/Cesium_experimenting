# ===============================
# CONFIG
# ===============================

WORLDPOP_URL = "https://api.worldpop.org/v1/services/stats"
OWM_AIR_URL = "http://api.openweathermap.org/data/2.5/air_pollution"
OWM_API_KEY = "5267120eb86351c6969536da5c2b0701"

UTM_EPSG = 32643
POINT_SPACING = 50
SECONDS_PER_DAY = 86400

ROAD_DUST_FACTOR = 8.5
UNIT_CONV = 1e6

TRIPS_PER_PERSON = 3.5
MODE_SPLIT = {"two_wheeler": 0.35, "car": 0.25}
OCCUPANCY = {"two_wheeler": 1.1, "car": 1.5}
AVG_KM = {"two_wheeler": 8, "car": 12}

EMISSION_FACTORS = {
    "two_wheeler": {
        "pm2_5": 0.015, "pm10": 0.02, "co": 1.5, "no2": 0.15,
        "so2": 0.01, "no": 0.05, "nh3": 0.001, "o3": 0.0
    },
    "car": {
        "pm2_5": 0.035, "pm10": 0.05, "co": 2.5, "no2": 0.45,
        "so2": 0.02, "no": 0.1, "nh3": 0.002, "o3": 0.0
    }
}

INDUSTRY_Q = {
    "small": {"pm2_5": 0.5, "pm10": 0.8, "co": 5.0, "no2": 2.0, "so2": 1.0, "no": 0.5, "nh3": 0.1, "o3": 0.0},
    "medium": {"pm2_5": 2.0, "pm10": 3.5, "co": 20.0, "no2": 10.0, "so2": 5.0, "no": 2.0, "nh3": 0.5, "o3": 0.0},
    "large": {"pm2_5": 8.0, "pm10": 15.0, "co": 80.0, "no2": 40.0, "so2": 25.0, "no": 8.0, "nh3": 2.0, "o3": 0.0}
}
