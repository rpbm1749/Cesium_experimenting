# 🌆 Urban Air Quality Simulation & AQI Prediction System

This project presents a modular urban air quality simulation framework that integrates physical atmospheric dispersion models with machine learning–based AQI prediction. The system evaluates current and future urban scenarios by modeling emissions, population-driven traffic, land-use patterns, and background air quality.

The tool is designed for urban-scale environmental analysis, allowing users to simulate how changes in population growth, built-up area, and green cover affect air pollution levels and overall Air Quality Index (AQI).

## 🚀 Key Features

### 🌬️ Physical Dispersion Modeling
Implements the **Gaussian Plume Model** to simulate the dispersion of multiple pollutants:
- PM2.5
- PM10
- CO
- NO₂
- SO₂

Supports multiple dynamic emission sources distributed across an urban area.

### 🏙️ Real-world Urban Data Integration
- Road networks, buildings, and land-use fetched dynamically using **OSMnx** (OpenStreetMap).
- Industrial zones and traffic corridors used as major emission sources.

### 👥 Population-Driven Emissions
- Integrates **WorldPop API** data to estimate population density.
- Vehicle emissions are calculated based on population-induced traffic volume.

### 🌫️ Background Air Quality
- Incorporates real-time background pollutant concentrations using the **OpenWeatherMap Air Pollution API**.

### 🤖 Machine Learning–Based AQI Prediction
Uses pre-trained ML models:
- Random Forest
- Gradient Boosting
- Neural Network (MLP)

Converts simulated pollutant concentrations into AQI values and categories.

### 🔮 Scenario-Based Analysis
**Compare:**
- Base (Current) Scenario
- Future Scenario (e.g., 5 yearsahead)

**Analyze the impact of:**
- Urban expansion
- Population growth
- Environmental interventions

## 🧱 Project Architecture
```text
.
├── main.py                 # Entry point for the simulation
├── scenario_runner.py      # Runs and compares urban scenarios
├── aqi_model.py            # AQI prediction using ML models
├── sources.py              # Emission source extraction (roads, industry)
├── dispersion.py           # Urban dispersion modifiers
├── gaussian_plume.py       # Core plume dispersion equations
├── vehicle_emissions.py    # Traffic-based emission estimation
├── air_quality_api.py      # Background AQI from OpenWeatherMap
├── population.py           # Population data from WorldPop
├── geometry_utils.py       # Spatial and geometric utilities
├── config.py               # Configuration & emission factors
├── models/                 # Trained ML models & scalers
│   ├── *.pkl
│   ├── *.h5
│   └── city_day.csv
├── requirements.txt
└── README.md
```

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/ajayrm04/Aqi_Prediction.git
cd Aqi_Prediction
```

### 2️⃣ Create Virtual Environment (Recommended)
```bash
python -m venv tfvenv
# Linux/Mac
source tfvenv/bin/activate
# Windows
tfvenv\Scripts\activate
```

### 3️⃣ Install Dependencies
```bash
pip install -r requirements.txt
```

## 🔐 Configuration
Update [config.py](file:///c:/Users/ajayr/OneDrive/Documents/ML/El_5/New%20folder/final_aqi/config.py) with your OpenWeatherMap API Key:
```python
OPENWEATHER_API_KEY = "your_api_key_here"
```
A default key is provided for testing, but personal keys are recommended for reliability.

## ▶️ How to Run
Execute the main simulation:
```bash
python main.py
```

### What Happens Internally:
1. Urban region (Bengaluru) is selected.
2. Emission sources are extracted using OSM data.
3. Gaussian plume dispersion is simulated.
4. Background AQI is added.
5. ML models predict AQI values.
6. Results for Current vs Future scenario are displayed.

## 📊 Output
- Pollutant concentration levels
- AQI value
- AQI category (Good, Moderate, Poor, etc.)
- Comparative analysis between scenarios
