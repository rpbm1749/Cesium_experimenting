import React, { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { analyzeBBox, type AnalysisResult } from "@/api/analysis";
import Header from "./dashboard/Header";
import ControlPanel from "./dashboard/ControlPanel";
import StatusBar from "./dashboard/StatusBar";
import AnalysisPanel from "./dashboard/AnalysisPanel";
import LoadingOverlay from "./dashboard/LoadingOverlay";
import CoordinatesPanel from "./dashboard/CoordinatesPanel";

declare global {
  interface Window {
    Cesium: any;
    CESIUM_BASE_URL: string;
  }
}

const CesiumMap: React.FC = () => {
  const cesiumContainer = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const handlerRef = useRef<any>(null);
  const previewRectRef = useRef<any>(null);
  const areaDragStartRef = useRef<any>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [operation, setOperation] = useState<"DELETE" | "RESTORE" | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);

  const [method, setMethod] = useState<"CLICK" | "AREA" | null>(null);

  const operationRef = useRef<"DELETE" | "RESTORE" | null>(null);
  const methodRef = useRef<"CLICK" | "AREA" | null>(null);

  useEffect(() => {
    operationRef.current = operation;
  }, [operation]);

  useEffect(() => {
    methodRef.current = method;
  }, [method]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState("VIEW");
  const modeRef = useRef(mode);

  const [selectedBBox, setSelectedBBox] = useState<{
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } | null>(null);
  const selectedBBoxRef = useRef(selectedBBox);
  const selectionEntityRef = useRef<any>(null);
  const isSelectingRef = useRef(false);
  const dragStartRef = useRef<any>(null);

  const deletedFeaturesRef = useRef(new Set<any>());

  const previewEntityRef = useRef<any>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    selectedBBoxRef.current = selectedBBox;
  }, [selectedBBox]);

  const clearSelection = () => {
    setSelectedBBox(null);
    setAnalysisResult(null);
    isSelectingRef.current = false;
    dragStartRef.current = null;

    if (selectionEntityRef.current && viewerRef.current) {
      viewerRef.current.scene.primitives.remove(selectionEntityRef.current);
      selectionEntityRef.current = null;
    }

    if (previewEntityRef.current && viewerRef.current) {
      viewerRef.current.entities.remove(previewEntityRef.current);
      previewEntityRef.current = null;
    }

    if (viewerRef.current) {
      const controller = viewerRef.current.scene.screenSpaceCameraController;
      controller.enableInputs = true;
      controller.enableTranslate = true;
      controller.enableRotate = true;
      controller.enableTilt = true;
      controller.enableLook = true;
      controller.enableZoom = true;
    }

    setMode("VIEW");
    setOperation(null);
    setMethod(null);
  };

  const createGroundRectanglePrimitive = (viewer: any, bbox: any) => {
    const Cesium = window.Cesium;

    const positions = Cesium.Cartesian3.fromDegreesArray([
      bbox.minLon, bbox.minLat,
      bbox.maxLon, bbox.minLat,
      bbox.maxLon, bbox.maxLat,
      bbox.minLon, bbox.maxLat,
      bbox.minLon, bbox.minLat,
    ]);

    const geometry = new Cesium.GroundPolylineGeometry({
      positions,
      width: 4,
    });

    const instance = new Cesium.GeometryInstance({
      geometry,
    });

    const primitive = new Cesium.GroundPolylinePrimitive({
      geometryInstances: instance,
      appearance: new Cesium.PolylineMaterialAppearance({
        material: Cesium.Material.fromType("Color", {
          color: Cesium.Color.fromCssColorString("#22d3ee"),
        }),
      }),
    });

    viewer.scene.primitives.add(primitive);
    return primitive;
  };

  useEffect(() => {
    window.CESIUM_BASE_URL = "https://cdnjs.cloudflare.com/ajax/libs/cesium/1.95.0/";

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/cesium/1.95.0/Widgets/widgets.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/cesium/1.95.0/Cesium.js";
    script.async = true;

    script.onload = () => {
      try {
        const Cesium = window.Cesium;

        Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYWY3ZjBiZS1jNDQ2LTQzNzEtYTg5YS1hNmRhNzA0YjQyOTIiLCJpZCI6MzgwMzY2LCJpYXQiOjE3Njg3NDU2MzZ9.sOrpGkvhknApJ0eaYavbjfAvqvozs99jmixYtbW5ZzU";
        
        const viewer = new Cesium.Viewer(cesiumContainer.current, {
          imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            credit: "© OpenStreetMap contributors",
          }),
          terrainProvider: Cesium.createWorldTerrain(),
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: true,
        });

        viewerRef.current = viewer;

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 150000),
        });

        const osmBuildings = Cesium.createOsmBuildings();
        viewer.scene.primitives.add(osmBuildings);

        viewer.scene.globe.depthTestAgainstTerrain = true;

        const pickSurface = (x: number, y: number) => {
          const cart = viewer.scene.pickPosition(new Cesium.Cartesian2(x, y));
          if (cart) return cart;
          return viewer.camera.pickEllipsoid(new Cesium.Cartesian2(x, y));
        };

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handlerRef.current = handler;

        handler.setInputAction((movement: any) => {
          if (!operationRef.current || methodRef.current !== "CLICK") return;

          const picked = viewer.scene.pick(movement.position);

          if (operationRef.current === "DELETE") {
            if (!(picked instanceof Cesium.Cesium3DTileFeature)) return;

            const cartesian = viewer.scene.pickPosition(movement.position);
            if (!cartesian) return;

            picked.show = false;

            deletedFeaturesRef.current.add({
              feature: picked,
              position: Cesium.Cartographic.fromCartesian(cartesian),
            });
            setDeletedCount(deletedFeaturesRef.current.size);
          }

          if (operationRef.current === "RESTORE") {
            const ray = viewer.camera.getPickRay(movement.position);
            const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
            if (!cartesian) return;

            const clicked = Cesium.Cartographic.fromCartesian(cartesian);

            let closest: any = null;
            let minDist = Infinity;

            deletedFeaturesRef.current.forEach((item: any) => {
              const dLat = item.position.latitude - clicked.latitude;
              const dLon = item.position.longitude - clicked.longitude;
              const dist = dLat * dLat + dLon * dLon;

              if (dist < minDist) {
                minDist = dist;
                closest = item;
              }
            });

            if (!closest) return;

            closest.feature.show = true;
            deletedFeaturesRef.current.delete(closest);
            setDeletedCount(deletedFeaturesRef.current.size);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((movement: any) => {
          if (modeRef.current !== "INTERACTIVE" || !isSelectingRef.current || !dragStartRef.current) return;

          const end = movement.endPosition;

          const minX = Math.min(dragStartRef.current.x, end.x);
          const maxX = Math.max(dragStartRef.current.x, end.x);
          const minY = Math.min(dragStartRef.current.y, end.y);
          const maxY = Math.max(dragStartRef.current.y, end.y);

          const tlCartesian = pickSurface(minX, minY);
          const brCartesian = pickSurface(maxX, maxY);

          if (!tlCartesian || !brCartesian) return;

          const tlc = Cesium.Cartographic.fromCartesian(tlCartesian);
          const brc = Cesium.Cartographic.fromCartesian(brCartesian);

          const minLon = Cesium.Math.toDegrees(Math.min(tlc.longitude, brc.longitude));
          const minLat = Cesium.Math.toDegrees(Math.min(tlc.latitude, brc.latitude));
          const maxLon = Cesium.Math.toDegrees(Math.max(tlc.longitude, brc.longitude));
          const maxLat = Cesium.Math.toDegrees(Math.max(tlc.latitude, brc.latitude));

          const rect = Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat);

          previewRectRef.current = rect;

          if (!previewEntityRef.current) {
            previewEntityRef.current = viewer.entities.add({
              rectangle: {
                coordinates: new Cesium.CallbackProperty(() => previewRectRef.current, false),
                material: Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.25),
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString("#22d3ee"),
                outlineWidth: 2,
              },
            });
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction((movement: any) => {
          if (methodRef.current === "AREA" && operationRef.current && selectedBBoxRef.current) {
            areaDragStartRef.current = movement.position;
            return;
          }

          if (modeRef.current === "INTERACTIVE" && !selectedBBoxRef.current && !isSelectingRef.current) {
            isSelectingRef.current = true;
            dragStartRef.current = movement.position;
          }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        handler.setInputAction((movement: any) => {
          if (areaDragStartRef.current && selectedBBoxRef.current && methodRef.current === "AREA" && operationRef.current) {
            const start = areaDragStartRef.current;
            const end = movement.position;
            areaDragStartRef.current = null;

            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);

            const step = 20;
            const affected = new WeakSet();

            for (let x = minX; x <= maxX; x += step) {
              for (let y = minY; y <= maxY; y += step) {
                const picked = viewer.scene.pick(new Cesium.Cartesian2(x, y));
                if (!(picked instanceof Cesium.Cesium3DTileFeature)) continue;
                if (affected.has(picked)) continue;

                affected.add(picked);

                if (operationRef.current === "DELETE") {
                  if (picked.show !== false) {
                    picked.show = false;

                    const cart = viewer.scene.pickPosition(new Cesium.Cartesian2(x, y));
                    if (cart) {
                      deletedFeaturesRef.current.add({
                        feature: picked,
                        position: Cesium.Cartographic.fromCartesian(cart),
                      });
                    }
                  }
                }

                if (operationRef.current === "RESTORE") {
                  if (picked.show === false) {
                    picked.show = true;
                    [...deletedFeaturesRef.current].forEach((item: any) => {
                      if (item.feature === picked) {
                        deletedFeaturesRef.current.delete(item);
                      }
                    });
                  }
                }
              }
            }
            setDeletedCount(deletedFeaturesRef.current.size);
            const c = viewer.scene.screenSpaceCameraController;
            c.enableRotate = true;
            c.enableTranslate = true;
            c.enableZoom = true;
            c.enableTilt = true;
            c.enableLook = true;

            return;
          }

          if (!isSelectingRef.current || !dragStartRef.current) return;

          const end = movement.position;

          const minX = Math.min(dragStartRef.current.x, end.x);
          const maxX = Math.max(dragStartRef.current.x, end.x);
          const minY = Math.min(dragStartRef.current.y, end.y);
          const maxY = Math.max(dragStartRef.current.y, end.y);

          const tlCartesian = pickSurface(minX, minY);
          const brCartesian = pickSurface(maxX, maxY);

          if (!tlCartesian || !brCartesian) {
            isSelectingRef.current = false;
            dragStartRef.current = null;
            if (previewEntityRef.current) {
              viewer.entities.remove(previewEntityRef.current);
              previewEntityRef.current = null;
            }
            return;
          }

          const tlc = Cesium.Cartographic.fromCartesian(tlCartesian);
          const brc = Cesium.Cartographic.fromCartesian(brCartesian);

          const bbox = {
            minLat: Cesium.Math.toDegrees(Math.min(tlc.latitude, brc.latitude)),
            maxLat: Cesium.Math.toDegrees(Math.max(tlc.latitude, brc.latitude)),
            minLon: Cesium.Math.toDegrees(Math.min(tlc.longitude, brc.longitude)),
            maxLon: Cesium.Math.toDegrees(Math.max(tlc.longitude, brc.longitude)),
          };

          setSelectedBBox(bbox);
          analyzeBBox(bbox)
            .then((data) => {
              console.log("Analysis Result:", data);
              setAnalysisResult(data);
            })
            .catch((err) => console.error(err));
          
          

          isSelectingRef.current = false;
          dragStartRef.current = null;

          const centerLon = (bbox.minLon + bbox.maxLon) / 2;
          const centerLat = (bbox.minLat + bbox.maxLat) / 2;

          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 1200),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-35),
              roll: 0,
            },
            duration: 1.5,
          });

          if (previewEntityRef.current) {
            viewer.entities.remove(previewEntityRef.current);
            previewEntityRef.current = null;
          }

          selectionEntityRef.current = createGroundRectanglePrimitive(viewer, bbox);

          setMode("VIEW");
          const controller = viewer.scene.screenSpaceCameraController;
          controller.enableTranslate = true;
          controller.enableZoom = true;
          controller.enableRotate = true;

          if (previewEntityRef.current) {
            viewer.entities.remove(previewEntityRef.current);
            previewEntityRef.current = null;
            previewRectRef.current = null;
          }
        }, Cesium.ScreenSpaceEventType.LEFT_UP);

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 50000),
        });

        viewer.scene.globe.depthTestAgainstTerrain = true;

        setIsLoading(false);
      } catch (e: any) {
        setError(e.message);
      }
    };

    document.body.appendChild(script);

    return () => {
      if (handlerRef.current) handlerRef.current.destroy();
      if (viewerRef.current) viewerRef.current.destroy();
      if (link.parentNode) document.head.removeChild(link);
      if (script.parentNode) document.body.removeChild(script);
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="glass-panel p-8 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Error Loading Map</h2>
          <p className="text-sm text-muted-foreground text-center max-w-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background">
      {isLoading && <LoadingOverlay />}

      <Header />

      <div className="flex-1 relative">
        <div ref={cesiumContainer} className="absolute inset-0" />

        {/* Status Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <StatusBar mode={mode} selectedBBox={selectedBBox} />
        </div>

        {/* Control Panel - Left */}
        <div className="absolute top-4 left-4 z-10">
          <ControlPanel
            mode={mode}
            selectedBBox={selectedBBox}
            deletedCount={deletedCount}
            operation={operation}
            method={method}
            onInteractiveMode={() => {
              if (selectedBBox) {
                clearSelection();
              }
              setMode("INTERACTIVE");

              if (viewerRef.current) {
                const controller = viewerRef.current.scene.screenSpaceCameraController;
                controller.enableInputs = true;
                controller.enableTranslate = false;
                controller.enableRotate = false;
                controller.enableTilt = false;
                controller.enableLook = false;
                controller.enableZoom = true;
              }
            }}
            onClearSelection={clearSelection}
            onDeleteClick={() => {
              setOperation("DELETE");
              setMethod("CLICK");
            }}
            onDeleteArea={() => {
              setOperation("DELETE");
              setMethod("AREA");
              setMode("VIEW");

              const c = viewerRef.current.scene.screenSpaceCameraController;
              c.enableRotate = false;
              c.enableTranslate = false;
              c.enableZoom = false;
              c.enableTilt = false;
              c.enableLook = false;
            }}
            onRestoreClick={() => {
              setOperation("RESTORE");
              setMethod("CLICK");
            }}
            onRestoreArea={() => {
              setOperation("RESTORE");
              setMethod("AREA");
              setMode("VIEW");

              const c = viewerRef.current.scene.screenSpaceCameraController;
              c.enableRotate = false;
              c.enableTranslate = false;
              c.enableZoom = false;
              c.enableTilt = false;
              c.enableLook = false;
            }}
            onViewMode={() => {
              setMode("VIEW");
              setOperation(null);
              setMethod(null);
              if (viewerRef.current) {
                const controller = viewerRef.current.scene.screenSpaceCameraController;
                if (selectedBBox) {
                  controller.enableTranslate = false;
                  controller.enableRotate = false;
                  controller.enableTilt = false;
                  controller.enableLook = false;
                  controller.enableZoom = true;
                } else {
                  controller.enableInputs = true;
                }
              }
            }}
          />
        </div>

        {/* Analysis Panel - Right */}
        <div className="absolute top-4 right-4 z-10">
          <AnalysisPanel result={analysisResult} selectedBBox={selectedBBox} />
        </div>

        {/* Coordinates Panel - Bottom Left */}
        <div className="absolute bottom-4 left-4 z-10">
          <CoordinatesPanel selectedBBox={selectedBBox} />
        </div>
      </div>
    </div>
  );
};

export default CesiumMap;
