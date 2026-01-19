import json
import requests
from config import WORLDPOP_URL

def get_population(geojson, year=2020):
    params = {
        "dataset": "wpgppop",
        "year": year,
        "geojson": json.dumps(geojson),
        "runasync": "false"
    }
    r = requests.get(WORLDPOP_URL, params=params).json()
    return r["data"]["total_population"]
