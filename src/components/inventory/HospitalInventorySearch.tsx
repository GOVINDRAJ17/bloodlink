"use client";

import { useState, useEffect, useRef } from "react";
import { MonoData } from "@/app/components/ui/Badge";
import { getPreciseLiveLocation } from "@/lib/geo/location";
import Link from "next/link";

interface HospitalFacility {
  id: string;
  name: string;
  type: string;
  hospitalType?: string;
  distanceKm?: number | null;
  address: string;
  phone: string;
  email?: string;
  lat?: number | null;
  lng?: number | null;
  hospitalCode?: string | null;
  stateCode?: string | null;
  verified: boolean;
  stock?: Record<string, number>;
  source?: string;
  lastUpdated?: string;
}

interface HospitalInventory {
  hospitalName: string;
  hospitalType?: string;
  address: string;
  phone: string;
  distanceKm?: number | null;
  lat?: number | null;
  lng?: number | null;
  hospitalCode?: string | null;
  stateCode?: string | null;
  lastUpdated: string;
  source?: string;
  inventory: { bloodGroup: string; availableUnits: number; status: "AVAILABLE" | "LOW" | "UNAVAILABLE" }[];
}

export default function HospitalInventorySearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [isTypeaheadSearching, setIsTypeaheadSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [fetchingStock, setFetchingStock] = useState(false);
  const [hospitalsList, setHospitalsList] = useState<HospitalFacility[]>([]);
  const [searchedHospital, setSearchedHospital] = useState<HospitalInventory | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  // Google-Style Predictive Dropdown states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Close dropdown on click outside
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

  // Attempt live GPS detection on mount
  useEffect(() => {
    detectLocationAndLoad();
  }, []);

  const detectLocationAndLoad = async () => {
    setLoadingList(true);
    setLocationDenied(false);

    let detectedCoords: { lat: number; lng: number } | null = null;
    try {
      const loc = await getPreciseLiveLocation();
      detectedCoords = { lat: loc.lat, lng: loc.lng };
      setUserCoords(detectedCoords);
    } catch {
      setUserCoords(null);
      setLocationDenied(true);
    }

    try {
      const params = new URLSearchParams();
      params.append("type", "HOSPITAL");
      if (detectedCoords) {
        params.append("lat", String(detectedCoords.lat));
        params.append("lng", String(detectedCoords.lng));
        params.append("radiusKm", "50");
      }

      const res = await fetch(`/api/hospitals/nearby?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const facs = (data.facilities || []).filter((f: any) => f.type === "HOSPITAL");
        setHospitalsList(facs);
      }
    } catch (err) {
      console.error("Failed to load initial hospitals list:", err);
    } finally {
      setLoadingList(false);
    }
  };

  // Convert raw stock dictionary to inventory array
  const formatInventory = (stockDict: Record<string, number> = {}) => {
    const groups = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];
    return groups.map(bg => {
      const units = stockDict[bg] ?? 0;
      let status: "AVAILABLE" | "LOW" | "UNAVAILABLE" = "AVAILABLE";
      if (units === 0) status = "UNAVAILABLE";
      else if (units <= 3) status = "LOW";

      return {
        bloodGroup: bg,
        availableUnits: units,
        status
      };
    });
  };

  // Select a hospital and fetch its live stock
  const handleSelectHospital = async (hosp: HospitalFacility) => {
    setFetchingStock(true);
    setHasSearched(true);

    let stockData = hosp.stock || {};

    // If hospitalCode & stateCode exist, fetch direct live availability from eRaktKosh
    if (hosp.hospitalCode && hosp.stateCode) {
      try {
        const res = await fetch(`/api/hospitals/nearby?stockCode=${hosp.hospitalCode}&stateCode=${hosp.stateCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stock && Object.keys(data.stock).length > 0) {
            stockData = data.stock;
          }
        }
      } catch (e) {
        console.warn("Could not fetch live stock breakdown:", e);
      }
    }

    setSearchedHospital({
      hospitalName: hosp.name,
      hospitalType: hosp.hospitalType,
      address: hosp.address,
      phone: hosp.phone,
      distanceKm: hosp.distanceKm,
      lat: hosp.lat,
      lng: hosp.lng,
      hospitalCode: hosp.hospitalCode,
      stateCode: hosp.stateCode,
      lastUpdated: "Live eRaktKosh Registry",
      source: hosp.source || "eRaktKosh (MoHFW)",
      inventory: formatInventory(stockData)
    });

    setFetchingStock(false);
  };

  // Live Typeahead search effect with Debounce (~300ms) & AbortController
  useEffect(() => {
    const trimmed = searchTerm.trim();

    // Empty input: reset typeahead state without showing error
    if (!trimmed) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsTypeaheadSearching(false);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      // Cancel previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsTypeaheadSearching(true);
      setSearchError(null);
      setHasSearched(true);

      try {
        const params = new URLSearchParams();
        params.append("query", trimmed);
        params.append("type", "HOSPITAL");
        if (userCoords?.lat && userCoords?.lng) {
          params.append("lat", String(userCoords.lat));
          params.append("lng", String(userCoords.lng));
          params.append("radiusKm", "100");
        }

        const res = await fetch(`/api/hospitals/nearby?${params.toString()}`, {
          signal: controller.signal
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const data = await res.json();
        const facilities: HospitalFacility[] = data.facilities || [];
        setHospitalsList(facilities);

        if (facilities.length === 0) {
          setSearchedHospital(null);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // Ignored superseded in-flight query
          return;
        }
        console.error("Live hospital typeahead error:", err);
        setSearchError("Network failure searching live hospitals. Please verify your connection.");
      } finally {
        setIsTypeaheadSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm, userCoords]);

  // Form submit handler for instant search on Enter
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      params.append("query", trimmed);
      params.append("type", "HOSPITAL");
      if (userCoords?.lat && userCoords?.lng) {
        params.append("lat", String(userCoords.lat));
        params.append("lng", String(userCoords.lng));
        params.append("radiusKm", "100");
      }

      const res = await fetch(`/api/hospitals/nearby?${params.toString()}`, {
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      const facilities: HospitalFacility[] = data.facilities || [];
      setHospitalsList(facilities);

      if (facilities.length > 0) {
        await handleSelectHospital(facilities[0]);
      } else {
        setSearchedHospital(null);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Manual inventory search error:", err);
        setSearchError("Network error while querying hospital records.");
      }
    } finally {
      setSearching(false);
    }
  };

  // Google-like live autocomplete suggestions
  const typeaheadSuggestions = (() => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) {
      return hospitalsList.slice(0, 5);
    }
    const matches = hospitalsList.filter((fac) => {
      return (
        fac.name.toLowerCase().includes(trimmed) ||
        fac.address.toLowerCase().includes(trimmed) ||
        fac.phone.includes(trimmed)
      );
    });
    matches.sort((a, b) => {
      const aNameHas = a.name.toLowerCase().includes(trimmed);
      const bNameHas = b.name.toLowerCase().includes(trimmed);
      if (aNameHas && !bNameHas) return -1;
      if (!aNameHas && bNameHas) return 1;
      return (a.distanceKm || 0) - (b.distanceKm || 0);
    });
    return matches.slice(0, 8);
  })();

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
              className="bg-amber-300/50 dark:bg-amber-400/30 text-[#0F766E] dark:text-[#6FD6BC] font-black rounded-sm px-0.5 not-italic"
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

  const handleSelectDropdownItem = (fac: HospitalFacility) => {
    setSearchTerm(fac.name);
    setIsDropdownOpen(false);
    handleSelectHospital(fac);
  };

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
        handleSelectDropdownItem(typeaheadSuggestions[highlightedIndex]);
      } else {
        setIsDropdownOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#6FD6BC] bg-[#0F766E]/10 px-2 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E] animate-pulse" />
              Live Hospital & Blood Centre Registry
            </span>
            {hospitalsList.length > 0 && (
              <span className="text-[10px] font-mono text-secondary-var">
                • {hospitalsList.length} Facilities Found
              </span>
            )}
          </div>
          <h3 className="font-heading text-lg font-extrabold text-[#14213D] dark:text-[#F6F7F5] mt-1">
            Smart Live Hospital Search
          </h3>
          <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4]">
            Type any letter or name to query registered hospitals in real-time across the live database and national eRaktKosh network.
          </p>
        </div>

        <button
          onClick={detectLocationAndLoad}
          disabled={loadingList}
          className="text-xs font-mono font-bold text-[#0F766E] dark:text-[#6FD6BC] hover:underline self-start sm:self-center"
        >
          {loadingList ? "↻ Detecting & Refreshing..." : "↻ Refresh Facilities"}
        </button>
      </div>

      {/* Geolocation status notice if denied */}
      {locationDenied && (
        <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] font-mono text-blue-800 dark:text-blue-300 flex items-center justify-between">
          <span>📍 GPS disabled or unavailable — search is querying the full national registry.</span>
          <button
            onClick={detectLocationAndLoad}
            className="underline font-bold hover:opacity-80 ml-2"
          >
            Enable GPS
          </button>
        </div>
      )}

      {/* Main Google-Grade Search Bar with Floating Predictive Autocomplete */}
      <div ref={searchContainerRef} className="relative z-30">
        <form onSubmit={handleSearch}>
          <div
            className={`flex items-center bg-[#F6F7F5] dark:bg-[#101720] border transition-all duration-200 shadow-sm ${
              isDropdownOpen
                ? "rounded-t-2xl border-[#0F766E] dark:border-[#0F766E] ring-2 ring-[#0F766E]/20 shadow-lg bg-white dark:bg-[#182233]"
                : "rounded-2xl border-[#E2E4E1] dark:border-[#2A3547] hover:border-[#14213D]/40 dark:hover:border-white/40 focus-within:border-[#0F766E] focus-within:ring-2 focus-within:ring-[#0F766E]/20"
            }`}
          >
            {/* Search Icon / Live Spinner */}
            <div className="pl-4 pr-2 text-secondary-var flex items-center shrink-0">
              {searching || isTypeaheadSearching ? (
                <span className="w-4 h-4 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <span className="text-base">🔍</span>
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
              placeholder="Search hospitals by name, area, or address (e.g. 'Cooper', 'Tata', 'Apollo', 'Jaslok')..."
              className="w-full bg-transparent text-[#14213D] dark:text-white py-3.5 pr-3 text-xs md:text-sm font-mono font-bold focus:outline-none placeholder:text-[#5B6472] dark:placeholder:text-[#9AA5B4]"
            />

            {/* Clear / Status & Search Button */}
            <div className="flex items-center gap-2 pr-3 shrink-0">
              {searchTerm && (
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
              )}

              <button
                type="submit"
                disabled={searching || !searchTerm.trim()}
                className="px-4 py-2 bg-[#0F766E] hover:bg-[#0d635c] text-white font-mono font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
        </form>

        {/* Google-Style Floating Predictive Typeahead Dropdown */}
        {isDropdownOpen && (
          <div className="absolute left-0 right-0 top-full bg-white dark:bg-[#182233] border-x border-b border-[#0F766E] dark:border-[#0F766E] rounded-b-2xl shadow-2xl overflow-hidden z-50 divide-y divide-[#E2E4E1] dark:divide-[#2A3547]">
            {/* Dropdown Header */}
            <div className="px-4 py-2 bg-[#F6F7F5] dark:bg-[#101720] flex items-center justify-between text-[11px] font-mono text-secondary-var">
              <span className="font-bold text-[#14213D] dark:text-white flex items-center gap-1.5">
                {searchTerm.trim() ? (
                  <>
                    <span>🔍 Hospital Matches</span>
                    <span className="text-[10px] bg-[#0F766E]/10 text-[#0F766E] font-black px-1.5 py-0.5 rounded-full">
                      {typeaheadSuggestions.length} found
                    </span>
                  </>
                ) : (
                  <>
                    <span>⚡ Quick Hospital Picks</span>
                    <span className="text-[10px] bg-[#0F766E]/10 text-[#0F766E] font-black px-1.5 py-0.5 rounded-full">
                      Nearby
                    </span>
                  </>
                )}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px]">
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
                <div>No hospitals found matching &ldquo;{searchTerm}&rdquo;</div>
                <div className="text-[10px] opacity-75">Press Search to query national live registry</div>
              </div>
            ) : (
              <div className="max-h-[340px] overflow-y-auto divide-y divide-[#E2E4E1]/50 dark:divide-[#2A3547]/50">
                {typeaheadSuggestions.map((fac, idx) => {
                  const isSelected = highlightedIndex === idx;

                  return (
                    <div
                      key={fac.id}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelectDropdownItem(fac)}
                      className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#0F766E]/10 dark:bg-[#0F766E]/20 border-l-4 border-[#0F766E]"
                          : "hover:bg-[#F6F7F5] dark:hover:bg-[#101720]"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center text-base shrink-0">
                          🏥
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs md:text-sm font-bold text-[#14213D] dark:text-white truncate">
                              {renderHighlightedText(fac.name, searchTerm)}
                            </h4>
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                              {fac.hospitalType || "Hospital"}
                            </span>
                            {fac.verified && (
                              <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                ✓ Verified
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-[#5B6472] dark:text-[#9AA5B4] truncate mt-0.5">
                            📍 {renderHighlightedText(fac.address, searchTerm)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {fac.distanceKm !== undefined && fac.distanceKm !== null && (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[10px] font-mono font-bold text-[#14213D] dark:text-white rounded-lg">
                            {fac.distanceKm} km
                          </span>
                        )}

                        <span className="hidden sm:inline-block text-xs text-[#0F766E] font-mono font-bold">
                          Inspect Stock ↵
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dropdown Footer */}
            <div className="px-4 py-2 bg-[#F6F7F5]/70 dark:bg-[#101720]/70 flex items-center justify-between text-[10px] font-mono text-secondary-var">
              <span>Click any hospital to inspect real-time blood inventory.</span>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="hover:underline font-bold text-[#0F766E]"
              >
                Close [Esc]
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Network Error Banner */}
      {searchError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 rounded-xl text-xs font-mono">
          ⚠️ {searchError}
        </div>
      )}

      {/* Quick Hospital Selector Pills */}
      {hospitalsList.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-secondary-var">
            <span>
              {searchTerm.trim()
                ? `Hospitals Matching "${searchTerm}" (${hospitalsList.length}):`
                : `Nearby Registered Hospitals (${hospitalsList.length}):`}
            </span>
            {hospitalsList.length > 4 && (
              <span className="text-[10px]">Click any hospital to inspect live inventory</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            {hospitalsList.slice(0, 20).map((h) => {
              const isSelected = searchedHospital?.hospitalName === h.name;
              return (
                <button
                  key={h.id}
                  onClick={() => handleSelectHospital(h)}
                  className={`px-3 py-1.5 rounded-xl text-left font-mono text-xs font-semibold transition-all border ${
                    isSelected
                      ? "bg-[#0F766E] text-white border-[#0F766E] shadow-sm"
                      : "bg-[#F6F7F5] dark:bg-[#101720] text-[#14213D] dark:text-white border-[#E2E4E1] dark:border-[#2A3547] hover:border-[#0F766E]"
                  }`}
                >
                  <span className="font-bold">{h.name.split(",")[0]}</span>
                  <span className="text-[10px] ml-1.5 opacity-80">
                    ({h.distanceKm !== null && h.distanceKm !== undefined ? `${h.distanceKm} km • ` : ""}{h.hospitalType || "Govt"})
                  </span>
                </button>
              );
            })}
            {hospitalsList.length > 20 && (
              <span className="text-[11px] font-mono self-center text-secondary-var px-2">
                +{hospitalsList.length - 20} more hospitals
              </span>
            )}
          </div>
        </div>
      )}

      {/* Loading In-flight State */}
      {isTypeaheadSearching && (
        <div className="p-4 text-center text-xs font-mono text-[#0F766E] dark:text-[#6FD6BC] animate-pulse">
          Searching live hospital database for &ldquo;{searchTerm}&rdquo;...
        </div>
      )}

      {/* INITIAL UNSEARCHED EMPTY STATE */}
      {!hasSearched && hospitalsList.length === 0 && !loadingList && (
        <div className="p-8 text-center border-2 border-dashed border-[#E2E4E1] dark:border-[#2A3547] rounded-2xl space-y-2">
          <span className="text-3xl block">🏥</span>
          <p className="font-mono text-xs text-[#5B6472] dark:text-[#9AA5B4] font-semibold">
            Type a hospital name or letter (e.g. &ldquo;j&rdquo;) above to search real-time records.
          </p>
        </div>
      )}

      {/* NO MATCHES FOUND STATE */}
      {hasSearched && !isTypeaheadSearching && hospitalsList.length === 0 && (
        <div className="p-6 text-center bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1">
          <p className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300">
            No hospitals found matching &ldquo;{searchTerm}&rdquo; in the live registry.
          </p>
          <p className="text-[11px] text-secondary-var">
            Try searching for a different hospital name, city, or partial keyword.
          </p>
        </div>
      )}

      {/* SEARCHED RESULT CARD & TABLE */}
      {searchedHospital && (
        <div className="space-y-4 pt-2">
          {/* Hospital Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl border border-[#E2E4E1] dark:border-[#2A3547]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-mono font-extrabold uppercase">
                  🏥 {searchedHospital.hospitalType || "HOSPITAL"}
                </span>
                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-mono font-bold">
                  ✓ Verified Registry
                </span>
              </div>

              <h4 className="font-heading text-base font-extrabold text-[#14213D] dark:text-[#F6F7F5]">
                {searchedHospital.hospitalName}
              </h4>
              <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4]">
                📍 {searchedHospital.address} • Contact: <strong>{searchedHospital.phone}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-xs shrink-0">
              {searchedHospital.distanceKm !== undefined && searchedHospital.distanceKm !== null && (
                <span className="px-2.5 py-1 bg-[#0F766E]/10 text-[#0F766E] dark:text-[#6FD6BC] rounded-lg font-bold border border-[#0F766E]/20">
                  {searchedHospital.distanceKm} km away
                </span>
              )}

              {searchedHospital.phone && (
                <a
                  href={`tel:${searchedHospital.phone.replace(/[^0-9+]/g, "")}`}
                  className="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0d635c] text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-1"
                >
                  <span>📞 Call</span>
                </a>
              )}

              {searchedHospital.lat && searchedHospital.lng && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${searchedHospital.lat},${searchedHospital.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#14213D]/10 dark:bg-white/10 text-[#14213D] dark:text-white rounded-lg font-bold hover:bg-[#14213D]/20 transition-colors flex items-center gap-1"
                >
                  <span>🗺️ Route</span>
                </a>
              )}
            </div>
          </div>

          {/* Blood Availability Table */}
          <div className="overflow-x-auto rounded-xl border border-[#E2E4E1] dark:border-[#2A3547]">
            <div className="p-3 bg-[#14213D] text-white flex items-center justify-between font-mono text-xs font-bold">
              <span>🩸 Real-time Blood Stock Inventory:</span>
              <span className="text-[10px] text-emerald-300 font-normal">
                {fetchingStock ? "Fetching direct inventory..." : searchedHospital.lastUpdated}
              </span>
            </div>
            <table className="w-full text-left text-xs font-body">
              <thead className="bg-[#14213D]/90 text-white font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">Blood Group</th>
                  <th className="p-3">Availability Status</th>
                  <th className="p-3 text-right">Units Available</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E4E1] dark:divide-[#2A3547]">
                {searchedHospital.inventory.map((row) => (
                  <tr key={row.bloodGroup} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="p-3 font-heading font-extrabold text-sm text-[#14213D] dark:text-[#F6F7F5]">
                      {row.bloodGroup}
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        row.status === "AVAILABLE"
                          ? "bg-[#0F766E]/10 text-[#0F766E] dark:text-[#6FD6BC]"
                          : row.status === "LOW"
                          ? "bg-[#C97A2B]/10 text-[#C97A2B]"
                          : "bg-[#D62828]/10 text-[#D62828]"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <MonoData className="font-black text-sm text-[#14213D] dark:text-[#F6F7F5]">
                        {row.availableUnits > 0 ? `${row.availableUnits} units` : "Inquire at facility"}
                      </MonoData>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/requests/create?hospital=${encodeURIComponent(searchedHospital.hospitalName)}&group=${row.bloodGroup}`}
                        className="text-[11px] font-mono font-bold text-[#D62828] hover:underline"
                      >
                        Request {row.bloodGroup} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
