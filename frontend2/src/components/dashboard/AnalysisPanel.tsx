import React from "react";
import { 
  TrendingUp, 
  TrendingDown,
  Wind,
  Droplets,
  Flame,
  CloudRain,
  Leaf,
  Sun,
  Clock,
  Calendar,
  BarChart3,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisResult, PollutantMeans, Predictions } from "@/api/analysis";

interface AnalysisPanelProps {
  result: AnalysisResult | null;
  selectedBBox: any;
}

const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "good":
      return "status-good";
    case "moderate":
      return "status-moderate";
    case "unhealthy":
    case "poor":
    case "hazardous":
      return "status-poor";
    default:
      return "status-moderate";
  }
};

const PollutantIcon: React.FC<{ name: string }> = ({ name }) => {
  const icons: Record<string, React.ReactNode> = {
    pm2_5: <Droplets className="w-3.5 h-3.5" />,
    pm10: <Wind className="w-3.5 h-3.5" />,
    co: <Flame className="w-3.5 h-3.5" />,
    no2: <CloudRain className="w-3.5 h-3.5" />,
    so2: <AlertTriangle className="w-3.5 h-3.5" />,
    no: <Leaf className="w-3.5 h-3.5" />,
    nh3: <Leaf className="w-3.5 h-3.5" />,
    o3: <Sun className="w-3.5 h-3.5" />,
  };
  return icons[name] || <Wind className="w-3.5 h-3.5" />;
};

const formatPollutantName = (name: string) => {
  const names: Record<string, string> = {
    pm2_5: "PM2.5",
    pm10: "PM10",
    co: "CO",
    no2: "NO₂",
    so2: "SO₂",
    no: "NO",
    nh3: "NH₃",
    o3: "O₃",
  };
  return names[name] || name.toUpperCase();
};

const MetricCard: React.FC<{
  label: string;
  value: number;
  unit?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | null;
  trendValue?: number;
}> = ({ label, value, unit = "", icon, trend, trendValue }) => (
  <div className="metric-card">
    <div className="flex items-start justify-between mb-2">
      <span className="text-muted-foreground">{icon}</span>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium",
          trend === "up" ? "text-destructive" : "text-success"
        )}>
          {trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        </div>
      )}
    </div>
    <div className="metric-value">{value.toFixed(1)}<span className="text-sm text-muted-foreground ml-1">{unit}</span></div>
    <div className="metric-label mt-1">{label}</div>
  </div>
);

const AQIGauge: React.FC<{ value: number; status: string }> = ({ value, status }) => {
  const percentage = Math.min((value / 500) * 100, 100);
  
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">Air Quality Index</span>
        <span className={cn("status-badge", getStatusStyle(status))}>{status}</span>
      </div>
      <div className="h-3 bg-secondary rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-500",
            status?.toLowerCase() === "good" && "bg-success",
            status?.toLowerCase() === "moderate" && "bg-warning",
            (status?.toLowerCase() === "poor" || status?.toLowerCase() === "unhealthy") && "bg-destructive"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-2 text-3xl font-bold font-mono text-foreground">
        {value.toFixed(0)}
        <span className="text-sm text-muted-foreground ml-2">AQI</span>
      </div>
    </div>
  );
};

const PollutantGrid: React.FC<{ means: PollutantMeans; futureMeans?: PollutantMeans }> = ({ means, futureMeans }) => (
  <div className="grid grid-cols-4 gap-2">
    {Object.entries(means).map(([key, value]) => {
      const futureValue = futureMeans?.[key as keyof PollutantMeans];
      const trend = futureValue && futureValue > value ? "up" : futureValue && futureValue < value ? "down" : null;
      const trendValue = futureValue ? ((futureValue - value) / value) * 100 : 0;
      
      return (
        <div 
          key={key}
          className="bg-secondary/50 rounded-lg p-2.5 text-center hover:bg-secondary/70 transition-colors"
        >
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <PollutantIcon name={key} />
          </div>
          <div className="text-sm font-bold font-mono text-foreground">{value.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">{formatPollutantName(key)}</div>
          {trend && (
            <div className={cn(
              "text-xs mt-1 flex items-center justify-center",
              trend === "up" ? "text-destructive" : "text-success"
            )}>
              {trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const PredictionCard: React.FC<{ predictions: Predictions; label: string }> = ({ predictions, label }) => (
  <div className="bg-secondary/30 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-3">
      <BarChart3 className="w-4 h-4 text-primary" />
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <div className="space-y-2">
      {(Object.entries(predictions) as [string, number][]).map(([model, value]) => (
        <div key={model} className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{model}</span>
          <span className="text-sm font-mono font-medium text-foreground">{value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  </div>
);

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ result, selectedBBox }) => {
  if (!selectedBBox) {
    return (
      <div className="glass-panel p-6 w-80 animate-fade-in">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Area Selected</h3>
          <p className="text-sm text-muted-foreground max-w-[200px]">
            Draw an area on the map to view air quality analysis
          </p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass-panel p-6 w-80 animate-fade-in">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Analyzing area...</p>
        </div>
      </div>
    );
  }

  const { scenarios } = result;

  return (
    <div className="glass-panel p-4 w-96 max-h-[calc(100vh-8rem)] overflow-y-auto animate-slide-in-right">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground">Air Quality Analysis</h2>
      </div>

      {/* Current Analysis */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{scenarios.current.label}</span>
        </div>
        
        <AQIGauge value={scenarios.current.average_aqi} status={scenarios.current.status} />
        
        <PollutantGrid means={scenarios.current.means} futureMeans={scenarios.future.means} />
        
        <PredictionCard predictions={scenarios.current.predictions} label="Model Predictions" />
      </div>

      {/* Divider */}
      <div className="h-px bg-border/50 my-4" />

      {/* Future Projection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-warning" />
          <span className="text-sm font-medium text-foreground">Future (5 years)</span>
        </div>
        
        <AQIGauge value={scenarios.future.average_aqi} status={scenarios.future.status} />
        
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium text-warning">Projected Change</span>
          </div>
          <p className="text-xs text-muted-foreground">
            AQI is projected to change based on the scenario:{" "}
            <span className={cn(
              "font-mono font-medium p-1 rounded-sm",
              scenarios.future.average_aqi > scenarios.current.average_aqi ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
            )}>
              {scenarios.future.average_aqi > scenarios.current.average_aqi ? <TrendingUp className="inline w-3 h-3 mr-1" /> : <TrendingDown className="inline w-3 h-3 mr-1" />}
              {scenarios.future.average_aqi > scenarios.current.average_aqi ? "Increasing" : "Decreasing"}
            </span>
          </p>
        </div>
        
        <PredictionCard predictions={scenarios.future.predictions} label="Future Predictions" />
      </div>
    </div>
  );
};

export default AnalysisPanel;
