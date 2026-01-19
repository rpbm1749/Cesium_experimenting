import CesiumMap from "@/components/CesiumMap";
import ErrorBoundary from "@/components/ErrorBoundary";

const Index = () => {
  return (
    <ErrorBoundary>
      <CesiumMap />
    </ErrorBoundary>
  );
};

export default Index;
