"use client";

import Link from "next/link";
import MapView from "@/components/maps/MapView";

export default function MapPreview() {
  const previewMarkers = [
    { id: "e1", lat: 18.5204, lng: 73.8567, title: "🚨 Critical Request — O- (Trauma ICU)", type: "EMERGENCY" as const },
    { id: "h1", lat: 18.5314, lng: 73.8446, title: "🏥 City General Hospital", type: "HOSPITAL" as const },
    { id: "h2", lat: 18.5124, lng: 73.8687, title: "🏥 Ruby Hall Clinic", type: "HOSPITAL" as const },
    { id: "b1", lat: 18.5254, lng: 73.8617, title: "🩸 Regional Blood Bank Storage", type: "BLOOD_BANK" as const },
    { id: "d1", lat: 18.5224, lng: 73.8507, title: "👤 Verified Donor (O+)", type: "DONOR" as const },
    { id: "d2", lat: 18.5184, lng: 73.8607, title: "👤 Verified Donor (A+)", type: "DONOR" as const },
    { id: "d3", lat: 18.5274, lng: 73.8527, title: "👤 Verified Donor (O-)", type: "DONOR" as const }
  ];

  return (
    <section className="py-20 bg-[#F6F7F5] dark:bg-[#101720] border-b border-[#E2E4E1] dark:border-[#2A3547]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-8">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#6FD6BC]">
            Geospatial Coverage
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] tracking-tight">
            See what's happening near you
          </h2>
          <p className="text-sm sm:text-base text-[#5B6472] dark:text-[#9AA5B4] font-body">
            Active requests, nearby donors, and blood bank inventory — all on one map.
          </p>
        </div>

        {/* Map View Container */}
        <div className="h-96 w-full rounded-2xl overflow-hidden shadow-lg border border-[#E2E4E1] dark:border-[#2A3547] relative">
          <MapView
            initialLat={18.5204}
            initialLng={73.8567}
            zoom={12}
            markers={previewMarkers}
          />
        </div>

        {/* Legend & Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 card-surface p-4 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233]">
          {/* Legend Items */}
          <div className="flex flex-wrap items-center gap-6 font-mono text-xs text-[#14213D] dark:text-[#F6F7F5]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#D62828] animate-pulse inline-block" />
              <span>Active emergency</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#0F766E] inline-block" />
              <span>Available donor</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#C97A2B] inline-block" />
              <span>Blood bank</span>
            </div>
          </div>

          {/* CTA Link */}
          <Link
            href="/map"
            className="font-heading font-extrabold text-xs text-[#0F766E] dark:text-[#6FD6BC] hover:underline flex items-center gap-1 font-mono shrink-0"
          >
            <span>Enable location to see donors near you</span>
            <span>→</span>
          </Link>
        </div>

      </div>
    </section>
  );
}
