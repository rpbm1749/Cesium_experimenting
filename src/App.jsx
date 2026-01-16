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

  useEffect(() => {
    delRef.current = del;
  }, [del]);

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
        const pickedObject = viewer.scene.pick(movement.position);

        if (
          !Cesium.defined(pickedObject) ||
          !(pickedObject instanceof Cesium.Cesium3DTileFeature)
        ) {
          return;
        }

        // 🔴 DELETE MODE
        if (delRef.current) {
          pickedObject.show = false;
          return;
        }

        // 🟡 NORMAL MODE (select + highlight)
        if (selectedFeature && selectedFeature !== pickedObject) {
          selectedFeature.color = originalColor;
        }

        selectedFeature = pickedObject;
        originalColor = Cesium.Color.clone(pickedObject.color);
        pickedObject.color = Cesium.Color.YELLOW;

      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);


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
          onClick={() => setDel(!del)}
          className="px-4 py-2 bg-white rounded shadow flex items-center gap-2"
        >
          Delete Mode: {del ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
};

export default CesiumMap;
