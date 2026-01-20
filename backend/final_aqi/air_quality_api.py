import requests
from config import OWM_AIR_URL, OWM_API_KEY

def get_current_background(lat, lon):
    params = {"lat": lat, "lon": lon, "appid": OWM_API_KEY}
    try:
        r = requests.get(OWM_AIR_URL, params=params).json()
        owm_aqi = r["list"][0]["main"]["aqi"]
        print(f"--- OWM API AQI: {owm_aqi} ---")
        comps = r["list"][0]["components"]
        print(comps)
        print("------REAL----")
        # Use average values if API returns 0 or missing
        pm2_5 = comps.get("pm2_5") or 67.45
        pm10 = comps.get("pm10") or 118.13
        co = comps.get("co") or 0.2248
        no2 = comps.get("no2") or 28.56
        so2 = comps.get("so2") or 14.53
        no = comps.get("no") or 17.57
        nh3 = comps.get("nh3") or 23.48
        o3 = comps.get("o3") or 34.49

        result = {
            "pm2_5": round(pm2_5, 2),
            "pm10": round(pm10, 2),
            "co": round(co, 2)/1000,
            "no2": round(no2, 2),
            "so2": round(so2, 2),
            "no": round(no, 2),
            "nh3": round(nh3, 2),
            "o3": round(o3, 2)
        }
        print(result)
        return result
    except:
        return {
            "pm2_5": 65, "pm10": 80, "co": 0.2248,"no2": 10,
            "so2": 5, "no": 5, "nh3": 2, "o3": 40
        }

if __name__ == "__main__":
    # Test with Bengaluru coordinates
    lat, lon = 18.96, 72.82
    print(f"Fetching background air quality for Lat: {lat}, Lon: {lon}...")
    background = get_current_background(lat, lon)
    print("\nBackground Pollutant Levels:")
    for pollutant, value in background.items():
        print(f"  {pollutant.upper():<8}: {value}")
