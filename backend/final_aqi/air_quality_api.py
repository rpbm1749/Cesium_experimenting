import requests
from config import OWM_AIR_URL, OWM_API_KEY

def get_current_background(lat, lon):
    params = {"lat": lat, "lon": lon, "appid": OWM_API_KEY}
    try:
        r = requests.get(OWM_AIR_URL, params=params).json()
        comps = r["list"][0]["components"]
        print("------REAL----")
        return {
            "pm2_5": comps.get("pm2_5", 0),
            "pm10": comps.get("pm10", 0),
            "co": comps.get("co", 0),
            "no2": comps.get("no2", 0),
            "so2": comps.get("so2", 0),
            "no": comps.get("no", 0),
            "nh3": comps.get("nh3", 0),
            "o3": comps.get("o3", 0)
        }
    except:
        return {
            "pm2_5": 65, "pm10": 80, "co": 300, "no2": 10,
            "so2": 5, "no": 5, "nh3": 2, "o3": 40
        }
