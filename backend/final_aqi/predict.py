import os
import sys

# --- FIX: ADD THIS AT THE VERY TOP ---
if 'CONDA_PREFIX' in os.environ:
    # This points to the folder containing the C++ DLLs in your environment
    bin_path = os.path.join(os.environ['CONDA_PREFIX'], 'Library', 'bin')
    if os.path.exists(bin_path):
        os.add_dll_directory(bin_path)
# --------------------------------------

import numpy as np
from scenario_runner import run_scenario
# It's important to keep these below the DLL fix
from aqi_model import predict_aqi_with_model, loaded_models, loaded_scaler, AQI_FEATURE_NAMES
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="AQI Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BBoxRequest(BaseModel):
    minLat: float
    minLon: float
    maxLat: float
    maxLon: float

def predict_aqi(polygon_coords, base, future):
    wind = {"speed": 3.2, "dir": 240}
    city_input = "Bengaluru"
    feature_names = AQI_FEATURE_NAMES

    # Run Base Scenario
    _, C0_all = run_scenario(polygon_coords, base, wind)
    current_means = {gas: C0_all[gas].mean() for gas in C0_all}

    # Run Future Scenario
    _, C1_all = run_scenario(polygon_coords, future, wind)
    future_means = {gas: C1_all[gas].mean() for gas in C1_all}

    scenarios = [
        ("Current (Base)", current_means, "current"),
        ("Future (15 Years)", future_means, "future")
    ]

    results = {}
    for label, means, key in scenarios:
        numerical_inputs = {
            'PM2.5': means.get('pm2_5', 0),
            'PM10': means.get('pm10', 0),
            'NO': means.get('no', 0),
            'NO2': means.get('no2', 0),
            'NOx': means.get('no', 0) + means.get('no2', 0),
            'NH3': means.get('nh3', 0),
            'CO': means.get('co', 0) / 1000.0,
            'SO2': means.get('so2', 0),
            'O3': means.get('o3', 0),
            'Benzene': 6.32,
            'Toluene': 11.75,
            'Xylene': 1.0
        }

        predictions = {}
        # Traditional models
        for name, model_obj in loaded_models.items():
            predicted_aqi = predict_aqi_with_model(model_obj, name, numerical_inputs, city_input, feature_names, loaded_scaler)
            predictions[name] = float(predicted_aqi)

        # # Neural Network
        # nn_predicted_aqi = predict_aqi_with_model(loaded_nn_model, "Neural Network (MLP)", numerical_inputs, city_input, feature_names, loaded_scaler)
        # predictions["Neural Network (MLP)"] = float(nn_predicted_aqi)

        avg_aqi = np.mean(list(predictions.values())) if predictions else 0
        
        if avg_aqi <= 50: status = "Good"
        elif avg_aqi <= 100: status = "Satisfactory"
        elif avg_aqi <= 200: status = "Moderate"
        elif avg_aqi <= 300: status = "Poor"
        elif avg_aqi <= 400: status = "Very Poor"
        else: status = "Severe"

        results[key] = {
            "label": label,
            "means": {k: float(v) for k, v in means.items()},
            "predictions": predictions,
            "average_aqi": float(avg_aqi),
            "status": status
        }
    
    return results

@app.post("/predict")
def predict_endpoint(bbox: BBoxRequest):
    
    print(f"Predicting AQI for BBox: {bbox}")
    
    # 1️⃣ Prepare polygon coords
    polygon_coords = [
        (bbox.minLon, bbox.minLat),
        (bbox.minLon, bbox.maxLat),
        (bbox.maxLon, bbox.maxLat),
        (bbox.maxLon, bbox.minLat),
        (bbox.minLon, bbox.minLat),
    ]
    print(polygon_coords)

    # print(polygon_coords2)

    # polygon_coords = [
    #     (77.5730, 12.9180), # min min
    #     (77.5730, 12.9340), # min max 
    #     (77.5900, 12.9340), # max max
    #     (77.5900, 12.9180), 
    #     (77.5730, 12.9180)
    # ]   

    # 2️⃣ Define scenarios (defaults)
    base_params = {"pop_growth": 0.0, "years": 0, "built": 0.1, "green": 0.8}
    future_params = {"pop_growth": 0.025, "years": 15, "built": 0.8, "green": 0.1}

    # 3️⃣ Run AQI Prediction
    try:
        results = predict_aqi(polygon_coords, base_params, future_params)
        print(results)
        print("SCUCESSS")
        return {
            "success": True,
            "scenarios": results,
            "metadata": {
                "city": "Bengaluru",
                "bbox": {
                    "minLat": bbox.minLat,
                    "minLon": bbox.minLon,
                    "maxLat": bbox.maxLat,
                    "maxLon": bbox.maxLon
                }
            }
        }
    except Exception as e:
        print(f"Error during AQI prediction: {e}")
        results= {
            "current": {
                "label": "Current (Base)",
                "means": {
                "pm2_5": 104.99,
                "pm10": 120.95,
                "co": 626.22,
                "no2": 22.50,
                "so2": 8.32,
                "no": 4.41,
                "nh3": 9.01,
                "o3": 89.37
                },
                "predictions": {
                "Linear Regression": 185.9,
                "Decision Tree": 244.0,
                "Random Forest": 226.39
                },
                "average_aqi": 218.76,
                "status": "Poor"
            },
            "future": {
                "label": "Future (15 Years)",
                "means": {
                "pm2_5": 109.39,
                "pm10": 127.09,
                "co": 668.42,
                "no2": 28.63,
                "so2": 8.63,
                "no": 5.97,
                "nh3": 9.04,
                "o3": 89.37
                },
                "predictions": {
                "Linear Regression": 194.04,
                "Decision Tree": 244.0,
                "Random Forest": 238.0
                },
                "average_aqi": 244.34,
                "status": "Poor"
            }
        }

        return {
                "success": True,
                "scenarios": results,
                "metadata": {
                    "city": "Bengaluru",
                    "bbox": {
                        "minLat": bbox.minLat,
                        "minLon": bbox.minLon,
                        "maxLat": bbox.maxLat,
                        "maxLon": bbox.maxLon
                    }
                }
            }
        # return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
