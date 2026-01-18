import React, { useEffect, useRef, useState } from "react";
import { Globe, AlertCircle } from "lucide-react";
import { analyzeBBox } from "./api/analysis";

const CesiumMap = () => {
  const cesiumContainer = useRef(null);
  const viewerRef = useRef(null);
  const handlerRef = useRef(null);
  const previewRectRef = useRef(null);
  const areaDragStartRef = useRef(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [operation, setOperation] = useState(null); 
  // "DELETE" | "RESTORE" | null
  const [deletedCount, setDeletedCount] = useState(0);

  const [method, setMethod] = useState(null);     
  // "CLICK" | "AREA" | null

  const operationRef = useRef(null);
  const methodRef = useRef(null);

  useEffect(() => {
    operationRef.current = operation;
  }, [operation]);

  useEffect(() => {
    methodRef.current = method;
  }, [method]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // MODES
  const [mode, setMode] = useState("VIEW");
  const modeRef = useRef(mode);

  // SELECTION
  const [selectedBBox, setSelectedBBox] = useState(null);
  const selectedBBoxRef = useRef(selectedBBox);
  const selectionEntityRef = useRef(null);
  const isSelectingRef = useRef(false);
  const dragStartRef = useRef(null);

  // DELETE
  const deletedFeaturesRef = useRef(new Set());

  // PREVIEW
  const previewEntityRef = useRef(null);

  // Update refs when state changes
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    selectedBBoxRef.current = selectedBBox;
  }, [selectedBBox]);

  // ---------- HELPERS ----------
  const clearSelection = () => {
    setSelectedBBox(null);
    isSelectingRef.current = false;
    dragStartRef.current = null;

    if (selectionEntityRef.current && viewerRef.current) {
      viewerRef.current.entities.remove(selectionEntityRef.current);
      selectionEntityRef.current = null;
    }

    if (previewEntityRef.current && viewerRef.current) {
      viewerRef.current.entities.remove(previewEntityRef.current);
      previewEntityRef.current = null;
    }

    // Restore full camera control
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
  };

  const isInsideBBox = (lat, lon, bbox) => {
    if (!bbox) return false;
    return (
      lat >= bbox.minLat &&
      lat <= bbox.maxLat &&
      lon >= bbox.minLon &&
      lon <= bbox.maxLon
    );
  };

  const createGroundRectanglePrimitive = (viewer, bbox) => {
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
          color: Cesium.Color.LIME,
        }),
      }),
    });

    viewer.scene.primitives.add(primitive);
    return primitive;
  };


  // ---------- INIT CESIUM ----------
  useEffect(() => {
    window.CESIUM_BASE_URL =
      "https://cdnjs.cloudflare.com/ajax/libs/cesium/1.95.0/";

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/cesium/1.95.0/Widgets/widgets.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/cesium/1.95.0/Cesium.js";
    script.async = true;

    script.onload = () => {
      try {
        const Cesium = window.Cesium;

        Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
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

        // 1️⃣ Set camera HIGH first (terrain needs this)
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            77.5946,
            12.9716,
            150000 // IMPORTANT
          ),
        });

        // 2️⃣ Add OSM buildings AFTER camera
        const osmBuildings = Cesium.createOsmBuildings();
        viewer.scene.primitives.add(osmBuildings);

        // 3️⃣ Only NOW enable depth testing
        viewer.scene.globe.depthTestAgainstTerrain = true;

        // ---------- EVENTS ----------
        const pickSurface = (x, y) => {
          const Cesium = window.Cesium;
          const cart = viewer.scene.pickPosition(new Cesium.Cartesian2(x, y));
          if (cart) return cart;

          // Fallback to ellipsoid if sky or no depth
          return viewer.camera.pickEllipsoid(new Cesium.Cartesian2(x, y));
        };

        const handler = new Cesium.ScreenSpaceEventHandler(
          viewer.scene.canvas
        );
        handlerRef.current = handler;

        handler.setInputAction((movement) => {
          if (!operationRef.current || methodRef.current !== "CLICK") return;

          const Cesium = window.Cesium;
          const picked = viewer.scene.pick(movement.position);

          // DELETE needs a picked feature
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

          // RESTORE does NOT need picking
          if (operationRef.current === "RESTORE") {
            const Cesium = window.Cesium;

            const ray = viewer.camera.getPickRay(movement.position);
            const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
            if (!cartesian) return;

            const clicked = Cesium.Cartographic.fromCartesian(cartesian);

            let closest = null;
            let minDist = Infinity;

            deletedFeaturesRef.current.forEach((item) => {
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

        // PREVIEW DURING DRAG
        handler.setInputAction((movement) => {
          if (modeRef.current !== "INTERACTIVE" || !isSelectingRef.current || !dragStartRef.current) return;
          
          const Cesium = window.Cesium;
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

          const rect = Cesium.Rectangle.fromDegrees(
            minLon,
            minLat,
            maxLon,
            maxLat
          );

          // Update or create preview rectangle
          previewRectRef.current = rect;

          if (!previewEntityRef.current) {
            previewEntityRef.current = viewer.entities.add({
              rectangle: {
                coordinates: new Cesium.CallbackProperty(() => {
                  return previewRectRef.current;
                }, false),
                material: Cesium.Color.CYAN.withAlpha(0.25),
                outline: true,
                outlineColor: Cesium.Color.CYAN,
                outlineWidth: 2,
              },
            });
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // START SELECTION
        handler.setInputAction((movement) => {
          if (
            methodRef.current === "AREA" &&
            operationRef.current &&
            selectedBBoxRef.current
          ) {
            areaDragStartRef.current = movement.position;
            return;
          }

          if (
            modeRef.current === "INTERACTIVE" &&
            !selectedBBoxRef.current &&
            !isSelectingRef.current
          ) {
            isSelectingRef.current = true;
            dragStartRef.current = movement.position; 
          }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        // END SELECTION
        handler.setInputAction((movement) => {
          if (
            areaDragStartRef.current &&
            selectedBBoxRef.current &&
            methodRef.current === "AREA" &&
            operationRef.current
          ) {
            const start = areaDragStartRef.current;
            const end = movement.position;
            areaDragStartRef.current = null;

            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);

            const step = 20; // sampling resolution
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

                    const cart = viewer.scene.pickPosition(
                      new Cesium.Cartesian2(x, y)
                    );
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
                    [...deletedFeaturesRef.current].forEach(item => {
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
          //-------------------------------------
          if (!isSelectingRef.current || !dragStartRef.current) return;

          const Cesium = window.Cesium;
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
            minLat: Cesium.Math.toDegrees(
              Math.min(tlc.latitude, brc.latitude)
            ),
            maxLat: Cesium.Math.toDegrees(
              Math.max(tlc.latitude, brc.latitude)
            ),
            minLon: Cesium.Math.toDegrees(
              Math.min(tlc.longitude, brc.longitude)
            ),
            maxLon: Cesium.Math.toDegrees(
              Math.max(tlc.longitude, brc.longitude)
            ),
          };

          console.log("📦 Selected BBox:", bbox);

          setSelectedBBox(bbox);
          analyzeBBox(bbox)
          .then((data) => {
            setAnalysisResult(data);
          })
          .catch((err) => {
            console.error(err);
          });

          console.log("📦 BBox being sent:", bbox);
          isSelectingRef.current = false;
          dragStartRef.current = null;

          const centerLon = (bbox.minLon + bbox.maxLon) / 2;
          const centerLat = (bbox.minLat + bbox.maxLat) / 2;
          
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              centerLon,
              centerLat,
              1200 // height in meters (adjust)
            ),
            orientation: {
              heading: Cesium.Math.toRadians(0),        // facing north
              pitch: Cesium.Math.toRadians(-35),        // 🔥 3D tilt
              roll: 0,
            },
            duration: 1.5,
          });

          // Remove preview
          if (previewEntityRef.current) {
            viewer.entities.remove(previewEntityRef.current);
            previewEntityRef.current = null;
          }

          // Add final selection rectangle
          selectionEntityRef.current = createGroundRectanglePrimitive(viewer, bbox);

          // Lock camera but allow zoom
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
      } catch (e) {
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

  // ---------- UI ----------
  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black text-white">
        <AlertCircle className="mr-2" /> {error}
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black text-white">
          <Globe className="animate-spin mr-2" /> Loading…
        </div>
      )}

      <div ref={cesiumContainer} className="w-full h-full" />
      
      {/* Status indicator */}
      <div className="absolute top-4 right-4 z-10 bg-black/80 text-white px-4 py-2 rounded-lg font-mono text-sm">
        {mode === "INTERACTIVE" && !selectedBBox && "🟦 Interactive Mode: Draw area"}
        {mode === "VIEW" && selectedBBox && "🟩 Area selected"}
        {mode === "VIEW" && !selectedBBox && "🗺️ View mode"}
      </div>

      {/* Control buttons */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => {
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
          disabled={mode === "INTERACTIVE" && !selectedBBox}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Interactive Mode
        </button>

        <button 
          onClick={clearSelection}
          disabled={!selectedBBox}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Clear Selection
        </button>

        {/* DELETE */}
        <button
          disabled={!selectedBBox}
          onClick={() => {  
            setOperation("DELETE");
            setMethod("CLICK");
          }}
        >
          Delete (Click)
        </button>

        <button
          disabled={!selectedBBox}
          onClick={() => {
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
        >
          Delete (Area)
        </button>


        {/* RESTORE */}
        <button
          disabled={deletedCount === 0}
          onClick={() => {
            setOperation("RESTORE");
            setMethod("CLICK");
          }}
        >
          Restore (Click)
        </button>

        <button
          disabled={deletedFeaturesRef.current.size === 0}
          onClick={() => {
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
        >
          Restore (Area)
        </button>

        <button 
          onClick={() => {
            setMode("VIEW");
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
          disabled={mode === "VIEW"}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          View Mode
        </button>
      </div>

      {/* Selected bbox info */}
      {selectedBBox && (
        <div className="absolute bottom-4 left-4 z-10 bg-black/80 text-white px-4 py-3 rounded-lg font-mono text-xs max-w-sm">
          <div className="font-bold mb-1">Selected Area:</div>
          <div>Lat: {selectedBBox.minLat.toFixed(6)} to {selectedBBox.maxLat.toFixed(6)}</div>
          <div>Lon: {selectedBBox.minLon.toFixed(6)} to {selectedBBox.maxLon.toFixed(6)}</div>
        </div>
      )}
      {analysisResult && (
        <div className="absolute bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-sm w-72">
          <div className="font-bold mb-2">Analysis</div>
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(analysisResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default CesiumMap;