import React from "react";
import { MapPin, Maximize2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoordinatesPanelProps {
  selectedBBox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } | null;
}

const CoordinatesPanel: React.FC<CoordinatesPanelProps> = ({ selectedBBox }) => {
  const [copied, setCopied] = React.useState(false);

  if (!selectedBBox) return null;

  const handleCopy = () => {
    const text = `${selectedBBox.minLat.toFixed(6)}, ${selectedBBox.minLon.toFixed(6)} to ${selectedBBox.maxLat.toFixed(6)}, ${selectedBBox.maxLon.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const areaWidth = Math.abs(selectedBBox.maxLon - selectedBBox.minLon) * 111.32;
  const areaHeight = Math.abs(selectedBBox.maxLat - selectedBBox.minLat) * 110.574;
  const areaKm = (areaWidth * areaHeight).toFixed(2);

  return (
    <div className="glass-panel p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Selected Region</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-secondary/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground mb-1">Min Lat</div>
            <div className="text-sm font-mono text-foreground">{selectedBBox.minLat.toFixed(6)}°</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground mb-1">Max Lat</div>
            <div className="text-sm font-mono text-foreground">{selectedBBox.maxLat.toFixed(6)}°</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground mb-1">Min Lon</div>
            <div className="text-sm font-mono text-foreground">{selectedBBox.minLon.toFixed(6)}°</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground mb-1">Max Lon</div>
            <div className="text-sm font-mono text-foreground">{selectedBBox.maxLon.toFixed(6)}°</div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Maximize2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Area:</span>
          <span className="text-sm font-mono font-medium text-foreground">{areaKm} km²</span>
        </div>
      </div>
    </div>
  );
};

export default CoordinatesPanel;
