import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

# Load models and scaler
scaler_path = os.path.join(MODELS_DIR, 'scaler.pkl')
models_path = os.path.join(MODELS_DIR, 'traditional_models.pkl')
csv_path = os.path.join(MODELS_DIR, 'city_day.csv')

# Global variables for models and features
scaler = None
lr_model = None
rf_model = None
gb_model = None
X_train_columns = []

def load_resources():
    global scaler, lr_model, rf_model, gb_model, X_train_columns
    try:
        if os.path.exists(scaler_path):
            scaler = joblib.load(scaler_path)
        
        if os.path.exists(models_path):
            loaded_models = joblib.load(models_path)
            lr_model = loaded_models.get('Linear Regression')
            rf_model = loaded_models.get('Random Forest')
            # Fallback to Decision Tree if Gradient Boosting is not found
            gb_model = loaded_models.get('Gradient Boosting') or loaded_models.get('Decision Tree')
        
        if os.path.exists(csv_path):
            df_aqi = pd.read_csv(csv_path)
            df_aqi.dropna(inplace=True)
            cols_to_drop = ['StationId', 'StationName', 'Status', 'Date', 'AQI', 'AQI_Bucket']
            df_preprocessed = df_aqi.drop(columns=[col for col in cols_to_drop if col in df_aqi.columns], errors='ignore')
            df_processed = pd.get_dummies(df_preprocessed, columns=['City'], drop_first=True)
            X_train_columns = df_processed.columns.tolist()
        else:
            # Fallback feature names if CSV is missing
            X_train_columns = ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3']
            
        print("Resources loaded successfully.")
    except Exception as e:
        print(f"Error loading resources: {e}")

load_resources()

@app.post("/predict")
async def predict(data: dict):
    try:
        # Extract input data from the request
        # The user format: {'PM2.5': [87.13], 'PM10': [101.63], ...}
        input_data = {
            'PM2.5': data.get('PM2.5', [0.0]),
            'PM10': data.get('PM10', [0.0]),
            'NO2': data.get('NO2', [0.0]),
            'SO2': data.get('SO2', [0.0]),
            'CO': data.get('CO', [0.0]),
            'O3': data.get('O3', [0.0])
        }

        # Create a DataFrame from the input data (as requested in the snippet)
        input_df_simple = pd.DataFrame(input_data)
        
        # Prepare the full feature set (20 columns) expected by the models
        input_df_full = pd.DataFrame(0.0, index=[0], columns=X_train_columns)
        for col, values in input_data.items():
            if col in input_df_full.columns:
                input_df_full[col] = values[0]

        # Scale the input features using the same scaler fitted on X_train 
        input_scaled = scaler.transform(input_df_full) if scaler else input_df_full
        
        # Predict using Linear Regression model 
        lr_prediction = lr_model.predict(input_scaled)[0] if lr_model else 0.0
        
        print(f"Predicted AQI by Linear Regression: {lr_prediction:.2f}")

        return {
            "lr_prediction": float(lr_prediction)
        }
    except Exception as e:
        print(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
