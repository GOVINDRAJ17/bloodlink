"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getPreciseLiveLocation } from "@/lib/geo/location";
import districtData from "../../../assets/district_data.json";

interface BloodStock {
  group: string;
  units: number;
  status: "AVAILABLE" | "LOW" | "OUT_OF_STOCK";
}

interface Facility {
  id: string;
  name: string;
  type: "BLOOD_BANK" | "HOSPITAL";
  isHospital?: boolean;
  isBloodBank?: boolean;
  hospitalType?: string;
  hospitalCode?: string | null;
  stateCode?: string | null;
  address: string;
  phone: string;
  email?: string;
  lat: number | null;
  lng: number | null;
  distanceKm?: number;
  verified: boolean;
  componentsAvailable: string[];
  stock: Record<string, number>;
  componentStock?: Record<string, Record<string, number>>;
  source?: string;
  lastUpdated: string;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPONENTS = ["All Components", "Whole Blood", "Packed Red Blood Cells", "Platelets", "Fresh Frozen Plasma"];

// Haversine formula to calculate accurate distance between two coordinates in km
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

  // Search Mode: "GPS" (Nearby Radius) or "STATE" (State & District Selector)
  const [searchMode, setSearchMode] = useState<"GPS" | "STATE">("GPS");
  const [selectedStateCode, setSelectedStateCode] = useState<string>("27"); // Default: Maharashtra (27)
  const [selectedDistrictName, setSelectedDistrictName] = useState<string>("");

  // User live location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string>("");

  // Live eRaktKosh facilities state (no hardcoded defaults)
  const [rawFacilities, setRawFacilities] = useState<Facility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<string>("Live Registry");

