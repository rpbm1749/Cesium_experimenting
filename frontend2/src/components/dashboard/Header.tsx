import React from "react";
import { Globe2, Satellite } from "lucide-react";

const Header: React.FC = () => {
  return (
    <header className="glass-panel-dark px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Globe2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            GeoVision<span className="text-primary">AI</span>
          </h1>
          <p className="text-xs text-muted-foreground">Environmental Analysis Platform</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="text-muted-foreground">Live Data</span>
        </div>
        
        <div className="h-6 w-px bg-border" />
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Satellite className="w-4 h-4" />
          <span>Bangalore, India</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
