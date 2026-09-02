"use client";

import { useState } from "react";
import { getPreciseLiveLocation } from "@/lib/geo/location";

export default function LocationPrompt({ onLocationGranted, onSkip }) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [locationDetails, setLocationDetails] = useState(null);

  const handleRequestLocation = async () => {
    try {
      setRequesting(true);
      setError("");

      const loc = await getPreciseLiveLocation();
      setLocationDetails(loc);
      setRequesting(false);

      if (onLocationGranted) {
        onLocationGranted({ lat: loc.lat, lng: loc.lng, address: loc.address });
      }
    } catch (err) {
      setRequesting(false);
      console.warn("Live location error:", err.message);
      setError(err.message || "Could not fetch live location. Please allow location access.");
    }
  };

  return (
    <div className="card-surface p-6 rounded-2xl border shadow-md space-y-4 max-w-xl mx-auto my-4 bg-white dark:bg-[#182233]">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#0F766E]/10 text-[#0F766E] dark:text-[#6FD6BC] flex items-center justify-center text-2xl shrink-0">
          📍
        </div>

        <div className="space-y-1">
          <h3 className="font-heading text-lg font-extrabold text-primary-var">
            Find Precise Live Location & Facilities
          </h3>
          <p className="text-xs text-secondary-var leading-relaxed">
            Share your high-accuracy GPS location to scan expanding radius distances (5 km → 10 km → 20 km) for emergency blood supply and nearby hospital ICU beds.
          </p>
        </div>
      </div>

      {locationDetails && (
        <div className="p-3 bg-[#0F766E]/10 text-[#0F766E] dark:text-[#6FD6BC] border border-[#0F766E]/20 rounded-xl text-xs font-mono">
          <span className="font-bold block">✓ High-Accuracy GPS Position Acquired:</span>
          <span>Lat: {locationDetails.lat.toFixed(4)}, Lng: {locationDetails.lng.toFixed(4)} (±{locationDetails.accuracyMeters}m)</span>
          {locationDetails.address && (
            <span className="block mt-1 font-sans text-secondary-var">{locationDetails.address}</span>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-[#D62828]/10 text-[#D62828] border border-[#D62828]/30 rounded-xl text-xs font-mono font-bold">
          ⚠️ {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-[#2A3547] rounded-xl text-xs font-mono font-semibold text-secondary-var hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Skip for now
          </button>
        )}

        <button
          type="button"
          disabled={requesting}
          onClick={handleRequestLocation}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#D62828] hover:bg-red-700 text-white text-xs font-mono font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-2"
        >
          <span>📍</span>
          <span>{requesting ? "Acquiring High-Accuracy GPS..." : "Enable Precise Live Location"}</span>
        </button>
      </div>
    </div>
  );
}
