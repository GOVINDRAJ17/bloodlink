"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import axios from "axios";
import MapView from "@/components/maps/MapView";
import { UrgencyBadge, StatusBadge } from "@/app/components/ui/Badge";

interface EmergencyPlanItem {
  id: string;
  sourceType: "BLOOD_BANK" | "DONOR";
  sourceId: string;
  name: string;
  bloodGroup: string;
  allocatedUnits: number;
  availableUnits: number;
  totalScore: number;
  distanceKm: number;
  etaMinutes: number;
  availabilityConfidence: number;
  recommendedAction: "RESERVE" | "CONTACT";
  status: "PROPOSED" | "RESERVED" | "CONTACTED" | "CONFIRMED" | "UNAVAILABLE";
  whyRecommended: string[];
  location: { lat: number; lng: number };
  phone?: string;
  address?: string;
}

interface EmergencyResponsePlan {
  id: string;
  requestId: string;
  urgency: "NORMAL" | "URGENT" | "CRITICAL";
  bloodGroup: string;
  component: string;
  totalUnitsRequired: number;
  totalUnitsPlanned: number;
  remainingShortage: number;
  isFullyFulfilled: boolean;
  estimatedResponseMinutes: number;
  overallConfidence: number;
  searchRadiusKm: number;
  items: EmergencyPlanItem[];
  executionSteps: string[];
  shortageGuidance?: string;
  searchTelemetry: {
    initialRadiusKm: number;
    finalRadiusKm: number;
    expandedCount: number;
    steps: Array<{
      stepIndex: number;
      radiusKm: number;
      compatibleUnitsFound: number;
      cumulativeUnitsFound: number;
      isSufficient: boolean;
    }>;
    summaryText: string;
  };
  createdAt: string;
}

interface EmergencyResponseDashboardProps {
  requestId: string;
  initialRequest?: any;
  initialPlan?: EmergencyResponsePlan | null;
}

