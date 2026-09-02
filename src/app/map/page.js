"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import LocationPrompt from "@/app/components/LocationPrompt";
import { MonoData, VerifiedBadge } from "@/app/components/ui/Badge";
import { getPreciseLiveLocation } from "@/lib/geo/location";

const EnhancedMap = dynamic(() => import("@/app/components/EnhancedMap.js"), { ssr: false });

export default function MapExplorerPage() {
  const [userLocation, setUserLocation] = useState(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [facilityData, setFacilityData] = useState({ hospitals: [], bloodBanks: [] });

  const [layerData, setLayerData] = useState({
    emergencies: [],
    bloodBanks: [],
    donors: [],
    shortageHeatmap: []
  });

  const [activeLayers, setActiveLayers] = useState({
    emergencies: true,
    bloodBanks: true,
    donors: true,
    heatmap: false
  });

  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNearbyFacilities = async (lat, lng, radius) => {
    try {
      const res = await axios.get(`/api/hospitals/nearby?lat=${lat}&lng=${lng}&radiusKm=${radius}`);
      if (res.status === 200) {
        const facilities = res.data.facilities || [];
        setFacilityData({
          hospitals: facilities.filter(f => f.type === "HOSPITAL"),
          bloodBanks: facilities.filter(f => f.type === "BLOOD_BANK")
        });
      }
    } catch (err) {
      console.error("Failed to load nearby facilities:", err);
    }
  };

  const fetchLayerData = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/map/layers");
      if (res.status === 200 && res.data.emergencies) {
        setLayerData(res.data);
      } else {
        setLayerData({
          emergencies: [
            { id: "e1", lat: 18.5204, lng: 73.8567, urgency: "CRITICAL", bloodGroup: "O-", patientName: "Rahul M.", hospitalName: "City General Hospital", unitsNeeded: 3 },
            { id: "e2", lat: 19.0760, lng: 72.8777, urgency: "URGENT", bloodGroup: "A+", patientName: "Priya S.", hospitalName: "Apex Trauma Care", unitsNeeded: 2 }
          ],
          bloodBanks: [
            { id: "b1", lat: 18.5254, lng: 73.8617, name: "Regional Blood Bank Storage", address: "Medical College Gate 2" },
            { id: "b2", lat: 19.0820, lng: 72.8890, name: "Metro Blood Bank", address: "Central Ward Bypass" }
          ],
          donors: [
            { id: "d1", lat: 18.5224, lng: 73.8507, bloodGroup: "O+" },
            { id: "d2", lat: 18.5184, lng: 73.8607, bloodGroup: "A+" },
            { id: "d3", lat: 19.0700, lng: 72.8800, bloodGroup: "O-" }
          ],
          shortageHeatmap: [
            { lat: 18.5204, lng: 73.8567, weight: 0.8 }
          ]
        });
      }
    } catch (err) {
      console.error("Failed to load map layer data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLayerData();
  }, []);

  const handleLocationGranted = (coords) => {
    setUserLocation(coords);
    setShowLocationPrompt(false);
    fetchNearbyFacilities(coords.lat, coords.lng, radiusKm);
  };

  const handleRadiusChange = (newRadius) => {
    setRadiusKm(newRadius);
    if (userLocation) {
      fetchNearbyFacilities(userLocation.lat, userLocation.lng, newRadius);
    }
  };

  const toggleLayer = (key) => {
    setActiveLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLocateMe = async () => {
    try {
      setLoading(true);
      const loc = await getPreciseLiveLocation();
      setUserLocation(loc);
      setShowLocationPrompt(false);
      fetchNearbyFacilities(loc.lat, loc.lng, radiusKm);
    } catch (err) {
      alert(`Location Error: ${err.message || "Failed to fetch live location"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#F6F7F5] dark:bg-[#101720] overflow-hidden relative">
      
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-[#182233] border-b border-gray-200 dark:border-[#2A3547] p-4 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div>
          <span className="text-[10px] font-mono font-black text-[#0F766E] dark:text-[#6FD6BC] uppercase tracking-wider">
            Geospatial Search & Facilities
          </span>
          <h1 className="font-heading text-xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] mt-0.5">
            Nearby Hospitals & Blood Banks
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Radius Selector */}
          <div className="flex items-center gap-1 bg-[#F6F7F5] dark:bg-[#101720] p-1 rounded-lg border border-gray-200 dark:border-[#2A3547] text-xs font-mono">
            {[5, 10, 20].map((r) => (
              <button
                key={r}
                onClick={() => handleRadiusChange(r)}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  radiusKm === r ? "bg-[#14213D] text-white" : "text-[#5B6472] hover:text-black dark:hover:text-white"
                }`}
              >
                {r} km
              </button>
            ))}
          </div>

          <button
            onClick={handleLocateMe}
            className="px-3.5 py-1.5 bg-[#D62828] hover:bg-red-700 text-white text-xs font-mono font-bold rounded-lg shadow flex items-center gap-1.5"
          >
            <span>📍</span>
            <span>{userLocation ? "Refresh Location" : "Locate Me"}</span>
          </button>

          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="px-3.5 py-1.5 bg-gray-100 dark:bg-gray-800 text-[#14213D] dark:text-white text-xs font-mono font-bold rounded-lg border border-gray-200 dark:border-[#2A3547]"
          >
            ⚙️ Layers {panelOpen ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Contextual Location Permission Prompt Banner */}
      {showLocationPrompt && (
        <div className="p-4 z-30">
          <LocationPrompt
            onLocationGranted={handleLocationGranted}
            onSkip={() => setShowLocationPrompt(false)}
          />
        </div>
      )}

      {/* Progressive Layer Panel */}
      {panelOpen && (
        <div className="absolute top-20 right-6 z-30 card-surface p-4 rounded-xl border shadow-2xl max-w-xs w-full space-y-3">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#2A3547] pb-2">
            <h3 className="text-xs font-mono font-extrabold uppercase tracking-wide">Map Layer Toggles</h3>
            <button onClick={() => setPanelOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">✕</button>
          </div>

          <div className="space-y-2 text-xs font-bold">
            <label className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-[#2A3547] cursor-pointer">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={activeLayers.emergencies} onChange={() => toggleLayer("emergencies")} className="accent-[#D62828]" />
                🔴 Active Emergencies
              </span>
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-[#2A3547] cursor-pointer">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={activeLayers.bloodBanks} onChange={() => toggleLayer("bloodBanks")} className="accent-[#0F766E]" />
                🩸 Blood Banks
              </span>
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-[#2A3547] cursor-pointer">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={activeLayers.donors} onChange={() => toggleLayer("donors")} className="accent-[#14213D]" />
                👤 Masked Donors
              </span>
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-[#2A3547] cursor-pointer">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={activeLayers.heatmap} onChange={() => toggleLayer("heatmap")} className="accent-[#C97A2B]" />
                🔥 Shortage Heatmap
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Main Content Area: Map + Facilities Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        
        {/* Map View */}
        <div className="flex-1 relative h-full">
          {loading ? (
            <div className="h-full flex items-center justify-center font-mono text-xs text-secondary-var">
              Loading Leaflet geospatial engine...
            </div>
          ) : (
            <EnhancedMap userLocation={userLocation} radiusKm={radiusKm} layerData={layerData} activeLayers={activeLayers} />
          )}
        </div>

        {/* Nearby Facilities List Sidebar */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-200 dark:border-[#2A3547] bg-white dark:bg-[#182233] p-4 overflow-y-auto space-y-4 max-h-64 md:max-h-none shrink-0">
          <div>
            <h3 className="font-heading text-sm font-extrabold text-primary-var">
              Nearest Facilities ({facilityData.hospitals.length + facilityData.bloodBanks.length})
            </h3>
            <p className="text-[11px] font-mono text-secondary-var">
              Sorted by distance within <MonoData>{radiusKm} km</MonoData>
            </p>
          </div>

          {/* Hospitals List */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-secondary-var block">Hospitals ({facilityData.hospitals.length})</span>
            {facilityData.hospitals.length === 0 ? (
              <p className="text-xs font-mono text-secondary-var">No hospitals found within {radiusKm} km radius.</p>
            ) : (
              facilityData.hospitals.map((h) => (
                <div key={h.id} className="p-3 rounded-lg border border-gray-200 dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720]">
                  <div className="flex items-center justify-between">
                    <VerifiedBadge type="HOSPITAL" />
                    <MonoData className="text-[#0F766E] dark:text-[#6FD6BC]">{h.distanceKm} km</MonoData>
                  </div>
                  <h4 className="font-heading text-xs font-bold text-primary-var mt-1.5">{h.name}</h4>
                  <p className="text-[10px] text-secondary-var mt-0.5">{h.address}</p>
                </div>
              ))
            )}
          </div>

          {/* Blood Banks List */}
          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-[#2A3547]">
            <span className="text-[10px] font-mono font-bold uppercase text-secondary-var block">Blood Banks ({facilityData.bloodBanks.length})</span>
            {facilityData.bloodBanks.length === 0 ? (
              <p className="text-xs font-mono text-secondary-var">No blood banks found within {radiusKm} km radius.</p>
            ) : (
              facilityData.bloodBanks.slice(0, 5).map((b) => (
                <div key={b.id} className="p-3 rounded-lg border border-gray-200 dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720]">
                  <div className="flex items-center justify-between">
                    <VerifiedBadge type="BLOOD_BANK" />
                    <MonoData className="text-[#0F766E] dark:text-[#6FD6BC]">{b.distanceKm} km</MonoData>
                  </div>
                  <h4 className="font-heading text-xs font-bold text-primary-var mt-1.5">{b.name}</h4>
                  <p className="text-[10px] text-secondary-var mt-0.5">{b.address}</p>
                </div>
              ))
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
