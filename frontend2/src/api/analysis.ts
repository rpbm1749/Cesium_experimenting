export interface BBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  scenario_text?: string;
}

export interface PollutantMeans {
  pm2_5: number;
  pm10: number;
  co: number;
  no2: number;
  so2: number;
  no: number;
  nh3: number;
  o3: number;
}

export interface Predictions {
  "Linear Regression": number;
  "Decision Tree": number;
  "Random Forest": number;
}

export interface AnalysisData {
  label: string;
  means: PollutantMeans;
  predictions: Predictions;
  average_aqi: number;
  status: string;
}

export interface AnalysisResult {
  success: boolean;
  scenarios: {
    current: AnalysisData;
    future: AnalysisData;
  };
  simulation_params?: {
    base: any;
    future: any;
  };
  metadata: {
    city: string;
    bbox: BBox;
  };
}

export async function analyzeBBox(bbox: BBox): Promise<AnalysisResult> {
  const response = await fetch("http://localhost:8001/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bbox),
  });

  if (!response.ok) {
    throw new Error("Failed to analyze area");
  }

  return response.json();
}
