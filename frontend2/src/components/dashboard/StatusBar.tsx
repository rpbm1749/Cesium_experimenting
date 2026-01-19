import React from "react";
import { MapPin, MousePointer2, Eye, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  mode: string;
  selectedBBox: any;
}

const StatusBar: React.FC<StatusBarProps> = ({ mode, selectedBBox }) => {
  const getStatusConfig = () => {
    if (mode === "INTERACTIVE" && !selectedBBox) {
      return {
        icon: <MousePointer2 className="w-4 h-4" />,
        text: "Draw area on map to analyze",
        color: "text-primary",
        bgColor: "bg-primary/10",
        borderColor: "border-primary/30",
        pulse: true,
      };
    }
    if (mode === "VIEW" && selectedBBox) {
      return {
        icon: <Activity className="w-4 h-4" />,
        text: "Area selected — Analysis ready",
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/30",
        pulse: false,
      };
    }
    return {
      icon: <Eye className="w-4 h-4" />,
      text: "View mode — Navigate the map",
      color: "text-muted-foreground",
      bgColor: "bg-muted/50",
      borderColor: "border-border",
      pulse: false,
    };
  };

  const config = getStatusConfig();

  return (
    <div
      className={cn(
        "glass-panel px-4 py-2.5 flex items-center gap-3 animate-fade-in border",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className={cn("flex items-center gap-2", config.color)}>
        {config.pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        )}
        {config.icon}
      </div>
      <span className={cn("text-sm font-medium", config.color)}>
        {config.text}
      </span>
      
      {selectedBBox && (
        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border/50">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">
            {selectedBBox.minLat.toFixed(4)}°, {selectedBBox.minLon.toFixed(4)}°
          </span>
        </div>
      )}
    </div>
  );
};

export default StatusBar;
