import React, { useEffect, useRef, useState } from "react";
import { Globe, MapPin, Search, Home, AlertCircle } from "lucide-react";

const CesiumMap = () => {
  const cesiumContainer = useRef(null);
  const viewerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [del, setDel] = useState(false);
  const delRef = useRef(false);
  const cesiumReadyRef = useRef(false);
  useEffect(() => {
    delRef.current = del;
  }, [del]);

  const [restoreMode, setRestoreMode] = useState(false);

  const restoreModeRef = useRef(false);
  const deletedFeaturesRef = useRef(new Set());

  useEffect(() => {
    restoreModeRef.current = restoreMode;
  }, [restoreMode]);

  const disableCamera = (viewer) => {
    const c = viewer.scene.screenSpaceCameraController;
    c.enableRotate = false;
    c.enableTranslate = false;
    c.enableZoom = false;
    c.enableTilt = false;
    c.enableLook = false;
  };

  const enableCamera = (viewer) => {
    const c = viewer.scene.screenSpaceCameraController;
    c.enableRotate = true;
    c.enableTranslate = true;
    c.enableZoom = true;
    c.enableTilt = true;
    c.enableLook = true;
  };

  const [rectDeleteMode, setRectDeleteMode] = useState(false);
  const [rectRestoreMode, setRectRestoreMode] = useState(false);

  const rectDeleteModeRef = useRef(false);
  const rectRestoreModeRef = useRef(false);

  useEffect(() => {
    rectDeleteModeRef.current = rectDeleteMode;
  }, [rectDeleteMode]);

  useEffect(() => {
    rectRestoreModeRef.current = rectRestoreMode;
  }, [rectRestoreMode]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !cesiumReadyRef.current) return;
    if (rectDeleteMode || rectRestoreMode) {
      disableCamera(viewer);
    } else {
      enableCamera(viewer);
    }
  }, [rectDeleteMode, rectRestoreMode]);

  const [dragRect, setDragRect] = useState(null);

  useEffect(() => {
    window.CESIUM_BASE_URL = "https://cdnjs.cloudflare.com/ajax/libs/cesium/1.95.0/";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/cesium/1.95.0/Widgets/widgets.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/cesium/1.95.0/Cesium.js";
    script.async = true;

    script.onerror = () => {
      setError("Failed to load Cesium");
      setIsLoading(false);
    };
    script.onload = async () => {
      try {
        const Cesium = window.Cesium;

        Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

        // Create viewer with minimal config first
        const viewer = new Cesium.Viewer(cesiumContainer.current, {
          imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            credit: "© OpenStreetMap contributors",
          }),
          terrainProvider: Cesium.createWorldTerrain(), // 👈 current
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

        // Configure scene
        viewer.scene.globe.show = true;
        viewer.scene.globe.enableLighting = false;
        viewer.scene.backgroundColor = Cesium.Color.DARK_BLUE;

        viewerRef.current = viewer;
        cesiumReadyRef.current = true;

        // ✅ Add OSM 3D buildings
        try {
          const osmBuildings = Cesium.createOsmBuildings();
          viewer.scene.primitives.add(osmBuildings);
          console.log("OSM buildings loaded");
        } catch (e) {
          console.error("Failed to load OSM buildings:", e);
        }
        
        let selectedFeature = null;
        let originalColor = null;

        const handler = new Cesium.ScreenSpaceEventHandler(
          viewer.scene.canvas
        );

        handler.setInputAction((movement) => {
        const Cesium = window.Cesium;
        if (rectDeleteModeRef.current || rectRestoreModeRef.current) {
          return;
        }

        // 🔵 RESTORE MODE — DOES NOT REQUIRE PICKED BUILDING
        if (restoreModeRef.current) {
          const cartesian = viewer.scene.pickPosition(movement.position);
          if (!Cesium.defined(cartesian)) {
            console.warn("No depth at click position");
            return;
          }

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

          if (closest) {
            closest.feature.show = true;
            deletedFeaturesRef.current.delete(closest);
            console.log("♻️ Restored building");
          }

          return;
        }

        // ⬇️ BELOW THIS POINT WE NEED A BUILDING
        const pickedObject = viewer.scene.pick(movement.position);

        if (
          !Cesium.defined(pickedObject) ||
          !(pickedObject instanceof Cesium.Cesium3DTileFeature)
        ) {
          return;
        }

        // 🔴 DELETE MODE
        if (delRef.current) {
          const cartesian = viewer.scene.pickPosition(movement.position);
          if (!Cesium.defined(cartesian)) return;

          pickedObject.show = false;
          deletedFeaturesRef.current.add({
            feature: pickedObject,
            position: Cesium.Cartographic.fromCartesian(cartesian),
          });

          console.log("🗑️ Building deleted");
          return;
        }

        // 🟡 NORMAL SELECT MODE
        if (selectedFeature && selectedFeature !== pickedObject) {
          selectedFeature.color = originalColor;
        }

        selectedFeature = pickedObject;
        originalColor = Cesium.Color.clone(pickedObject.color);
        pickedObject.color = Cesium.Color.YELLOW;

      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);


      let dragStart = null;
      let dragEnd = null;

      handler.setInputAction((movement) => {
      if (!rectDeleteModeRef.current && !rectRestoreModeRef.current) return;

      dragStart = {
        x: movement.position.x,
        y: movement.position.y,
      };

      setDragRect({
        left: dragStart.x,
        top: dragStart.y,
        width: 0,
        height: 0,
      });
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((movement) => {
      if (!dragStart) return;

      const end = movement.endPosition;

      const left = Math.min(dragStart.x, end.x);
      const top = Math.min(dragStart.y, end.y);
      const width = Math.abs(end.x - dragStart.x);
      const height = Math.abs(end.y - dragStart.y);

      setDragRect({ left, top, width, height });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      handler.setInputAction((movement) => {
        if (!dragStart) return;

        dragEnd = {
          x: movement.position.x,
          y: movement.position.y,
        };

        const minX = Math.min(dragStart.x, dragEnd.x);
        const maxX = Math.max(dragStart.x, dragEnd.x);
        const minY = Math.min(dragStart.y, dragEnd.y);
        const maxY = Math.max(dragStart.y, dragEnd.y);

        const pickedHits = [];

        // sample grid (every 10px for better coverage)
        for (let x = minX; x <= maxX; x += 10) {
          for (let y = minY; y <= maxY; y += 10) {
            const picked = viewer.scene.pick({ x, y });

            if (
              Cesium.defined(picked) &&
              picked instanceof Cesium.Cesium3DTileFeature
            ) {
              pickedHits.push({ feature: picked, x, y });
            }
          }
        }

        // 🔴 RECTANGLE DELETE
        if (rectDeleteModeRef.current) {
          pickedHits.forEach(({ feature, x, y }) => {
            if (feature.show !== false) {
              feature.show = false;

              const cartesian = viewer.scene.pickPosition({ x, y });
              if (Cesium.defined(cartesian)) {
                deletedFeaturesRef.current.add({
                  feature,
                  position: Cesium.Cartographic.fromCartesian(cartesian),
                });
              }
            }
          });
        }


        // 🟢 RECTANGLE RESTORE
        if (rectRestoreModeRef.current) {
          pickedHits.forEach(({ feature }) => {
            deletedFeaturesRef.current.forEach((item) => {
              if (item.feature === feature) {
                item.feature.show = true;
                deletedFeaturesRef.current.delete(item);
              }
            });
          });
        }

        dragStart = null;
        dragEnd = null;
        setDragRect(null);

      }, Cesium.ScreenSpaceEventType.LEFT_UP);



        // ✅ Zoom to Bengaluru with safe altitude
        const destination = Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 50000);
        viewer.camera.setView({
          destination: destination,
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
        });

        setIsLoading(false);
      } catch (e) {
        console.error("Cesium init error:", e);
        setError("Cesium init failed: " + e.message);
        setIsLoading(false);
      }
    };

    document.body.appendChild(script);

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  const restoreAll = () => {
    deletedFeaturesRef.current.forEach((item) => {
      item.feature.show = true;
    });
    deletedFeaturesRef.current.clear();
  };

  const flyToLocation = (lon, lat, height = 3000) => {
    if (!viewerRef.current || !window.Cesium) return;

    viewerRef.current.camera.flyTo({
      destination: window.Cesium.Cartesian3.fromDegrees(
        lon,
        lat,
        height
      ),
      orientation: {
        heading: 0,
        pitch: window.Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 1.5,
    });
  };

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <AlertCircle className="w-10 h-10 text-red-500 mr-3" />
        {error}
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900">
          <div className="text-white flex items-center gap-3">
            <Globe className="animate-spin" />
            Loading 3D Map…
          </div>
        </div>
      )}

      {dragRect && (
        <div
          style={{
            position: "absolute",
            left: dragRect.left,
            top: dragRect.top,
            width: dragRect.width,
            height: dragRect.height,
            border: "2px dashed #00ffff",
            backgroundColor: "rgba(0, 255, 255, 0.15)",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        />
      )}

      <div ref={cesiumContainer} className="w-full h-full" />

      <div className="absolute top-4 left-4 z-10 space-y-2">
        <button
          onClick={() => flyToLocation(77.5946, 12.9716)}
          className="px-4 py-2 bg-white rounded shadow flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Bengaluru
        </button>

        <button
          onClick={() => flyToLocation(-74.006, 40.7128)}
          className="px-4 py-2 bg-white rounded shadow flex items-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          New York
        </button>

        <button
          onClick={() => {
            setDel(!del);
            setRestoreMode(false);
          }}
        >
          Delete Mode: {del ? "On" : "Off"}
        </button>

        <button
          onClick={() => {
            setRestoreMode(!restoreMode);
            setDel(false);
          }}
        >
          Restore Mode: {restoreMode ? "On" : "Off"}
        </button>

        <button
          onClick={restoreAll}
          className="px-4 py-2 bg-white rounded shadow flex items-center gap-2"
        >
          Restore All
        </button>
        <button
          onClick={() => {
            setRectDeleteMode(!rectDeleteMode);
            setRectRestoreMode(false);
            setDel(false);
            setRestoreMode(false);
          }}
        >
          Rectangle Delete: {rectDeleteMode ? "On" : "Off"}
        </button>

        <button
          onClick={() => {
            setRectRestoreMode(!rectRestoreMode);
            setRectDeleteMode(false);
            setDel(false);
            setRestoreMode(false);
          }}
        >
          Rectangle Restore: {rectRestoreMode ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
};

export default CesiumMap;
