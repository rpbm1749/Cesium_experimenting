# 🌆 Urban Air Quality Simulation & AQI Prediction System

This project is a modular urban air quality simulation framework that integrates physical atmospheric dispersion models with machine learning–based AQI prediction. It allows for the simulation of how changes in population growth, built-up area, and green cover affect air pollution levels.

## 📂 Project Structure

The project is divided into two main components:
- **`backend/`**: Contains the AQI prediction logic and dispersion models.
  - **`final_aqi/`**: The primary backend folder containing the prediction API.
- **`frontend2/`**: The main frontend application built with React, Vite, and Tailwind CSS.

*Note: There is also a `frontend/` folder, but `frontend2/` is the current active version.*

---

## 🚀 Getting Started

### 1️⃣ Backend Setup (AQI Prediction)

The backend uses FastAPI and Uvicorn to serve the AQI prediction model.

1.  **Navigate to the backend directory:**
    ```bash
    cd backend/final_aqi
    ```
2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Run the prediction server:**
    ```bash
    uvicorn predict:app --host 0.0.0.0 --port 8001 --reload
    ```
    The API will be available at `http://localhost:8001`.

### 2️⃣ Frontend Setup

The frontend is a modern React application.

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend2
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # OR if you use bun
    bun install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:8080` (or the port specified by Vite).

---

## 🛠️ Key Features

- **🌬️ Physical Dispersion Modeling**: Implements the **Gaussian Plume Model** for pollutants like PM2.5, PM10, CO, NO₂, and SO₂.
- **🏙️ Urban Data Integration**: Fetches road networks and land-use data using **OSMnx**.
- **👥 Population-Driven Emissions**: Uses **WorldPop API** to estimate emissions based on population density.
- **🤖 ML-Based AQI Prediction**: Uses Random Forest, Gradient Boosting, and Neural Networks to predict AQI categories.
- **🔮 Scenario Analysis**: Compare current scenarios with future urban expansion projections.

## 🔐 Configuration

If you need to update API keys (like OpenWeatherMap), check the configuration files:
- Backend: [config.py](file:///c:/Users/ajayr/OneDrive/Documents/ML/El_5/New%20folder/Cesium_experimenting/backend/final_aqi/config.py)
