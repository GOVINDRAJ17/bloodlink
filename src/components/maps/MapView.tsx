"use client";

import { useEffect, useRef, useState } from "react";

interface MarkerItem {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: "EMERGENCY" | "DONOR" | "HOSPITAL" | "BLOOD_BANK";
}

interface MapViewProps {
  initialLat?: number;
  initialLng?: number;
  zoom?: number;
  markers?: MarkerItem[];
}

export default function MapView({
  initialLat = 20.5937,
  initialLng = 78.9629,
  zoom = 11,
  markers = []
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapEngine, setMapEngine] = useState<"mapbox" | "leaflet">("leaflet");
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const isValidMapboxToken = token && !token.includes("dummy") && token.startsWith("pk.");

    if (isValidMapboxToken) {
      import("mapbox-gl").then((mapboxglModule) => {
        const mapboxgl = mapboxglModule.default;
        if (!mapContainerRef.current) return;

        mapboxgl.accessToken = token;
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/navigation-day-v1",
          center: [initialLng, initialLat],
          zoom
        });

        mapInstanceRef.current = map;
        map.addControl(new mapboxgl.NavigationControl(), "top-right");

        markers.forEach((m) => {
          const el = document.createElement("div");
          el.className = "w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold";
          el.style.backgroundColor =
            m.type === "EMERGENCY" ? "#D62828" :
            m.type === "DONOR" ? "#0F766E" :
            m.type === "HOSPITAL" ? "#14213D" : "#C97A2B";
          el.innerText =
            m.type === "EMERGENCY" ? "🚨" :
            m.type === "DONOR" ? "👤" :
            m.type === "HOSPITAL" ? "🏥" : "🩸";

          new mapboxgl.Marker(el)
            .setLngLat([m.lng, m.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<div style="font-weight:bold; font-size:12px;">${m.title}</div>`))
            .addTo(map);
        });

        setMapEngine("mapbox");
      }).catch(() => {
        setMapEngine("leaflet");
      });
    } else {
      setMapEngine("leaflet");
    }
  }, [initialLat, initialLng, zoom]);

  // Fail-Safe Leaflet Effect with Container Re-use Prevention
  useEffect(() => {
    if (mapEngine !== "leaflet" || !mapContainerRef.current) return;

    let isSubscribed = true;

    // Inject Leaflet CSS dynamically if missing
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (!isSubscribed || !mapContainerRef.current) return;

      // Safely cleanup existing Leaflet map instance and clear container ID
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore cleanup errors
        }
        mapInstanceRef.current = null;
      }

      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], zoom);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>',
        maxZoom: 19
      }).addTo(map);

      markers.forEach((m) => {
        const colorHex =
          m.type === "EMERGENCY" ? "#D62828" :
          m.type === "DONOR" ? "#0F766E" :
          m.type === "HOSPITAL" ? "#14213D" : "#C97A2B";

        const customIcon = L.divIcon({
          className: "",
          html: `<div style="
            width:24px; height:24px;
            background:${colorHex};
            border:2px solid white;
            border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
            font-size:11px; color:white;
          ">${
            m.type === "EMERGENCY" ? "🚨" :
            m.type === "DONOR" ? "👤" :
            m.type === "HOSPITAL" ? "🏥" : "🩸"
          }</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker([m.lat, m.lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(`<div style="font-family:sans-serif; font-weight:bold; font-size:12px; padding:4px;">${m.title}</div>`);
      });
    });

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore cleanup errors
        }
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, [mapEngine, initialLat, initialLng, zoom, markers]);

  return (
    <div className="w-full h-full min-h-[350px] rounded-xl overflow-hidden relative shadow-sm border border-[#E2E4E1] dark:border-[#2A3547]">
      <div ref={mapContainerRef} className="w-full h-full min-h-[350px]" />
    </div>
  );
}
