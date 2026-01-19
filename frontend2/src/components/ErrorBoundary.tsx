import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex items-center justify-center bg-background text-foreground">
          <div className="p-8 flex flex-col items-center gap-4 bg-card rounded-lg border border-border shadow-lg">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <pre className="text-sm text-muted-foreground bg-muted p-4 rounded max-w-lg overflow-auto">
              {this.state.error?.message}
            </pre>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
