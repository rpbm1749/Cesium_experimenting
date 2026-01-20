import pandas as pd

# Load CSV
df = pd.read_csv("C:\\Users\\ajayr\\OneDrive\\Documents\\ML\\El_5\\New folder\\Cesium_experimenting\\backend\\final_aqi\\models\\city_day.csv")

# List of pollutant columns
pollutant_cols = [
    "PM2.5", "PM10", "NO", "NO2", "NOx", "NH3",
    "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene", "AQI"
]

# Convert pollutants to numeric (safety step)
df[pollutant_cols] = df[pollutant_cols].apply(pd.to_numeric, errors="coerce")

# Calculate average for each pollutant
avg_pollutants = df[pollutant_cols].mean()

# Print results
print("Average value of each pollutant:\n")
print(avg_pollutants)
