import React from "react";
import { Globe2 } from "lucide-react";

const LoadingOverlay: React.FC = () => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Globe2 className="w-8 h-8 text-primary" />
        </div>
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">Loading GeoVision</h2>
      <p className="text-sm text-muted-foreground">Initializing 3D terrain and buildings...</p>
      <div className="mt-6 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
};

export default LoadingOverlay;
