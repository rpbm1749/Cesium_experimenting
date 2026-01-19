import joblib
import pandas as pd
import numpy as np
import os

# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

# Load data for feature names and city encoding
try:
    csv_path = os.path.join(MODELS_DIR, 'city_day.csv')
    df_aqi = pd.read_csv(csv_path)
    df_aqi.dropna(inplace=True)
    cols_to_drop = ['StationId', 'StationName', 'Status', 'Date', 'AQI', 'AQI_Bucket']
    df_preprocessed = df_aqi.drop(columns=[col for col in cols_to_drop if col in df_aqi.columns], errors='ignore')
    df_processed = pd.get_dummies(df_preprocessed, columns=['City'], drop_first=True)
    AQI_X = df_processed
    AQI_FEATURE_NAMES = AQI_X.columns.tolist()
except Exception as e:
    print(f"Warning: Could not load city_day.csv from {csv_path}: {e}")
    AQI_FEATURE_NAMES = []

# Load models
try:
    scaler_path = os.path.join(MODELS_DIR, 'scaler.pkl')
    models_path = os.path.join(MODELS_DIR, 'traditional_models.pkl')

    loaded_scaler = joblib.load(scaler_path)
    loaded_models = joblib.load(models_path)
    
    print("AQI Traditional Models loaded successfully from models/ directory.")
except Exception as e:
    print(f"Error loading AQI models: {e}")
    loaded_scaler = None
    loaded_models = {}

def predict_aqi_with_model(model, model_name, numerical_inputs, city_input, feature_names, scaler):
    """
    Predicts AQI using traditional machine learning models (Random Forest, Linear Regression, etc.)
    """
    if model is None or scaler is None:
        return 0.0
        
    # Create a template DataFrame with zeros
    new_data = pd.DataFrame(0, index=[0], columns=feature_names)

    # Fill in numerical values (Pollutants)
    for col, value in numerical_inputs.items():
        if col in new_data.columns:
            new_data[col] = value

    # Set the corresponding city column (One-Hot Encoding)
    city_col_name = f'City_{city_input}'
    if city_col_name in new_data.columns:
        new_data[city_col_name] = 1
    
    # Scale and predict
    new_data_scaled = scaler.transform(new_data)
    
    # Prediction for traditional sklearn-style models
    predicted_aqi = model.predict(new_data_scaled)[0]

    return predicted_aqi