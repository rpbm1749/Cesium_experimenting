import React from "react";
import { 
  MousePointer2, 
  Eraser, 
  RotateCcw, 
  Eye, 
  Square, 
  Trash2,
  Undo2,
  Layers
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ControlPanelProps {
  mode: string;
  selectedBBox: any;
  deletedCount: number;
  operation: string | null;
  method: string | null;
  onInteractiveMode: () => void;
  onClearSelection: () => void;
  onDeleteClick: () => void;
  onDeleteArea: () => void;
  onRestoreClick: () => void;
  onRestoreArea: () => void;
  onViewMode: () => void;
}

const ControlButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "destructive" | "success" | "primary";
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}> = ({ onClick, disabled, active, variant = "default", icon, label, shortcut }) => {
  const variants = {
    default: "bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border",
    destructive: "bg-destructive/20 hover:bg-destructive/30 text-destructive border-destructive/30",
    success: "bg-success/20 hover:bg-success/30 text-success border-success/30",
    primary: "bg-primary/20 hover:bg-primary/30 text-primary border-primary/30",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-secondary",
        variants[variant],
        active && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-xs text-muted-foreground font-mono bg-background/50 px-1.5 py-0.5 rounded">
          {shortcut}
        </span>
      )}
    </button>
  );
};

const ControlPanel: React.FC<ControlPanelProps> = ({
  mode,
  selectedBBox,
  deletedCount,
  operation,
  method,
  onInteractiveMode,
  onClearSelection,
  onDeleteClick,
  onDeleteArea,
  onRestoreClick,
  onRestoreArea,
  onViewMode,
}) => {
  return (
    <div className="glass-panel p-4 w-64 animate-fade-in">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
        <Layers className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground">Controls</h2>
      </div>

      <div className="space-y-2">
        {/* Mode Selection */}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Mode</span>
          <div className="space-y-1.5">
            <ControlButton
              onClick={onInteractiveMode}
              disabled={mode === "INTERACTIVE" && !selectedBBox}
              active={mode === "INTERACTIVE"}
              variant="primary"
              icon={<MousePointer2 className="w-4 h-4" />}
              label="Select Area"
            />
            <ControlButton
              onClick={onViewMode}
              disabled={mode === "VIEW"}
              icon={<Eye className="w-4 h-4" />}
              label="View Mode"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50 my-3" />

        {/* Edit Actions */}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Edit Buildings</span>
          <div className="space-y-1.5">
            <ControlButton
              onClick={onDeleteClick}
              disabled={!selectedBBox}
              active={operation === "DELETE" && method === "CLICK"}
              variant="destructive"
              icon={<Trash2 className="w-4 h-4" />}
              label="Delete (Click)"
            />
            <ControlButton
              onClick={onDeleteArea}
              disabled={!selectedBBox}
              active={operation === "DELETE" && method === "AREA"}
              variant="destructive"
              icon={<Square className="w-4 h-4" />}
              label="Delete (Area)"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50 my-3" />

        {/* Restore Actions */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Restore</span>
            {deletedCount > 0 && (
              <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full font-mono">
                {deletedCount}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <ControlButton
              onClick={onRestoreClick}
              disabled={deletedCount === 0}
              active={operation === "RESTORE" && method === "CLICK"}
              variant="success"
              icon={<Undo2 className="w-4 h-4" />}
              label="Restore (Click)"
            />
            <ControlButton
              onClick={onRestoreArea}
              disabled={deletedCount === 0}
              active={operation === "RESTORE" && method === "AREA"}
              variant="success"
              icon={<RotateCcw className="w-4 h-4" />}
              label="Restore (Area)"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50 my-3" />

        {/* Clear */}
        <ControlButton
          onClick={onClearSelection}
          disabled={!selectedBBox}
          variant="destructive"
          icon={<Eraser className="w-4 h-4" />}
          label="Clear Selection"
        />
      </div>
    </div>
  );
};

export default ControlPanel;
