import numpy as np
from scenario_runner import run_scenario
from aqi_model import predict_aqi_with_model, loaded_models, loaded_scaler, AQI_FEATURE_NAMES

def main():
    polygon_coords = [
        (77.5730, 12.9180),
        (77.5730, 12.9340),
        (77.5900, 12.9340),
        (77.5900, 12.9180),
        (77.5730, 12.9180)
    ]

    wind = {"speed": 3.2, "dir": 240}

    base = {"pop_growth": 0.0, "years": 0, "built": 0.4, "green": 0.2}
    future = {"pop_growth": -0.025, "years": 5, "built": 0.1, "green": 0.1}

    print("-" * 50)
    print("URBAN MULTI-GAS SIMULATION & AQI PREDICTION (MODULAR)")
    print("-" * 50)

    # Run Base Scenario
    _, C0_all = run_scenario(polygon_coords, base, wind)
    current_means = {gas: C0_all[gas].mean() for gas in C0_all}

    # Run Future Scenario
    _, C1_all = run_scenario(polygon_coords, future, wind)
    future_means = {gas: C1_all[gas].mean() for gas in C1_all}
    
    city_input = "Bengaluru" 
    feature_names = AQI_FEATURE_NAMES

    scenarios = [
        ("Current (Base)", current_means),
        ("Future (15 Years)", future_means)
    ]

    for label, means in scenarios:
        print(f"\n" + "="*50)
        print(f" SCENARIO: {label}")
        print("="*50)

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

        print(f"Predicted concentrations (means) for {city_input}:")
        for gas, val in means.items():
            unit = "ug/m3"
            print(f"  {gas.upper():<10}: {val:.2f} {unit}")
        
        print("\nPredicting AQI using loaded models...")
        predictions = {}

        # Traditional models
        for name, model_obj in loaded_models.items():
            predicted_aqi = predict_aqi_with_model(model_obj, name, numerical_inputs, city_input, feature_names, loaded_scaler)
            predictions[name] = predicted_aqi
            print(f"  {name:<25}: {predicted_aqi:.2f}")

        # Neural Network
        # nn_predicted_aqi = predict_aqi_with_model(loaded_nn_model, "Neural Network (MLP)", numerical_inputs, city_input, feature_names, loaded_scaler)
        # predictions["Neural Network (MLP)"] = nn_predicted_aqi
        # print(f"  Neural Network (MLP)     : {nn_predicted_aqi:.2f}")

        print("-" * 50)
        print("AQI SUMMARY")
        print("-" * 50)
        avg_aqi = np.mean(list(predictions.values()))
        print(f"Average Predicted AQI: {avg_aqi:.2f}")
        
        if avg_aqi <= 50: status = "Good"
        elif avg_aqi <= 100: status = "Satisfactory"
        elif avg_aqi <= 200: status = "Moderate"
        elif avg_aqi <= 300: status = "Poor"
        elif avg_aqi <= 400: status = "Very Poor"
        else: status = "Severe"
        
        print(f"Overall Air Quality Status: {status}")
        print("-" * 50)

if __name__ == "__main__":
    main()