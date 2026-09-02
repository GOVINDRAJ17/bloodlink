"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPreciseLiveLocation } from "@/lib/geo/location";

interface BloodStock {
  group: string;
  units: number;
  status: "AVAILABLE" | "LOW" | "OUT_OF_STOCK";
}

interface Facility {
  id: string;
  name: string;
  type: "BLOOD_BANK" | "HOSPITAL";
  address: string;
  phone: string;
  lat: number;
  lng: number;
  distanceKm?: number;
  verified: boolean;
  componentsAvailable: string[];
  stock: Record<string, number>;
  lastUpdated: string;
}

const DEFAULT_FACILITIES: Facility[] = [
  {
    id: "fac-1",
    name: "Central Red Cross Blood Center & Bank",
    type: "BLOOD_BANK",
    address: "Civil Hospital Complex, MG Road, Mumbai",
    phone: "+91 22 2890 1234",
    lat: 19.0760,
    lng: 72.8777,
    verified: true,
    componentsAvailable: ["Whole Blood", "Packed Red Blood Cells", "Platelets", "Fresh Frozen Plasma"],
    stock: { "O+": 24, "O-": 6, "A+": 18, "A-": 4, "B+": 22, "B-": 3, "AB+": 11, "AB-": 2 },
    lastUpdated: "12 mins ago"
  },
  {
    id: "fac-2",
    name: "Apex Emergency Trauma Care Hospital",
    type: "HOSPITAL",
    address: "Station Road, Ward 4, Mumbai",
    phone: "+91 98765 43210",
    lat: 19.0850,
    lng: 72.8890,
    verified: true,
    componentsAvailable: ["Whole Blood", "Packed Red Blood Cells", "Platelets"],
    stock: { "O+": 12, "O-": 2, "A+": 14, "A-": 1, "B+": 9, "B-": 0, "AB+": 5, "AB-": 0 },
    lastUpdated: "5 mins ago"
  },
  {
    id: "fac-3",
    name: "City Lifeline Blood Storage & Component Facility",
    type: "BLOOD_BANK",
    address: "Bypass Junction, Sector 8, Navi Mumbai",
    phone: "+91 22 2789 5500",
    lat: 19.0330,
    lng: 73.0297,
    verified: true,
    componentsAvailable: ["Whole Blood", "Packed Red Blood Cells", "Platelets", "Fresh Frozen Plasma", "Cryoprecipitate"],
    stock: { "O+": 35, "O-": 8, "A+": 20, "A-": 5, "B+": 28, "B-": 7, "AB+": 15, "AB-": 3 },
    lastUpdated: "Just now"
  },
  {
    id: "fac-4",
    name: "Fortis Memorial & Surgical Care Hospital",
    type: "HOSPITAL",
    address: "Medical Enclave, Central Ave, Pune",
    phone: "+91 20 2612 8800",
    lat: 18.5204,
    lng: 73.8567,
    verified: true,
    componentsAvailable: ["Whole Blood", "Packed Red Blood Cells", "Fresh Frozen Plasma"],
    stock: { "O+": 16, "O-": 3, "A+": 11, "A-": 2, "B+": 13, "B-": 1, "AB+": 6, "AB-": 1 },
    lastUpdated: "25 mins ago"
  },
  {
    id: "fac-5",
    name: "Rotary Metro Blood Bank & Apheresis Center",
    type: "BLOOD_BANK",
    address: "Gandhi Square, Ring Road, Delhi NCR",
    phone: "+91 11 2341 9900",
    lat: 28.6139,
    lng: 77.2090,
    verified: true,
    componentsAvailable: ["Whole Blood", "Packed Red Blood Cells", "Platelets", "Fresh Frozen Plasma"],
    stock: { "O+": 42, "O-": 12, "A+": 30, "A-": 8, "B+": 36, "B-": 9, "AB+": 18, "AB-": 5 },
    lastUpdated: "18 mins ago"
  },
  {
    id: "fac-6",
    name: "Apollo Multispecialty Hospital Blood Unit",
    type: "HOSPITAL",
    address: "Bannerghatta Main Road, Bangalore",
    phone: "+91 80 2630 4050",
    lat: 12.9716,
    lng: 77.5946,
    verified: true,
    componentsAvailable: ["Whole Blood", "Packed Red Blood Cells", "Platelets", "Cryoprecipitate"],
    stock: { "O+": 19, "O-": 4, "A+": 15, "A-": 3, "B+": 17, "B-": 2, "AB+": 8, "AB-": 2 },
    lastUpdated: "30 mins ago"
  }
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPONENTS = ["All Components", "Whole Blood", "Packed Red Blood Cells", "Platelets", "Fresh Frozen Plasma"];

// Haversine formula to calculate accurate distance between two coordinates in km
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [selectedComponent, setSelectedComponent] = useState<string>("All Components");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [maxRadius, setMaxRadius] = useState<number>(50);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"distance" | "stock" | "name">("distance");

  // User live location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string>("");

  // Detect location on mount
  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = async () => {
    setLocating(true);
    setLocationError("");
    try {
      const loc = await getPreciseLiveLocation();
      setUserLocation({
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address || "Current Live Location"
      });
    } catch (err: any) {
      console.warn("Location error:", err);
      // Default to central coordinates if user denies browser prompt
      setUserLocation({
        lat: 19.0760,
        lng: 72.8777,
        address: "Default Coordinates (Mumbai, MH)"
      });
      setLocationError("Location permission denied. Showing facilities sorted from default central coordinates.");
    } finally {
      setLocating(false);
    }
  };

  // Compute facility distances and apply all search filters
  const processedFacilities = DEFAULT_FACILITIES.map((fac) => {
    let dist = 0;
    if (userLocation) {
      dist = calculateHaversineDistance(userLocation.lat, userLocation.lng, fac.lat, fac.lng);
    }
    return {
      ...fac,
      distanceKm: dist
    };
  });

  const filteredFacilities = processedFacilities.filter((fac) => {
    // 1. Text Search query (matches facility name, address, or phone)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchName = fac.name.toLowerCase().includes(q);
      const matchAddr = fac.address.toLowerCase().includes(q);
      const matchPhone = fac.phone.includes(q);
      if (!matchName && !matchAddr && !matchPhone) return false;
    }

    // 2. Facility Type filter
    if (selectedType !== "ALL" && fac.type !== selectedType) {
      return false;
    }

    // 3. Component filter
    if (selectedComponent !== "All Components") {
      if (!fac.componentsAvailable.some((c) => c.toLowerCase().includes(selectedComponent.toLowerCase()))) {
        return false;
      }
    }

    // 4. Blood Group filter
    if (selectedGroup !== "ALL") {
      const stockForGroup = fac.stock[selectedGroup] || 0;
      if (onlyInStock && stockForGroup <= 0) {
        return false;
      }
    } else if (onlyInStock) {
      const totalUnits = Object.values(fac.stock).reduce((sum, u) => sum + u, 0);
      if (totalUnits <= 0) return false;
    }

    // 5. Max Radius filter (if user location is available)
    if (userLocation && maxRadius < 500 && (fac.distanceKm || 0) > maxRadius) {
      return false;
    }

    return true;
  });

  // Sorting
  filteredFacilities.sort((a, b) => {
    if (sortBy === "distance") {
      return (a.distanceKm || 0) - (b.distanceKm || 0);
    } else if (sortBy === "stock") {
      const stockA = selectedGroup === "ALL"
        ? Object.values(a.stock).reduce((sum, u) => sum + u, 0)
        : a.stock[selectedGroup] || 0;
      const stockB = selectedGroup === "ALL"
        ? Object.values(b.stock).reduce((sum, u) => sum + u, 0)
        : b.stock[selectedGroup] || 0;
      return stockB - stockA;
    } else {
      return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Top Banner Navigation & Live Location Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#14213D]/5 dark:bg-white/10 hover:bg-[#14213D]/10 dark:hover:bg-white/15 text-[#14213D] dark:text-white font-mono text-xs font-bold rounded-lg transition-colors"
            >
              <span>🏠</span>
              <span>Home</span>
            </Link>
            <span className="text-[10px] font-mono font-black text-[#0F766E] dark:text-[#6FD6BC] bg-[#0F766E]/10 dark:bg-[#6FD6BC]/10 px-2.5 py-1 rounded-full uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0F766E] animate-pulse" />
              Live Blood Availability Finder
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#14213D] dark:text-white tracking-tight">
            Search Blood Banks & Hospital Inventory
          </h1>
          <p className="text-xs md:text-sm text-[#5B6472] dark:text-[#9AA5B4] mt-1">
            Search real-time stock across blood banks and hospitals with precise distance calculation from your location.
          </p>
        </div>

        {/* Live GPS Location Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <button
            onClick={detectLocation}
            disabled={locating}
            className="px-4 py-2.5 bg-white dark:bg-[#101720] hover:bg-gray-50 dark:hover:bg-[#1c283c] text-[#14213D] dark:text-white border border-[#E2E4E1] dark:border-[#2A3547] font-mono font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <span>{locating ? "🛰️" : "📍"}</span>
            <span>{locating ? "Detecting GPS..." : "Update Live Location"}</span>
          </button>
          
          <Link
            href="/requests/create"
            className="px-4 py-2.5 bg-[#D62828] hover:bg-[#b01f1f] text-white font-mono font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <span>🚨</span>
            <span>Emergency Request</span>
          </Link>
        </div>
      </div>

      {userLocation && (
        <div className="flex items-center justify-between p-3.5 bg-[#0F766E]/10 border border-[#0F766E]/30 rounded-xl font-mono text-xs text-[#0F766E] dark:text-[#6FD6BC]">
          <span className="flex items-center gap-2">
            <span>📍</span>
            <span>Your Current Location: <strong>{userLocation.address || `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`}</strong></span>
          </span>
          <span className="text-[10px] uppercase font-bold bg-[#0F766E]/20 px-2 py-0.5 rounded">
            Distances Calculated in Real-Time
          </span>
        </div>
      )}

      {locationError && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-xl font-mono text-xs">
          ⚠️ {locationError}
        </div>
      )}

      {/* SEARCH CONTROLS & FILTERS BAR */}
      <div className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-4">
        
        {/* Main Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by hospital name, blood bank, street address, or city (e.g. 'Red Cross', 'Apollo', 'Mumbai')..."
            className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white pl-11 pr-4 py-3.5 rounded-xl text-xs md:text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base">🔍</span>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-secondary-var hover:text-[#14213D] dark:hover:text-white"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Filter Badges: Blood Groups */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono font-bold uppercase text-secondary-var">
            Select Blood Group Filter:
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedGroup("ALL")}
              className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-extrabold transition-all ${
                selectedGroup === "ALL"
                  ? "bg-[#14213D] dark:bg-white text-white dark:text-[#14213D] shadow-sm"
                  : "bg-[#F6F7F5] dark:bg-[#101720] text-[#5B6472] dark:text-[#9AA5B4] border border-[#E2E4E1] dark:border-[#2A3547] hover:border-[#14213D]"
              }`}
            >
              ALL GROUPS
            </button>
            {BLOOD_GROUPS.map((bg) => (
              <button
                key={bg}
                onClick={() => setSelectedGroup(bg)}
                className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-extrabold transition-all ${
                  selectedGroup === bg
                    ? "bg-[#D62828] text-white shadow-md shadow-[#D62828]/20"
                    : "bg-[#F6F7F5] dark:bg-[#101720] text-[#5B6472] dark:text-[#9AA5B4] border border-[#E2E4E1] dark:border-[#2A3547] hover:border-[#D62828]"
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          
          {/* Component Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-secondary-var">Component</label>
            <select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
              className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none"
            >
              {COMPONENTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Facility Type */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-secondary-var">Facility Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none"
            >
              <option value="ALL">All Facilities</option>
              <option value="BLOOD_BANK">Blood Banks Only</option>
              <option value="HOSPITAL">Hospitals Only</option>
            </select>
          </div>

          {/* Max Distance Radius */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-secondary-var">Distance Radius</label>
            <select
              value={maxRadius}
              onChange={(e) => setMaxRadius(Number(e.target.value))}
              className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none"
            >
              <option value={10}>Within 10 km</option>
              <option value={25}>Within 25 km</option>
              <option value={50}>Within 50 km</option>
              <option value={100}>Within 100 km</option>
              <option value={1000}>All India (Any Distance)</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-secondary-var">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none"
            >
              <option value="distance">📍 Distance (Nearest First)</option>
              <option value="stock">🩸 Available Stock (Highest First)</option>
              <option value="name">🔤 Name (A-Z)</option>
            </select>
          </div>

        </div>

        {/* Stock Toggle Checkbox */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="onlyInStock"
            checked={onlyInStock}
            onChange={(e) => setOnlyInStock(e.target.checked)}
            className="w-4 h-4 text-[#D62828] rounded border-gray-300 focus:ring-[#D62828]"
          />
          <label htmlFor="onlyInStock" className="text-xs font-mono font-bold text-[#14213D] dark:text-white cursor-pointer select-none">
            Only show facilities with blood units currently in stock (&gt; 0 units)
          </label>
        </div>

      </div>

      {/* SEARCH RESULTS HEADER */}
      <div className="flex items-center justify-between font-mono text-xs text-secondary-var px-1">
        <span>Found <strong>{filteredFacilities.length}</strong> matching blood banks and hospitals</span>
        {selectedGroup !== "ALL" && (
          <span>Filtering by <strong>{selectedGroup}</strong> blood group</span>
        )}
      </div>

      {/* RESULTS LIST */}
      {filteredFacilities.length === 0 ? (
        <div className="bg-white dark:bg-[#182233] p-12 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] text-center space-y-4">
          <span className="text-4xl">🔍</span>
          <h3 className="text-lg font-bold text-[#14213D] dark:text-white">
            No blood banks or hospitals found matching your criteria.
          </h3>
          <p className="text-xs text-secondary-var max-w-md mx-auto">
            Try expanding your search radius (e.g. to 50 km or 100 km) or selecting &ldquo;All Groups&rdquo;.
          </p>
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedGroup("ALL");
              setSelectedComponent("All Components");
              setSelectedType("ALL");
              setMaxRadius(1000);
              setOnlyInStock(false);
            }}
            className="px-4 py-2 bg-[#14213D] text-white font-mono font-bold text-xs rounded-xl"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredFacilities.map((fac) => {
            const totalUnits = Object.values(fac.stock).reduce((sum, u) => sum + u, 0);

            return (
              <div
                key={fac.id}
                className="bg-white dark:bg-[#182233] p-6 md:p-7 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm hover:shadow-md transition-all space-y-6"
              >
                
                {/* Facility Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-extrabold uppercase ${
                        fac.type === "BLOOD_BANK"
                          ? "bg-purple-600 text-white"
                          : "bg-blue-600 text-white"
                      }`}>
                        {fac.type === "BLOOD_BANK" ? "🩸 Blood Bank" : "🏥 Hospital"}
                      </span>
                      
                      {fac.verified && (
                        <span className="px-2.5 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-mono font-bold">
                          ✓ Verified Entity
                        </span>
                      )}

                      <span className="text-[10px] font-mono text-secondary-var">
                        Updated {fac.lastUpdated}
                      </span>
                    </div>

                    <h2 className="text-xl md:text-2xl font-black text-[#14213D] dark:text-white tracking-tight">
                      {fac.name}
                    </h2>

                    <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4] flex items-center gap-1.5">
                      <span>📍</span>
                      <span>{fac.address}</span>
                    </p>
                  </div>

                  {/* Distance & Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="px-4 py-2 bg-[#D62828]/10 border border-[#D62828]/30 rounded-xl text-center">
                      <span className="text-[10px] font-mono uppercase font-bold text-secondary-var block">Distance</span>
                      <span className="text-base font-black text-[#D62828] font-mono">
                        {fac.distanceKm !== undefined ? `${fac.distanceKm} km` : "Nearby"}
                      </span>
                    </div>

                    <a
                      href={`tel:${fac.phone.replace(/[^0-9+]/g, "")}`}
                      className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d635c] text-white font-mono font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <span>📞</span> Call: {fac.phone}
                    </a>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${fac.lat},${fac.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2.5 bg-[#14213D]/10 dark:bg-white/10 hover:bg-[#14213D]/20 dark:hover:bg-white/15 text-[#14213D] dark:text-white font-mono font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                    >
                      <span>🗺️</span> Directions
                    </a>
                  </div>
                </div>

                {/* BLOOD STOCK GRID FOR ALL TYPES */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span className="text-secondary-var uppercase">
                      All Available Blood Stock Breakdown ({totalUnits} total units):
                    </span>
                    <span className="text-[#0F766E] dark:text-[#6FD6BC]">
                      Components: {fac.componentsAvailable.join(", ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {BLOOD_GROUPS.map((bg) => {
                      const units = fac.stock[bg] ?? 0;
                      const isSelected = selectedGroup === bg;
                      const isOutOfStock = units === 0;
                      const isLow = units > 0 && units <= 3;

                      return (
                        <div
                          key={bg}
                          className={`p-2.5 rounded-xl border text-center transition-all ${
                            isSelected
                              ? "ring-2 ring-[#D62828] bg-[#D62828]/10 border-[#D62828]"
                              : isOutOfStock
                              ? "bg-gray-100 dark:bg-[#101720] border-gray-200 dark:border-[#2A3547] opacity-60"
                              : isLow
                              ? "bg-amber-500/10 border-amber-500/30"
                              : "bg-[#F6F7F5] dark:bg-[#101720] border-[#E2E4E1] dark:border-[#2A3547]"
                          }`}
                        >
                          <span className="text-sm font-black font-mono block text-[#14213D] dark:text-white">
                            {bg}
                          </span>
                          <span className={`text-xs font-extrabold font-mono block mt-0.5 ${
                            isOutOfStock
                              ? "text-gray-400"
                              : isLow
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-[#0F766E] dark:text-[#6FD6BC]"
                          }`}>
                            {units} {units === 1 ? "unit" : "units"}
                          </span>
                          <span className="text-[9px] font-mono text-secondary-var uppercase block mt-0.5">
                            {isOutOfStock ? "EMPTY" : isLow ? "LOW" : "IN STOCK"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Card Footer */}
                <div className="pt-3 border-t border-[#E2E4E1] dark:border-[#2A3547] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] font-mono text-secondary-var">
                    🏥 Direct Contact: <strong>{fac.phone}</strong> • Facility verified under BloodLink Health Network
                  </span>

                  <Link
                    href={`/requests/create?hospital=${encodeURIComponent(fac.name)}&group=${selectedGroup !== "ALL" ? selectedGroup : "O+"}`}
                    className="px-4 py-2 bg-[#D62828]/10 hover:bg-[#D62828] text-[#D62828] hover:text-white font-mono font-bold text-xs rounded-xl transition-all"
                  >
                    Request Blood from this Facility →
                  </Link>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