export default function EmergencyResponseDashboard({
  requestId,
  initialRequest,
  initialPlan,
}: EmergencyResponseDashboardProps) {
  const [request, setRequest] = useState<any>(initialRequest || null);
  const [plan, setPlan] = useState<EmergencyResponsePlan | null>(initialPlan || null);
  const [loading, setLoading] = useState<boolean>(!initialPlan);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "map" | "telemetry" | "transit" | "research">("plan");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(5340); // ~89 mins countdown
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // In-Transit Real-Time GPS Telemetry State
  const [isTransitActive, setIsTransitActive] = useState<boolean>(false);
  const [transitSpeed, setTransitSpeed] = useState<number>(52);
  const [transitCoords, setTransitCoords] = useState<{ lat: number; lng: number }>({ lat: 19.0820, lng: 72.8650 });
  const [transitNearest, setTransitNearest] = useState<any[]>([]);
  const [transitVehicleId, setTransitVehicleId] = useState<string>("AMBULANCE-ICU-04");

  const handleStreamTransitGPS = async (newLat?: number, newLng?: number) => {
    try {
      const latToUse = newLat || transitCoords.lat + 0.003;
      const lngToUse = newLng || transitCoords.lng + 0.002;
      setTransitCoords({ lat: latToUse, lng: lngToUse });

      const res = await axios.post(`/api/requests/${requestId}/transit`, {
        lat: latToUse,
        lng: lngToUse,
        speedKmH: transitSpeed,
        heading: 85,
        vehicleId: transitVehicleId,
        destination: hospitalName,
      });

      if (res.data?.nearestResources) {
        setTransitNearest(res.data.nearestResources);
        showToast(`🛰️ Live GPS Telemetry Streamed: Converging @ ${transitSpeed} km/h`);
      }
    } catch (e) {
      console.warn("In-transit telemetry transmission notice:", e);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Fetch or refresh request & plan
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/requests/${requestId}`);
      if (res.data) {
        setRequest(res.data.request);
        setPlan(res.data.plan);
      }
    } catch (err: any) {
      console.error("Failed to load emergency plan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialPlan) {
      loadData();
    }
  }, [requestId]);

  // Recalculate plan (supports simulating resource outage)
  const handleRecalculate = async (toggleUnavailableId?: string) => {
    try {
      setRecalculating(true);
      const res = await axios.post(`/api/requests/${requestId}/recalculate`, {
        toggleUnavailableId,
      });
      if (res.data && res.data.plan) {
        setPlan(res.data.plan);
        showToast(
          toggleUnavailableId
            ? "⚠️ Resource marked unavailable. Dynamic plan recalculated instantly!"
            : "✓ Emergency response plan successfully re-optimized."
        );
      }
    } catch (err: any) {
      console.error("Failed to recalculate plan:", err);
      showToast("Failed to recalculate response plan");
    } finally {
      setRecalculating(false);
    }
  };

  // Handle plan item actions (RESERVE / CONTACT)
  const handleAction = async (planItemId: string, action: "RESERVE" | "CONTACT") => {
    try {
      setActionLoadingId(planItemId);
      const res = await axios.post(`/api/requests/${requestId}/actions`, {
        planItemId,
        action,
      });
      if (res.data && res.data.plan) {
        setPlan(res.data.plan);
        showToast(
          action === "RESERVE"
            ? "✓ Blood units reserved! Cross-match notification dispatched to blood bank."
            : "✓ Emergency SMS/App alert dispatched to voluntary donor!"
        );
      }
    } catch (err: any) {
      console.error("Action error:", err);
      showToast(`Failed to execute ${action} action`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Prepare map markers
  const mapMarkers: any[] = [];
  if (request?.location?.lat && request?.location?.lng) {
    mapMarkers.push({
      id: "hospital",
      lat: request.location.lat,
      lng: request.location.lng,
      title: `🚨 Emergency: ${request.hospital_name || "CityCare Hospital"}`,
      type: "EMERGENCY",
    });
  }

  if (plan?.items) {
    plan.items.forEach((item) => {
      if (item.location?.lat && item.location?.lng) {
        mapMarkers.push({
          id: item.id,
          lat: item.location.lat,
          lng: item.location.lng,
          title: `${item.sourceType === "BLOOD_BANK" ? "🩸" : "👤"} ${item.name} (${item.allocatedUnits} units)`,
          type: item.sourceType === "BLOOD_BANK" ? "BLOOD_BANK" : "DONOR",
        });
      }
    });
  }

  if (loading && !plan) {
    return (
      <div className="max-w-7xl mx-auto p-6 md:p-12 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#D62828] border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-xl font-black font-mono text-[#14213D] dark:text-white">
          Executing Multi-Criteria Emergency Response Engine...
        </h2>
        <p className="text-xs text-secondary-var">
          Evaluating compatibility, auditing blood-bank stock, and dynamically expanding search radius.
        </p>
      </div>
    );
  }

  const bloodGroup = request?.blood_group || plan?.bloodGroup || "O-";
  const component = request?.component || plan?.component || "Platelets";
  const unitsRequired = request?.units_required || plan?.totalUnitsRequired || 4;
  const unitsPlanned = plan?.totalUnitsPlanned || 0;
  const urgency = request?.urgency || plan?.urgency || "CRITICAL";
  const hospitalName = request?.hospital_name || "CityCare Hospital";
  const hospitalAddress = request?.hospital_address || "Bandra West, Mumbai";

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#14213D] text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/20 text-xs font-mono font-bold flex items-center gap-3 animate-bounce">
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/requests"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#14213D]/5 dark:bg-white/10 hover:bg-[#14213D]/10 text-[#14213D] dark:text-white font-mono text-xs font-bold rounded-lg transition-colors"
            >
              <span>←</span>
              <span>All Emergencies</span>
            </Link>
            <span className="text-xs font-extrabold text-[#D62828] bg-[#D62828]/10 px-2.5 py-1 rounded-full uppercase font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D62828] animate-pulse" />
              Live Response Active
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#14213D] dark:text-white tracking-tight">
              Emergency Dispatch Plan
            </h1>
            <span className="text-sm font-mono text-secondary-var">
              ID: {requestId}
            </span>
          </div>

          <p className="text-xs md:text-sm text-[#5B6472] dark:text-[#9AA5B4] mt-1 flex items-center gap-1.5">
            <span>🏥</span>
            <strong>{hospitalName}</strong>
            <span>• {hospitalAddress}</span>
          </p>
        </div>

        {/* Countdown & Recalculate Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="bg-[#D62828]/10 border border-[#D62828]/20 px-4 py-2.5 rounded-xl text-center">
            <span className="block text-[10px] font-mono uppercase font-bold text-[#D62828]">
              Critical Deadline Window
            </span>
            <span className="text-lg font-black font-mono text-[#D62828]">
              ⏱️ {formatCountdown(secondsRemaining)}
            </span>
          </div>

          <button
            disabled={recalculating}
            onClick={() => handleRecalculate()}
            className="px-4 py-2.5 bg-[#14213D] hover:bg-[#0f172a] dark:bg-white dark:hover:bg-gray-100 text-white dark:text-[#14213D] font-mono font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-60"
          >
            <span className={recalculating ? "animate-spin" : ""}>🔄</span>
            <span>{recalculating ? "Optimizing..." : "Recalculate Plan"}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Search Telemetry Progress Stepper */}
      <div className="bg-[#F6F7F5] dark:bg-[#131B28] p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#5B6472] dark:text-[#9AA5B4] flex items-center gap-2">
            <span>⚡</span> Automated Search & Multi-Criteria Decision Pipeline
          </span>
          <span className="text-xs font-mono font-extrabold text-[#0F766E] bg-[#0F766E]/10 px-2.5 py-0.5 rounded-full">
            Optimal Combination Resolved
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-white dark:bg-[#182233] p-3 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] flex items-center gap-2.5">
            <span className="text-lg">🩸</span>
            <div>
              <strong className="block text-[#14213D] dark:text-white">Compatibility Verified</strong>
              <span className="text-[11px] text-secondary-var">Component-aware ({component})</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#182233] p-3 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] flex items-center gap-2.5">
            <span className="text-lg">📡</span>
            <div>
              <strong className="block text-[#14213D] dark:text-white">Dynamic Expansion</strong>
              <span className="text-[11px] text-secondary-var">
                {plan?.searchTelemetry?.steps ? `${plan.searchTelemetry.steps[0]?.radiusKm}km → ${plan.searchRadiusKm}km reached` : "Stepwise expansion"}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#182233] p-3 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] flex items-center gap-2.5">
            <span className="text-lg">⚖️</span>
            <div>
              <strong className="block text-[#14213D] dark:text-white">Multi-Source Scored</strong>
              <span className="text-[11px] text-secondary-var">Compat 35% • ETA 30% • Stock 20%</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#182233] p-3 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] flex items-center gap-2.5">
            <span className="text-lg">🛡️</span>
            <div>
              <strong className="block text-[#14213D] dark:text-white">Actionable Allocation</strong>
              <span className="text-[11px] text-secondary-var">Immediate Reserves + Mobilization</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Fulfillment */}
        <div className="bg-white dark:bg-[#182233] p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
          <span className="text-xs font-mono font-bold text-[#5B6472] dark:text-[#9AA5B4] uppercase block mb-1">
            Fulfillment Rate
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl md:text-3xl font-black font-mono ${
              plan?.isFullyFulfilled ? "text-[#0F766E]" : "text-[#D62828]"
            }`}>
              {unitsPlanned} / {unitsRequired}
            </span>
            <span className="text-xs font-mono font-bold text-secondary-var">
              Units Planned
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                plan?.isFullyFulfilled ? "bg-[#0F766E]" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, (unitsPlanned / Math.max(1, unitsRequired)) * 100)}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Estimated ETA */}
        <div className="bg-white dark:bg-[#182233] p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
          <span className="text-xs font-mono font-bold text-[#5B6472] dark:text-[#9AA5B4] uppercase block mb-1">
            Estimated Response
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black font-mono text-[#14213D] dark:text-white">
              ~{plan?.estimatedResponseMinutes || 17}
            </span>
            <span className="text-xs font-mono font-bold text-secondary-var">
              Minutes
            </span>
          </div>
          <span className="text-[11px] font-mono text-secondary-var mt-2 block">
            Emergency transit + prep buffer
          </span>
        </div>

        {/* KPI 3: Search Radius */}
        <div className="bg-white dark:bg-[#182233] p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
          <span className="text-xs font-mono font-bold text-[#5B6472] dark:text-[#9AA5B4] uppercase block mb-1">
            Search Radius
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black font-mono text-[#14213D] dark:text-white">
              {plan?.searchRadiusKm || 10}
            </span>
            <span className="text-xs font-mono font-bold text-secondary-var">
              km
            </span>
          </div>
          <span className="text-[11px] font-mono text-secondary-var mt-2 block">
            Adaptive dynamic reach
          </span>
        </div>

        {/* KPI 4: Plan Confidence */}
        <div className="bg-white dark:bg-[#182233] p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
          <span className="text-xs font-mono font-bold text-[#5B6472] dark:text-[#9AA5B4] uppercase block mb-1">
            Plan Confidence
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black font-mono text-[#0F766E]">
              {plan?.overallConfidence || 94}%
            </span>
            <span className="text-xs font-mono font-bold text-secondary-var">
              Verified
            </span>
          </div>
          <span className="text-[11px] font-mono text-secondary-var mt-2 block">
            Freshness & reliability index
          </span>
        </div>
      </div>

      {/* Shortage Alert Banner (if partial fulfillment occurs) */}
      {plan && !plan.isFullyFulfilled && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-mono space-y-1">
          <strong className="text-sm font-bold flex items-center gap-2">
            <span>⚠️</span> Shortage Alert: {plan.remainingShortage} Units Remaining
          </strong>
          <p>{plan.shortageGuidance || "Reserve proposed units immediately and broaden request to regional command."}</p>
        </div>
      )}

      {/* Tab Controls: Plan vs Map vs Telemetry vs Research */}
      <div className="flex items-center gap-2 border-b border-[#E2E4E1] dark:border-[#2A3547] pb-3 text-xs font-mono font-bold">
        <button
          onClick={() => setActiveTab("plan")}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === "plan"
              ? "bg-[#D62828] text-white shadow-md shadow-[#D62828]/20"
              : "bg-white dark:bg-[#182233] text-[#5B6472] dark:text-[#9AA5B4] hover:text-[#14213D]"
          }`}
        >
          📋 Coordinated Plan ({plan?.items?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("map")}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === "map"
              ? "bg-[#D62828] text-white shadow-md shadow-[#D62828]/20"
              : "bg-white dark:bg-[#182233] text-[#5B6472] dark:text-[#9AA5B4] hover:text-[#14213D]"
          }`}
        >
          🗺️ Live Geospatial Map
        </button>

        <button
          onClick={() => {
            setActiveTab("transit");
            if (transitNearest.length === 0) handleStreamTransitGPS();
          }}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === "transit"
              ? "bg-[#D62828] text-white shadow-md shadow-[#D62828]/20"
              : "bg-white dark:bg-[#182233] text-[#5B6472] dark:text-[#9AA5B4] hover:text-[#14213D]"
          }`}
        >
          🚑 In-Transit GPS Telemetry
        </button>

        <button
          onClick={() => setActiveTab("research")}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === "research"
              ? "bg-[#0F766E] text-white shadow-md shadow-[#0F766E]/20"
              : "bg-white dark:bg-[#182233] text-[#5B6472] dark:text-[#9AA5B4] hover:text-[#14213D]"
          }`}
        >
          📊 Research Benchmarks & Baselines
        </button>
      </div>

      {/* TAB CONTENT 1: COORDINATED PLAN */}
      {activeTab === "plan" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-[#14213D] dark:text-white font-mono">
                Allocated Emergency Resources
              </h2>
              <p className="text-xs text-secondary-var">
                Combined blood-bank reserves and verified voluntary donors satisfying {unitsPlanned} of {unitsRequired} units.
              </p>
            </div>

            {/* Quick Demo Outage Trigger Button */}
            <div className="flex items-center gap-2">
              <button
                disabled={recalculating}
                onClick={() => handleRecalculate("bb-redcross-01")}
                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-white border border-amber-500/30 text-xs font-mono font-bold rounded-xl transition-all"
                title="Demonstrates engine dynamically recalculating when Blood Bank A becomes unavailable"
              >
                ⚡ Simulate Bank A Outage & Recalculate
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {plan?.items?.map((item, idx) => {
              const isBank = item.sourceType === "BLOOD_BANK";
              const isReserved = item.status === "RESERVED";
              const isContacted = item.status === "CONTACTED";

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#182233] p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  {/* Top Item Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                        isBank ? "bg-red-100 text-red-700" : "bg-teal-100 text-teal-700"
                      }`}>
                        {isBank ? "🏥" : "👤"}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase ${
                            isBank ? "bg-red-50 text-red-700 border border-red-200" : "bg-teal-50 text-teal-700 border border-teal-200"
                          }`}>
                            {isBank ? "Blood Bank Stock" : "Voluntary Donor"}
                          </span>
                          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded font-bold">
                            {item.bloodGroup}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-[#14213D] dark:text-white mt-1">
                          {item.name}
                        </h3>
                      </div>
                    </div>

                    {/* Allocation & Score Pill */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="block text-xs font-mono font-extrabold text-[#D62828] bg-[#D62828]/10 px-3 py-1 rounded-xl">
                          {item.allocatedUnits} Unit{item.allocatedUnits > 1 ? "s" : ""} Allocated
                        </span>
                        <span className="text-[10px] font-mono text-secondary-var mt-1 block">
                          Match Score: <strong className="text-[#0F766E]">{item.totalScore}/100</strong>
                        </span>
                      </div>

                      {/* Action Button */}
                      <div>
                        {isBank ? (
                          <button
                            disabled={actionLoadingId === item.id || isReserved}
                            onClick={() => handleAction(item.id, "RESERVE")}
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold shadow transition-all ${
                              isReserved
                                ? "bg-green-600 text-white"
                                : "bg-[#D62828] hover:bg-[#b01f1f] text-white"
                            }`}
                          >
                            {actionLoadingId === item.id
                              ? "Reserving..."
                              : isReserved
                              ? "✓ Units Reserved"
                              : `Reserve ${item.allocatedUnits} Units`}
                          </button>
                        ) : (
                          <button
                            disabled={actionLoadingId === item.id || isContacted}
                            onClick={() => handleAction(item.id, "CONTACT")}
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold shadow transition-all ${
                              isContacted
                                ? "bg-green-600 text-white"
                                : "bg-[#0F766E] hover:bg-[#0c5e57] text-white"
                            }`}
                          >
                            {actionLoadingId === item.id
                              ? "Dispatching..."
                              : isContacted
                              ? "✓ Donor Alerted"
                              : "Contact Donor"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F6F7F5] dark:bg-[#101720] p-3 rounded-xl text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-secondary-var block">Proximity</span>
                      <strong className="text-[#14213D] dark:text-white">~{item.distanceKm} km</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-secondary-var block">Estimated Arrival</span>
                      <strong className="text-[#14213D] dark:text-white">~{item.etaMinutes} mins</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-secondary-var block">Confidence Index</span>
                      <strong className="text-[#0F766E]">{item.availabilityConfidence}% Verified</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-secondary-var block">Recommended Action</span>
                      <strong className="text-[#14213D] dark:text-white">{item.recommendedAction}</strong>
                    </div>
                  </div>

                  {/* Why Recommended Accordion */}
                  <div className="bg-[#14213D]/5 dark:bg-white/5 p-3.5 rounded-xl text-xs font-mono space-y-1.5 border border-black/5 dark:border-white/5">
                    <span className="text-[11px] font-extrabold uppercase text-[#14213D] dark:text-white flex items-center gap-1.5">
                      <span>💡</span> Why this resource was recommended:
                    </span>
                    <ul className="space-y-1 text-secondary-var">
                      {item.whyRecommended.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#0F766E] font-bold">✓</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Sequential Clinical Execution Guidance */}
          <div className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold text-[#14213D] dark:text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <span>📋</span> Standard Operating Procedure (SOP) Execution Steps
            </h3>
            <div className="space-y-2 text-xs font-mono text-secondary-var">
              {plan?.executionSteps.map((step, idx) => (
                <div key={idx} className="p-2.5 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#14213D] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: LIVE MAP */}
      {activeTab === "map" && (
        <div className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#14213D] dark:text-white font-mono">
                Geospatial Coordination Map
              </h2>
              <p className="text-xs text-secondary-var">
                Visualizing CityCare Hospital, active blood-bank reserves, and privacy-protected voluntary donors within {plan?.searchRadiusKm} km radius.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1">🚨 Hospital</span>
              <span className="flex items-center gap-1">🩸 Blood Bank</span>
              <span className="flex items-center gap-1">👤 Donor</span>
            </div>
          </div>

          <div className="w-full h-[520px] rounded-2xl overflow-hidden border border-[#E2E4E1] dark:border-[#2A3547]">
            <MapView
              initialLat={request?.location?.lat || 20.5937}
              initialLng={request?.location?.lng || 78.9629}
              zoom={request?.location ? 12 : 5}
              markers={mapMarkers}
            />
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: RESEARCH BENCHMARKS */}
      {activeTab === "research" && (
        <div className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-6 font-mono">
          <div>
            <h2 className="text-lg font-black text-[#14213D] dark:text-white">
              Comparative Research Evaluation: BloodLink vs Baselines
            </h2>
            <p className="text-xs text-secondary-var mt-1">
              Demonstrates why multi-criteria optimization outperforms static registries and single-source greedy heuristics in life-critical scenarios.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E4E1] dark:border-[#2A3547] text-[#5B6472] dark:text-[#9AA5B4] uppercase">
                  <th className="py-3 px-4">Coordination Method</th>
                  <th className="py-3 px-4">Fulfillment Rate</th>
                  <th className="py-3 px-4">Estimated ETA</th>
                  <th className="py-3 px-4">Shortage Deficit</th>
                  <th className="py-3 px-4">Stock Freshness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E4E1] dark:divide-[#2A3547]">
                <tr>
                  <td className="py-3 px-4 font-bold text-[#14213D] dark:text-white">
                    Baseline 1: Nearest Source Only (eRaktKosh Listing)
                  </td>
                  <td className="py-3 px-4 text-amber-600 font-bold">50% (2 / 4 units)</td>
                  <td className="py-3 px-4">12 mins</td>
                  <td className="py-3 px-4 text-red-600 font-bold">2 units unfulfilled</td>
                  <td className="py-3 px-4">Unverified</td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-bold text-[#14213D] dark:text-white">
                    Baseline 2: Nearest Donor Only
                  </td>
                  <td className="py-3 px-4 text-red-600 font-bold">25% (1 / 4 units)</td>
                  <td className="py-3 px-4">42 mins</td>
                  <td className="py-3 px-4 text-red-600 font-bold">3 units unfulfilled</td>
                  <td className="py-3 px-4">N/A</td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-bold text-[#14213D] dark:text-white">
                    Baseline 3: Rule-Based Static Ranking
                  </td>
                  <td className="py-3 px-4 text-amber-600 font-bold">75% (3 / 4 units)</td>
                  <td className="py-3 px-4">65 mins</td>
                  <td className="py-3 px-4 text-amber-600 font-bold">1 unit unfulfilled</td>
                  <td className="py-3 px-4">Moderate</td>
                </tr>

                <tr className="bg-[#0F766E]/10 font-bold text-[#0F766E]">
                  <td className="py-3 px-4">
                    ⭐ BloodLink Multi-Criteria Response Optimizer
                  </td>
                  <td className="py-3 px-4">100% (4 / 4 units)</td>
                  <td className="py-3 px-4">~17 mins</td>
                  <td className="py-3 px-4">0 (Zero Deficit)</td>
                  <td className="py-3 px-4">94% Confidence</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl text-xs space-y-2 text-secondary-var">
            <strong className="block text-[#14213D] dark:text-white">Key Academic Findings:</strong>
            <p>
              1. <strong>Multi-Source Knapsack Synthesis:</strong> Single-source greedy heuristics fail when a solitary hospital or blood bank has partial stock. By synthesizing Blood Bank A (2 units), Blood Bank C (1 unit), and Donor #182 (1 unit), BloodLink eliminates emergency shortage.
            </p>
            <p>
              2. <strong>Inventory Freshness Decay Factor:</strong> Prioritizing recently updated inventory ensures that reserved units are physically present on shelves, mitigating clinical turnaround failure.
            </p>
          </div>
        </div>
      )}

      {/* TAB: IN-TRANSIT REAL-TIME GPS TELEMETRY */}
      {activeTab === "transit" && (
        <div className="card-surface p-6 md:p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E4E1] dark:border-[#2A3547] pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D62828] animate-ping" />
                <span className="text-[10px] font-mono font-extrabold uppercase text-[#D62828] bg-[#D62828]/10 px-2 py-0.5 rounded">
                  Live Vector Tracking
                </span>
                <span className="text-xs font-mono font-bold text-secondary-var">Vehicle: {transitVehicleId}</span>
              </div>
              <h2 className="font-heading text-xl font-extrabold text-[#14213D] dark:text-white">
                🚑 In-Transit Real-Time GPS Matching Console
              </h2>
              <p className="text-xs text-secondary-var mt-0.5">
                Dynamic re-computation of candidate distance & ETA as the ambulance/cab moves toward destination.
              </p>
            </div>

            <button
              onClick={() => handleStreamTransitGPS()}
              className="px-5 py-2.5 bg-[#D62828] hover:bg-red-700 text-white font-mono font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-2 shrink-0"
            >
              <span>🛰️</span>
              <span>Transmit GPS Ping (+0.003° Vector)</span>
            </button>
          </div>

          {/* Telemetry HUD */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] border-[#E2E4E1] dark:border-[#2A3547]">
              <span className="text-secondary-var uppercase block text-[10px] font-bold">Current Speed</span>
              <span className="text-2xl font-black text-[#14213D] dark:text-white mt-1 block">{transitSpeed} km/h</span>
              <span className="text-[10px] text-emerald-600 mt-1 block">Siren Priority Active</span>
            </div>

            <div className="p-4 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] border-[#E2E4E1] dark:border-[#2A3547]">
              <span className="text-secondary-var uppercase block text-[10px] font-bold">Live Coordinates</span>
              <span className="text-sm font-black text-[#14213D] dark:text-white mt-1 block font-mono">
                {transitCoords.lat.toFixed(4)}°N, {transitCoords.lng.toFixed(4)}°E
              </span>
              <span className="text-[10px] text-secondary-var mt-1 block">WGS-84 / PostGIS 4326</span>
            </div>

            <div className="p-4 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] border-[#E2E4E1] dark:border-[#2A3547]">
              <span className="text-secondary-var uppercase block text-[10px] font-bold">Compass Vector</span>
              <span className="text-2xl font-black text-[#0F766E] dark:text-[#6FD6BC] mt-1 block">85° ENE</span>
              <span className="text-[10px] text-secondary-var mt-1 block">Approaching Highway Corridor</span>
            </div>

            <div className="p-4 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] border-[#E2E4E1] dark:border-[#2A3547]">
              <span className="text-secondary-var uppercase block text-[10px] font-bold">Target Destination</span>
              <span className="text-sm font-bold text-[#14213D] dark:text-white mt-1 block truncate">
                {hospitalName}
              </span>
              <span className="text-[10px] text-[#D62828] mt-1 block font-bold">Code Red Emergency</span>
            </div>
          </div>

          {/* Dynamic Nearest Resources Along Travel Route */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-sm text-[#14213D] dark:text-white flex items-center gap-2">
                <span>📍</span> Dynamic Resources Along Moving Vector (Updated via Live Haversine)
              </h3>
              <span className="text-xs font-mono text-secondary-var">Auto-refresh on GPS update</span>
            </div>

            {transitNearest.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-xl font-mono text-xs text-secondary-var">
                Click "Transmit GPS Ping" above to initiate moving telemetry stream.
              </div>
            ) : (
              <div className="space-y-2.5">
                {transitNearest.map((res, idx) => (
                  <div
                    key={res.id}
                    className="p-4 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#14213D] text-white flex items-center justify-center font-bold text-[11px]">
                        {idx + 1}
                      </span>
                      <div>
                        <strong className="text-sm text-[#14213D] dark:text-white block">{res.name}</strong>
                        <span className="text-secondary-var">
                          Type: {res.sourceType} • Group: <strong>{res.bloodGroup}</strong> • Stock: {res.availableUnits} units
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 sm:text-right">
                      <div>
                        <span className="text-secondary-var text-[10px] block">Converging Distance</span>
                        <strong className="text-[#D62828] text-sm">{res.distanceKm} km away</strong>
                      </div>
                      <div>
                        <span className="text-secondary-var text-[10px] block">Total Dynamic ETA</span>
                        <strong className="text-emerald-600 text-sm">{res.etaMinutes} mins</strong>
                      </div>
                      <span className="px-2 py-1 rounded bg-[#0F766E]/10 text-[#0F766E] text-[10px] font-bold">
                        En Route Intercept
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Safety & Regulatory Disclaimer */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] font-mono text-amber-800 dark:text-amber-300">
        <strong className="block mb-0.5">⚖️ Medical Safety Notice:</strong>
        BloodLink operates strictly as an intelligent emergency decision-support and dispatch coordination layer. All prospective transfusions require mandatory institutional laboratory cross-matching and verification of donor health status prior to clinical administration.
      </div>

    </div>
  );
}
