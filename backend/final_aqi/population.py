import json
import requests
from config import WORLDPOP_URL

def get_population(geojson, year=2020, retries=3):
    params = {
        "dataset": "wpgppop",
        "year": year,
        "geojson": json.dumps(geojson),
        "runasync": "false"
    }

    for attempt in range(retries):
        try:
            r = requests.get(
                WORLDPOP_URL,
                params=params,
                timeout=30  # IMPORTANT
            )
            r.raise_for_status()
            return r.json()["data"]["total_population"]

        except Exception as e:
            if attempt == retries - 1:
                print("[WorldPop ERROR] Using fallback population:", e)
                return None  # fallback