  // Google-like typeahead dropdown & selection states
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [highlightedFacilityId, setHighlightedFacilityId] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const typeaheadAbortRef = useRef<AbortController | null>(null);
  const activeFetchAbortRef = useRef<AbortController | null>(null);
  const prevSearchTermRef = useRef<string>("");
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Resilience & error states
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFallbackData, setIsFallbackData] = useState<boolean>(false);
  const [isStaleData, setIsStaleData] = useState<boolean>(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Districts for current selected state
  const states = districtData.statesWithDistricts || [];
  const currentDistricts = states.find(s => s.stateCode === selectedStateCode)?.districts || [];

  // Detect location on mount
  useEffect(() => {
    detectLocation();
  }, []);

  // Live Typeahead search against backend for any typed search query
  useEffect(() => {
    const trimmed = searchTerm.trim();
    const prev = prevSearchTermRef.current;
    prevSearchTermRef.current = trimmed;

    if (!trimmed) {
      if (typeaheadAbortRef.current) {
        typeaheadAbortRef.current.abort();
      }
      // Only re-fetch if transitioning from a typed query back to empty (avoid mount duplicate)
      if (prev !== "") {
        if (searchMode === "GPS" && userLocation) {
          fetchLiveFacilities(userLocation.lat, userLocation.lng, maxRadius);
        } else if (searchMode === "STATE" && selectedStateCode) {
          handleSearchByState();
        }
      }
      return;
    }

    const timer = setTimeout(async () => {
      if (typeaheadAbortRef.current) {
        typeaheadAbortRef.current.abort();
      }
      const controller = new AbortController();
      typeaheadAbortRef.current = controller;

      setLoadingFacilities(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams();
        params.append("query", trimmed);
        if (userLocation) {
          params.append("lat", String(userLocation.lat));
          params.append("lng", String(userLocation.lng));
          params.append("radiusKm", String(maxRadius));
        }

        const res = await fetch(`/api/hospitals/nearby?${params.toString()}`, {
          signal: controller.signal
        });

        if (res.ok) {
          const data = await res.json();
          setIsFallbackData(Boolean(data.isFallback));
          setIsStaleData(Boolean(data.stale));

          const mapped: Facility[] = (data.facilities || []).map((f: any) => ({
            id: String(f.id),
            name: f.name,
            type: f.type === "HOSPITAL" ? "HOSPITAL" : "BLOOD_BANK",
            isHospital: f.isHospital ?? (f.type === "HOSPITAL"),
            isBloodBank: true,
            hospitalType: f.hospitalType,
            hospitalCode: f.hospitalCode,
            stateCode: f.stateCode,
            address: f.address,
            phone: f.phone,
            lat: f.lat !== null && f.lat !== undefined ? Number(f.lat) : null,
            lng: f.lng !== null && f.lng !== undefined ? Number(f.lng) : null,
            distanceKm: f.distanceKm ?? undefined,
            verified: f.verified ?? true,
            componentsAvailable: f.componentsAvailable || ["Whole Blood", "Packed Red Blood Cells", "Platelets", "Fresh Frozen Plasma"],
            stock: f.stock || {},
            componentStock: f.componentStock || {},
            lastUpdated: f.lastUpdated || "Live Database"
          }));
          setRawFacilities(mapped);
          setDataSource(data.isFallback ? "Verified Offline Cache" : "Live Substring Search (DB & eRaktKosh)");
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("Live hospital typeahead failed:", err);
          setFetchError(err.message || "Search request failed");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingFacilities(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // Debounced fetch whenever coordinates or radius changes in GPS mode
  useEffect(() => {
    if (searchMode === "GPS" && userLocation && !searchTerm.trim()) {
      const timer = setTimeout(() => {
        fetchLiveFacilities(userLocation.lat, userLocation.lng, maxRadius);
      }, 250);

      return () => {
        clearTimeout(timer);
        if (activeFetchAbortRef.current) {
          activeFetchAbortRef.current.abort();
        }
      };
    }
  }, [userLocation?.lat, userLocation?.lng, maxRadius, searchMode]);

  const fetchLiveFacilities = async (lat: number, lng: number, radiusKm: number) => {
    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeFetchAbortRef.current = controller;

    setLoadingFacilities(true);
    setFetchError(null);

    try {
      const res = await fetch(`/api/hospitals/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to reach facility registry`);
      }

      const data = await res.json();
      setIsFallbackData(Boolean(data.isFallback));
      setIsStaleData(Boolean(data.stale));

      const facs = (data.facilities || []).map((f: any) => ({
        id: String(f.id),
        name: f.name,
        type: f.type === "HOSPITAL" ? "HOSPITAL" : "BLOOD_BANK",
        isHospital: f.isHospital ?? (f.type === "HOSPITAL"),
        isBloodBank: true,
        hospitalType: f.hospitalType,
        hospitalCode: f.hospitalCode,
        stateCode: f.stateCode,
        address: f.address,
        phone: f.phone,
        lat: f.lat !== null && f.lat !== undefined ? Number(f.lat) : null,
        lng: f.lng !== null && f.lng !== undefined ? Number(f.lng) : null,
        distanceKm: f.distanceKm ?? undefined,
        verified: f.verified ?? true,
        componentsAvailable: f.componentsAvailable || ["Whole Blood", "Packed Red Blood Cells", "Platelets", "Fresh Frozen Plasma"],
        stock: f.stock || {},
        componentStock: f.componentStock || {},
        lastUpdated: f.lastUpdated || "Live Registry"
      }));

      setRawFacilities(facs);
      setDataSource(data.isFallback ? "Verified Offline Cache" : data.source === "eRaktKosh" ? "eRaktKosh (MoHFW)" : "BloodLink Partner Network");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.warn("Failed to fetch live facilities:", err.message);
        setFetchError(err.message || "Failed to reach live hospital network");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingFacilities(false);
      }
    }
  };

  // State-level search query via eRaktKosh
  const handleSearchByState = async () => {
    if (!selectedStateCode) return;
    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeFetchAbortRef.current = controller;

    setLoadingFacilities(true);
    setFetchError(null);

    try {
      const res = await fetch(`/api/hospitals/nearby?stateCode=${selectedStateCode}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: State query failed`);
      }

      const data = await res.json();
      setIsFallbackData(Boolean(data.isFallback));
      setIsStaleData(Boolean(data.stale));

      let facs = data.facilities || [];
      if (selectedDistrictName) {
        const dLower = selectedDistrictName.toLowerCase();
        const filteredByDist = facs.filter((f: any) =>
          (f.address || "").toLowerCase().includes(dLower) ||
          (f.name || "").toLowerCase().includes(dLower)
        );
        if (filteredByDist.length > 0) {
          facs = filteredByDist;
        }
      }

      const mapped: Facility[] = facs.map((f: any) => ({
        id: String(f.id),
        name: f.name,
        type: f.type === "HOSPITAL" ? "HOSPITAL" : "BLOOD_BANK",
        isHospital: f.isHospital ?? (f.type === "HOSPITAL"),
        isBloodBank: true,
        hospitalType: f.hospitalType,
        hospitalCode: f.hospitalCode,
        stateCode: f.stateCode,
        address: f.address,
        phone: f.phone,
        lat: f.lat ? Number(f.lat) : null,
        lng: f.lng ? Number(f.lng) : null,
        distanceKm: f.distanceKm ?? undefined,
        verified: f.verified ?? true,
        componentsAvailable: f.componentsAvailable || ["Whole Blood", "Packed Red Blood Cells", "Platelets", "Fresh Frozen Plasma"],
        stock: f.stock || {},
        componentStock: f.componentStock || {},
        lastUpdated: "eRaktKosh State Registry"
      }));

      setRawFacilities(mapped);
      setDataSource(data.isFallback ? "Verified Offline Cache" : "eRaktKosh State Database");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.warn("State search failed:", err.message);
        setFetchError(err.message || "State search query failed");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingFacilities(false);
      }
    }
  };

  const detectLocation = async () => {
    setLocating(true);
    setLocationError("");
    try {
      const loc = await getPreciseLiveLocation();
      const roundedLat = Math.round(loc.lat * 10000) / 10000;
      const roundedLng = Math.round(loc.lng * 10000) / 10000;

      // Stabilize coordinate object reference if within ~11 meters
      if (
        !prevCoordsRef.current ||
        Math.hypot(roundedLat - prevCoordsRef.current.lat, roundedLng - prevCoordsRef.current.lng) > 0.0001
      ) {
        prevCoordsRef.current = { lat: roundedLat, lng: roundedLng };
        setUserLocation({
          lat: roundedLat,
          lng: roundedLng,
          address: loc.address || "Current Live Location"
        });
      }
    } catch {
      setUserLocation(null);
      setLocationError("Location permission denied or unavailable. Please type a hospital name or search by State/District.");
    } finally {
      setLocating(false);
    }
  };

  // Compute facility distances and apply all search filters
  const processedFacilities = rawFacilities.map((fac) => {
    let dist = fac.distanceKm ?? 0;
    if (userLocation && fac.lat && fac.lng) {
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
    if (selectedType === "HOSPITAL") {
      if (!fac.isHospital && fac.type !== "HOSPITAL") return false;
    } else if (selectedType === "BLOOD_BANK") {
      // In India all facilities in this registry are blood centers
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

    // 5. Max Radius filter (applied only in GPS mode when NO text search term is active)
    if (searchMode === "GPS" && !searchTerm.trim() && userLocation && maxRadius < 500 && (fac.distanceKm || 0) > maxRadius) {
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

  // Google-like typeahead suggestions derived instantaneously from live registry
  const typeaheadSuggestions = (() => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) {
      // Empty query: Show nearest / top 6 facilities as Google-style quick picks
      return processedFacilities.slice(0, 6);
    }
    // Filter facilities where name, address, or phone matches
    const matches = processedFacilities.filter((fac) => {
      return (
        fac.name.toLowerCase().includes(trimmed) ||
        fac.address.toLowerCase().includes(trimmed) ||
        fac.phone.includes(trimmed)
      );
    });
    // Sort relevance: exact match in name first, then address, then proximity
    matches.sort((a, b) => {
      const aNameHas = a.name.toLowerCase().includes(trimmed);
      const bNameHas = b.name.toLowerCase().includes(trimmed);
      if (aNameHas && !bNameHas) return -1;
      if (!aNameHas && bNameHas) return 1;
      return (a.distanceKm || 0) - (b.distanceKm || 0);
    });
    return matches.slice(0, 8);
  })();

  // Highlight query matches in name and address
  const renderHighlightedText = (text: string, query: string) => {
    if (!query || !query.trim()) return <span>{text}</span>;
    const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${q})`, "gi");
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark
              key={i}
              className="bg-amber-300/50 dark:bg-amber-400/30 text-[#D62828] dark:text-[#ff7878] font-black rounded-sm px-0.5 not-italic"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Facility selection from dropdown
  const handleSelectFacility = (fac: Facility) => {
    setSearchTerm(fac.name);
    setIsDropdownOpen(false);
    setHighlightedFacilityId(fac.id);
    setTimeout(() => {
      const el = document.getElementById(`facility-${fac.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
    setTimeout(() => {
      setHighlightedFacilityId(null);
    }, 3500);
  };

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isDropdownOpen) {
        setIsDropdownOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < typeaheadSuggestions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isDropdownOpen) {
        setIsDropdownOpen(true);
        setHighlightedIndex(typeaheadSuggestions.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : typeaheadSuggestions.length - 1
        );
      }
    } else if (e.key === "Enter") {
      if (isDropdownOpen && highlightedIndex >= 0 && typeaheadSuggestions[highlightedIndex]) {
        e.preventDefault();
        handleSelectFacility(typeaheadSuggestions[highlightedIndex]);
      } else {
        setIsDropdownOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-[#0F766E]/10 border border-[#0F766E]/30 rounded-xl font-mono text-xs text-[#0F766E] dark:text-[#6FD6BC]">
          <span className="flex items-center gap-2">
            <span>📍</span>
            <span>Your Current Location: <strong>{userLocation.address || `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`}</strong></span>
          </span>
          <span className="text-[10px] uppercase font-bold bg-[#0F766E]/20 px-2.5 py-1 rounded-full self-start sm:self-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0F766E] animate-pulse" />
            {loadingFacilities ? "Fetching Live eRaktKosh Data..." : `eRaktKosh MoHFW: ${rawFacilities.length} Facilities`}
          </span>
        </div>
      )}

      {locationError && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-xl font-mono text-xs">
          ⚠️ {locationError}
        </div>
      )}

      {/* STALE / OFFLINE CACHE BANNER */}
      {(isFallbackData || isStaleData) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl font-mono text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Operating in Offline / Cached Mode:</strong> Upstream eRaktKosh gateway is slow or unreachable. Showing verified local backup inventory.
            </span>
          </div>
          <button
            onClick={() => {
              if (searchMode === "GPS" && userLocation) {
                fetchLiveFacilities(userLocation.lat, userLocation.lng, maxRadius);
              } else {
                handleSearchByState();
              }
            }}
            disabled={loadingFacilities}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[11px] font-bold shrink-0 transition-colors"
          >
            {loadingFacilities ? "Retrying..." : "Check Live Updates ↺"}
          </button>
        </div>
      )}

      {/* SEARCH CONTROLS & FILTERS BAR */}
      <div className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-4">
        
        {/* Search Mode Switcher Tabs */}
        <div className="flex border-b border-[#E2E4E1] dark:border-[#2A3547] gap-2 pb-2">
          <button
            onClick={() => setSearchMode("GPS")}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              searchMode === "GPS"
                ? "bg-[#D62828] text-white shadow-sm"
                : "bg-gray-100 dark:bg-[#101720] text-secondary-var hover:text-[#14213D] dark:hover:text-white"
            }`}
          >
            <span>📍</span>
            <span>Nearby GPS Search</span>
          </button>
          
          <button
            onClick={() => {
              setSearchMode("STATE");
              handleSearchByState();
            }}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              searchMode === "STATE"
                ? "bg-[#D62828] text-white shadow-sm"
                : "bg-gray-100 dark:bg-[#101720] text-secondary-var hover:text-[#14213D] dark:hover:text-white"
            }`}
          >
            <span>🏛️</span>
            <span>State & District Search (All India)</span>
          </button>
        </div>

        {/* State & District Selector (when in STATE mode) */}
        {searchMode === "STATE" && (
          <div className="p-4 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] space-y-3">
            <div className="text-[11px] font-mono font-bold uppercase text-[#0F766E] dark:text-[#6FD6BC]">
              Select State & District from Official National Registry:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-secondary-var block mb-1">State</label>
                <select
                  value={selectedStateCode}
                  onChange={(e) => {
                    setSelectedStateCode(e.target.value);
                    setSelectedDistrictName("");
                  }}
                  className="w-full bg-white dark:bg-[#182233] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none"
                >
                  {states.map((s) => (
                    <option key={s.stateCode} value={s.stateCode}>
                      {s.stateName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-secondary-var block mb-1">District</label>
                <select
                  value={selectedDistrictName}
                  onChange={(e) => setSelectedDistrictName(e.target.value)}
                  className="w-full bg-white dark:bg-[#182233] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none"
                >
                  <option value="">All Districts in State</option>
                  {currentDistricts.map((d) => (
                    <option key={d.districtCode} value={d.districtName}>
                      {d.districtName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleSearchByState}
                  disabled={loadingFacilities}
                  className="w-full py-2.5 bg-[#0F766E] hover:bg-[#0d635c] text-white font-mono font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>{loadingFacilities ? "⏳ Fetching..." : "🔍 Search State Facilities"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Google-Grade Search Bar with Floating Typeahead Autocomplete */}
        <div ref={searchContainerRef} className="relative z-30">
          <div
            className={`flex items-center bg-[#F6F7F5] dark:bg-[#101720] border transition-all duration-200 shadow-sm ${
              isDropdownOpen
                ? "rounded-t-2xl border-[#D62828] dark:border-[#D62828] ring-2 ring-[#D62828]/20 shadow-lg bg-white dark:bg-[#182233]"
                : "rounded-2xl border-[#E2E4E1] dark:border-[#2A3547] hover:border-[#14213D]/40 dark:hover:border-white/40 focus-within:border-[#D62828] focus-within:ring-2 focus-within:ring-[#D62828]/20"
            }`}
          >
            {/* Search Icon / Live Spinner */}
            <div className="pl-4 pr-2 text-secondary-var flex items-center shrink-0">
              {loadingFacilities ? (
                <span className="w-5 h-5 border-2 border-[#D62828] border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <span className="text-lg">🔍</span>
              )}
            </div>

            {/* Input Field */}
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsDropdownOpen(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search hospitals, blood banks, street address, or city (e.g. 'Cooper', 'Tata', 'Apollo', 'Lilavati')..."
              className="w-full bg-transparent text-[#14213D] dark:text-white py-4 pr-3 text-xs md:text-sm font-mono font-bold focus:outline-none placeholder:text-[#5B6472] dark:placeholder:text-[#9AA5B4]"
            />

            {/* Keyboard shortcut or Clear button */}
            <div className="flex items-center gap-2 pr-3 shrink-0">
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setHighlightedIndex(-1);
                    inputRef.current?.focus();
                  }}
                  className="px-2 py-1 text-xs font-mono font-bold text-secondary-var hover:text-[#D62828] hover:bg-gray-100 dark:hover:bg-[#101720] rounded-lg transition-colors"
                  title="Clear search"
                >
                  ✕ Clear
                </button>
              ) : (
                <span className="hidden sm:inline-block text-[10px] font-mono text-secondary-var bg-gray-200/60 dark:bg-white/10 px-2 py-0.5 rounded-md">
                  Google-Style Live Search
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="px-3.5 py-2 bg-[#D62828] hover:bg-[#b01f1f] text-white font-mono font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                Search
              </button>
            </div>
          </div>

          {/* Google-Style Floating Predictive Typeahead Dropdown */}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 top-full bg-white dark:bg-[#182233] border-x border-b border-[#D62828] dark:border-[#D62828] rounded-b-2xl shadow-2xl overflow-hidden z-50 divide-y divide-[#E2E4E1] dark:divide-[#2A3547]">
              {/* Dropdown Header */}
              <div className="px-4 py-2 bg-[#F6F7F5] dark:bg-[#101720] flex items-center justify-between text-[11px] font-mono text-secondary-var">
                <span className="font-bold text-[#14213D] dark:text-white flex items-center gap-1.5">
                  {searchTerm.trim() ? (
                    <>
                      <span>🔍 Matching Facilities</span>
                      <span className="text-[10px] bg-[#D62828]/10 text-[#D62828] font-black px-1.5 py-0.5 rounded-full">
                        {typeaheadSuggestions.length} found
                      </span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Popular & Nearby Facilities</span>
                      <span className="text-[10px] bg-[#0F766E]/10 text-[#0F766E] font-black px-1.5 py-0.5 rounded-full">
                        Quick Picks
                      </span>
                    </>
                  )}
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 text-[10px]">
                  <span>Use</span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded font-bold">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded font-bold">↓</kbd>
                  <span>to navigate,</span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded font-bold">Enter</kbd>
                  <span>to select</span>
                </span>
              </div>

              {/* Suggestions List */}
              {typeaheadSuggestions.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-secondary-var space-y-1">
                  <div>No facilities found matching &ldquo;{searchTerm}&rdquo;</div>
                  <div className="text-[10px] opacity-75">
                    Press Enter to query the national network or adjust your search term.
                  </div>
                </div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto divide-y divide-[#E2E4E1]/50 dark:divide-[#2A3547]/50">
                  {typeaheadSuggestions.map((fac, idx) => {
                    const isSelected = highlightedIndex === idx;
                    const totalUnits = Object.values(fac.stock || {}).reduce((sum, u) => sum + u, 0);

                    return (
                      <div
                        key={fac.id}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => handleSelectFacility(fac)}
                        className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#D62828]/10 dark:bg-[#D62828]/20 border-l-4 border-[#D62828]"
                            : "hover:bg-[#F6F7F5] dark:hover:bg-[#101720]"
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {/* Facility Icon */}
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${
                              fac.type === "HOSPITAL"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                : "bg-[#D62828]/10 text-[#D62828] border border-[#D62828]/20"
                            }`}
                          >
                            {fac.type === "HOSPITAL" ? "🏥" : "🩸"}
                          </div>

                          <div className="min-w-0 flex-1">
                            {/* Title & Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs md:text-sm font-bold text-[#14213D] dark:text-white truncate">
                                {renderHighlightedText(fac.name, searchTerm)}
                              </h4>
                              <span
                                className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                                  fac.type === "HOSPITAL"
                                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
                                    : "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300"
                                }`}
                              >
                                {fac.type === "HOSPITAL" ? "Hospital" : "Blood Bank"}
                              </span>
                              {fac.verified && (
                                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                  ✓ Verified
                                </span>
                              )}
                            </div>

                            {/* Address */}
                            <p className="text-[11px] text-[#5B6472] dark:text-[#9AA5B4] truncate mt-0.5">
                              📍 {renderHighlightedText(fac.address, searchTerm)}
                            </p>
                          </div>
                        </div>

                        {/* Right side stats & quick actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {fac.distanceKm !== undefined && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[10px] font-mono font-bold text-[#14213D] dark:text-white rounded-lg">
                              {fac.distanceKm} km
                            </span>
                          )}

                          <span
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-extrabold ${
                              totalUnits > 0
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                            }`}
                          >
                            {totalUnits > 0 ? `🩸 ${totalUnits} units` : "Out of stock"}
                          </span>

                          <span className="hidden sm:inline-block text-xs text-secondary-var font-mono">
                            ↵ Select
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dropdown Footer */}
              <div className="px-4 py-2 bg-[#F6F7F5]/70 dark:bg-[#101720]/70 flex items-center justify-between text-[10px] font-mono text-secondary-var">
                <span>
                  {searchTerm.trim()
                    ? `Showing instant matches for "${searchTerm}". Click to inspect full stock.`
                    : "Click any facility to view detailed stock and hospital info."}
                </span>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(false)}
                  className="hover:underline font-bold text-[#D62828]"
                >
                  Close [Esc]
                </button>
              </div>
            </div>
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
              <option value="ALL">All Facilities (Hospitals & Blood Banks)</option>
              <option value="HOSPITAL">Hospitals & Medical Centers</option>
              <option value="BLOOD_BANK">Blood Banks & Storage Centers</option>
            </select>
          </div>

          {/* Max Distance Radius (GPS Mode Only) */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-secondary-var">Distance Radius</label>
            <select
              value={maxRadius}
              onChange={(e) => setMaxRadius(Number(e.target.value))}
              className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none"
            >
              <option value={3}>Immediate Proximity (3 km)</option>
              <option value={10}>Within 10 km</option>
              <option value={25}>Within 25 km</option>
              <option value={50}>Within 50 km</option>
              <option value={90}>Extended Perimeter (90 km)</option>
              <option value={150}>Regional (150 km)</option>
              <option value={1000}>All Region / Any Distance</option>
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

      {/* RESULTS LIST, SKELETON, OR ERROR */}
      {loadingFacilities && rawFacilities.length === 0 ? (
        <div className="space-y-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-4 animate-pulse"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  </div>
                  <div className="h-7 w-2/3 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                  <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((m) => (
                  <div key={m} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : fetchError && rawFacilities.length === 0 ? (
        <div className="bg-red-500/10 border-2 border-red-500/30 p-8 md:p-12 rounded-2xl text-center space-y-4">
          <span className="text-4xl">⚠️</span>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-red-700 dark:text-red-400 font-mono">
              Unable to Load Hospital & Blood Bank Registry
            </h3>
            <p className="text-xs text-secondary-var max-w-lg mx-auto font-mono">
              {fetchError}. Upstream eRaktKosh gateway or network connection timed out.
            </p>
          </div>
          <button
            onClick={() => {
              if (searchMode === "GPS" && userLocation) {
                fetchLiveFacilities(userLocation.lat, userLocation.lng, maxRadius);
              } else {
                handleSearchByState();
              }
            }}
            className="px-6 py-2.5 bg-[#D62828] hover:bg-[#b01f1f] text-white font-mono font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Retry Search</span>
          </button>
        </div>
      ) : filteredFacilities.length === 0 ? (
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
                id={`facility-${fac.id}`}
                className={`bg-white dark:bg-[#182233] p-6 md:p-7 rounded-2xl border transition-all space-y-6 ${
                  highlightedFacilityId === fac.id
                    ? "ring-4 ring-[#D62828] border-[#D62828] shadow-2xl scale-[1.01] duration-300"
                    : "border-[#E2E4E1] dark:border-[#2A3547] shadow-sm hover:shadow-md"
                }`}
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
                {(() => {
                  const activeStock = (selectedComponent !== "All Components" && fac.componentStock?.[selectedComponent])
                    ? fac.componentStock[selectedComponent]
                    : fac.stock;
                  const totalUnits = Object.values(activeStock || {}).reduce((sum, u) => sum + u, 0);

                  return (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono font-bold">
                        <span className="text-secondary-var uppercase flex items-center gap-1.5">
                          <span>🩸</span>
                          <span>
                            {selectedComponent === "All Components"
                              ? `All Available Blood Stock Breakdown (${totalUnits} total units):`
                              : `${selectedComponent} Stock Breakdown (${totalUnits} units):`}
                          </span>
                        </span>
                        <span className="text-[#0F766E] dark:text-[#6FD6BC] text-[11px]">
                          Components in Stock: {fac.componentsAvailable && fac.componentsAvailable.length > 0 ? fac.componentsAvailable.join(", ") : "Standard Components"}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {BLOOD_GROUPS.map((bg) => {
                          const units = activeStock[bg] ?? 0;
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
                              <span className="text-[9px] font-mono text-secondary-var uppercase block mt-0.5 font-bold">
                                {isOutOfStock ? "EMPTY" : isLow ? "LOW" : "IN STOCK"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

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
