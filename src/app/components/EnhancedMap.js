"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";

let leafletCssInjected = false;

function ensureLeafletCss() {
  if (leafletCssInjected) return;
  if (typeof document === "undefined") return;
  if (!document.querySelector('link[href*="leaflet"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
  leafletCssInjected = true;
}

// Sub-component to smoothly fly and zoom to user's exact live location
function MapRecenter({ userLocation }) {
  const map = useMap();

  useEffect(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
      map.flyTo([userLocation.lat, userLocation.lng], 15, {
        animate: true,
        duration: 1.5
      });
    }
  }, [userLocation, map]);

  return null;
}

const createColoredPinIcon = (colorHex) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:0;height:0;
      border-left:9px solid transparent;
      border-right:9px solid transparent;
      border-top:24px solid ${colorHex};
      position:relative;
      filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    ">
      <div style="
        position:absolute;top:-28px;left:-7px;
        width:14px;height:14px;
        background:${colorHex};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid white;
      "></div>
    </div>`,
    iconSize: [18, 24],
    iconAnchor: [9, 24],
  });

// Glowing Pulsing Marker for User's Exact Location
const createUserLocationPin = () =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:22px; height:22px;
      background:#0066FF;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 0 0 6px rgba(0, 102, 255, 0.4), 0 4px 10px rgba(0,0,0,0.4);
      position:relative;
    ">
      <div style="
        position:absolute; top:-6px; left:-6px; right:-6px; bottom:-6px;
        border-radius:50%;
        border:2px solid #0066FF;
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

export default function EnhancedMap({
  userLocation = null,
  radiusKm = 5,
  layerData = {},
  activeLayers = { emergencies: true, bloodBanks: true, donors: true, heatmap: true }
}) {
  const [mapKey] = useState(() => `map-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [leafletReady, setLeafletReady] = useState(false);
  const iconsRef = useRef({});

  useEffect(() => {
    ensureLeafletCss();
    iconsRef.current = {
      user: createUserLocationPin(),
      emergency: createColoredPinIcon("#D62828"), // Red
      bloodBank: createColoredPinIcon("#0F766E"), // Teal
      donor: createColoredPinIcon("#C97A2B")      // Amber
    };
    setLeafletReady(true);
  }, []);

  if (!leafletReady) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 text-gray-400 text-sm font-mono">
        Initializing Leaflet Geospatial Engine...
      </div>
    );
  }

  const { emergencies = [], bloodBanks = [], donors = [], shortageHeatmap = [] } = layerData;
  const initialCenter = userLocation ? [userLocation.lat, userLocation.lng] : [20.5937, 78.9629];
  const initialZoom = userLocation ? 15 : 5;

  return (
    <MapContainer
      key={mapKey}
      center={initialCenter}
      zoom={initialZoom}
      style={{ height: "100%", width: "100%", borderRadius: 12 }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
      />

      {/* Recenter helper component that zooms into userLocation whenever updated */}
      <MapRecenter userLocation={userLocation} />

      {/* User's Live Position Marker & Search Radius Ring */}
      {userLocation && (
        <>
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={iconsRef.current.user}
          >
            <Popup>
              <div className="p-1 space-y-1 text-center font-sans">
                <span className="bg-[#0066FF] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                  📍 Your Live Position
                </span>
                <h4 className="font-bold text-xs text-gray-900 mt-1">Exact Coordinates Acquired</h4>
                <p className="text-[11px] text-gray-600 font-mono">
                  {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </p>
                {userLocation.address && (
                  <p className="text-[10px] text-gray-500 max-w-[180px]">{userLocation.address}</p>
                )}
              </div>
            </Popup>
          </Marker>

          {/* 5 km Search Radius Visual Circle */}
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#0066FF",
              fillColor: "#0066FF",
              fillOpacity: 0.1,
              weight: 2,
              dashArray: "4, 6"
            }}
          />
        </>
      )}

      {/* 1. Active Emergencies Layer */}
      {activeLayers.emergencies &&
        emergencies.map((e) => (
          <Marker
            key={`emg-${e.id}`}
            position={[e.lat, e.lng]}
            icon={iconsRef.current.emergency}
          >
            <Popup>
              <div className="p-1 space-y-1">
                <span className="bg-[#D62828] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                  {e.urgency} EMERGENCY
                </span>
                <h4 className="font-extrabold text-sm text-gray-900 margin-0">{e.bloodGroup} Needed</h4>
                <p className="text-xs text-gray-600">
                  Patient: {e.patientName} • {e.hospitalName} ({e.unitsNeeded} units)
                </p>
                <a
                  href={`/requests/${e.id}`}
                  className="inline-block mt-2 text-xs font-bold text-[#D62828] hover:underline"
                >
                  Track Emergency Dispatch →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}

      {/* 2. Blood Banks Layer */}
      {activeLayers.bloodBanks &&
        bloodBanks.map((b) => (
          <Marker
            key={`bb-${b.id}`}
            position={[b.lat, b.lng]}
            icon={iconsRef.current.bloodBank}
          >
            <Popup>
              <div className="p-1">
                <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                  HOSPITAL & BLOOD BANK
                </span>
                <h4 className="font-bold text-sm text-gray-900 mt-1">{b.name}</h4>
                <p className="text-xs text-gray-600">{b.address}</p>
              </div>
            </Popup>
          </Marker>
        ))}

      {/* 3. Nearby Donors Layer (Privacy Masked) */}
      {activeLayers.donors &&
        donors.map((d) => (
          <Marker
            key={`dnr-${d.id}`}
            position={[d.lat, d.lng]}
            icon={iconsRef.current.donor}
          >
            <Popup>
              <div className="p-1">
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                  REGISTERED DONOR
                </span>
                <h4 className="font-bold text-sm text-gray-900 mt-1">Group: {d.bloodGroup}</h4>
                <p className="text-[11px] text-gray-500">
                  🛡️ Donor address privacy masked (~approx location)
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

      {/* 4. Shortage Heatmap / Density Overlay */}
      {activeLayers.heatmap &&
        shortageHeatmap.map((h, idx) => (
          <Circle
            key={`hm-${idx}`}
            center={[h.lat, h.lng]}
            radius={h.weight * 60000}
            pathOptions={{
              color: "#D62828",
              fillColor: "#D62828",
              fillOpacity: 0.25 * h.weight,
              weight: 1
            }}
          />
        ))}

    </MapContainer>
  );
}
