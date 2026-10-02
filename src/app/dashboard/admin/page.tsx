"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getPreciseLiveLocation } from "@/lib/geo/location";

const PredictionDashboard = dynamic(
  () => import("@/components/dashboard/PredictionDashboard"),
  {
    loading: () => <SkeletonLoader rows={3} />,
  }
);

const AdminAnalytics = dynamic(
  () => import("@/components/dashboard/AdminAnalytics"),
  {
    loading: () => <SkeletonLoader rows={4} />,
  }
);

export default function AdminDashboardPage() {
  const supabase = createClient();

  const [stats, setStats] = useState({
    totalDonors: 0,
    totalHospitals: 0,
    totalBloodBanks: 0,
    activeRequests: 0,
    fulfillmentRate: 92
  });

  const [predictions, setPredictions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Broadcast Center State
  const [incidentType, setIncidentType] = useState("DISASTER_CALAMITY");
  const [broadcastRadius, setBroadcastRadius] = useState(50);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [broadcastTitle, setBroadcastTitle] = useState("CODE RED: Severe Trauma Surge — Urgent Voluntary Donors Needed");
  const [broadcastLocationName, setBroadcastLocationName] = useState("");
  const [broadcastLat, setBroadcastLat] = useState<number | "">("");
  const [broadcastLng, setBroadcastLng] = useState<number | "">("");
  const [detectingAdminLoc, setDetectingAdminLoc] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("Immediate voluntary donor mobilization active. Please report to the nearest blood bank or confirm in BloodLink app.");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<any>(null);

  const handleDetectAdminLocation = async () => {
    try {
      setDetectingAdminLoc(true);
      const loc = await getPreciseLiveLocation();
      setBroadcastLat(loc.lat);
      setBroadcastLng(loc.lng);
      if (!broadcastLocationName) {
        setBroadcastLocationName(loc.address || "Local Disaster Command Zone");
      }
    } catch {
      alert("Could not automatically retrieve GPS. Please input latitude and longitude manually.");
    } finally {
      setDetectingAdminLoc(false);
    }
  };

  const handleDispatchBroadcast = async () => {
    try {
      if (broadcastLat === "" || broadcastLng === "" || isNaN(Number(broadcastLat)) || isNaN(Number(broadcastLng))) {
        alert("Please provide valid latitude and longitude for the disaster epicenter, or click 'Detect GPS'.");
        return;
      }

      if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
        alert("Please provide both an Alert Title and Broadcast Message.");
        return;
      }

      setIsBroadcasting(true);
      setBroadcastResult(null);

      const res = await fetch("/api/emergency/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentType,
          title: broadcastTitle.trim(),
          message: broadcastMessage.trim(),
          radiusKm: broadcastRadius,
          targetBloodGroups: selectedGroups,
          epicenter: {
            lat: Number(broadcastLat),
            lng: Number(broadcastLng),
            name: broadcastLocationName.trim() || "Emergency Epicenter",
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBroadcastResult(data);
      } else {
        alert(`Broadcast error: ${data.error || "Failed to dispatch"}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const fetchAdminStats = async () => {
    try {
      setLoading(true);

      const [donorsRes, hospsRes, banksRes, reqsRes, auditRes, predRes] = await Promise.all([
        supabase.from("donor_profiles").select("id", { count: "exact" }),
        supabase.from("hospital_profiles").select("id", { count: "exact" }),
        supabase.from("blood_bank_profiles").select("id", { count: "exact" }),
        supabase.from("blood_requests").select("id, status"),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(10),
        fetch("/api/analytics/predict").then(r => r.ok ? r.json() : null)
      ]);

      const reqList = reqsRes.data || [];
      const totalReqs = reqList.length;
      const fulfilledReqs = reqList.filter(r => r.status === "FULFILLED").length;
      const rate = totalReqs > 0 ? Math.round((fulfilledReqs / totalReqs) * 100) : 0;

      setStats({
        totalDonors: donorsRes.count ?? 0,
        totalHospitals: hospsRes.count ?? 0,
        totalBloodBanks: banksRes.count ?? 0,
        activeRequests: reqList.filter(r => r.status !== "FULFILLED").length,
        fulfillmentRate: rate
      });

      if (auditRes.data) setAuditLogs(auditRes.data);
      if (predRes?.predictions) setPredictions(predRes.predictions);

    } catch (err) {
      console.error("Error loading admin dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminStats();
  }, []);

  if (loading) {
    return <div className="max-w-6xl mx-auto p-10 text-center font-mono text-xs text-secondary-var">Loading Platform Oversight...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-surface p-6 rounded-xl border shadow-sm">
        <div>
          <span className="text-[10px] font-mono font-black text-white bg-[#14213D] px-2.5 py-0.5 rounded uppercase">
            Platform Security & Governance
          </span>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-primary-var mt-1">
            System Executive Dashboard
          </h1>
          <p className="text-xs text-secondary-var mt-1">
            Platform analytics, PostGIS geo oversight, audit trails, and ML shortage predictions.
          </p>
        </div>

        <button onClick={fetchAdminStats} className="px-4 py-2.5 bg-[#14213D] text-white text-xs font-mono font-bold rounded-lg shadow">
          🔄 Refresh Metrics
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-surface p-5 rounded-xl border shadow-sm">
          <p className="text-xs font-bold text-secondary-var uppercase">Registered Donors</p>
          <p className="font-mono text-3xl font-extrabold text-[#0F766E] dark:text-[#6FD6BC] mt-1">{stats.totalDonors}</p>
        </div>

        <div className="card-surface p-5 rounded-xl border shadow-sm">
          <p className="text-xs font-bold text-secondary-var uppercase">Verified Hospitals</p>
          <p className="font-mono text-3xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] mt-1">{stats.totalHospitals}</p>
        </div>

        <div className="card-surface p-5 rounded-xl border shadow-sm">
          <p className="text-xs font-bold text-secondary-var uppercase">Active Emergencies</p>
          <p className="font-mono text-3xl font-extrabold text-[#D62828] mt-1">{stats.activeRequests}</p>
        </div>

        <div className="card-surface p-5 rounded-xl border shadow-sm">
          <p className="text-xs font-bold text-secondary-var uppercase">Fulfillment Rate</p>
          <p className="font-mono text-3xl font-extrabold text-[#C97A2B] mt-1">{stats.fulfillmentRate}%</p>
        </div>
      </div>

      {/* 🚨 EMERGENCY BROADCAST & CALAMITY MOBILIZATION CENTER */}
      <div className="card-surface p-6 rounded-2xl border shadow-sm bg-white dark:bg-[#182233] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E4E1] dark:border-[#2A3547] pb-4">
          <div>
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-[#D62828] bg-[#D62828]/10 px-2.5 py-1 rounded-full">
              Civil Defense & Disaster Operations
            </span>
            <h2 className="font-heading text-xl font-extrabold text-[#14213D] dark:text-white mt-1">
              🚨 Emergency Broadcast & Natural Calamity Mobilizer
            </h2>
            <p className="text-xs text-secondary-var mt-0.5">
              Instantly push mass SMS, email, and app notifications to all nearby donors within an expanding 3–90 km perimeter.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-bold text-emerald-600">Broadcast Gateway Ready</span>
          </div>
        </div>

        {broadcastResult && (
          <div className="p-4 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-mono space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span>✅</span>
              <span>{broadcastResult.message}</span>
            </div>
            <p className="text-[11px] opacity-80">
              Broadcast Ref: <strong>{broadcastResult.broadcast?.id}</strong> • Target Radius: <strong>{broadcastResult.broadcast?.radiusKm} km</strong> • Mobilized: <strong>{broadcastResult.broadcast?.recipientCount} donors</strong>
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Incident Type Preset */}
          <div className="space-y-1">
            <label className="text-xs font-mono font-bold uppercase text-secondary-var">Incident Scenario</label>
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold text-[#14213D] dark:text-white focus:outline-none"
            >
              <option value="DISASTER_CALAMITY">🌊 Flood / Earthquake / Calamity</option>
              <option value="MASS_CASUALTY">💥 Mass-Casualty / Trauma Surge</option>
              <option value="CRITICAL_SHORTAGE">🩸 Acute Regional Inventory Shortage</option>
            </select>
          </div>

          {/* Radius Slider (3-90 km) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono font-bold uppercase text-secondary-var">Mobilization Radius</label>
              <span className="font-mono text-xs font-black text-[#D62828]">{broadcastRadius} km</span>
            </div>
            <input
              type="range"
              min="3"
              max="90"
              step="1"
              value={broadcastRadius}
              onChange={(e) => setBroadcastRadius(Number(e.target.value))}
              className="w-full accent-[#D62828] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-secondary-var">
              <span>3 km (Immediate)</span>
              <span>45 km</span>
              <span>90 km (Max Reach)</span>
            </div>
          </div>

          {/* Target Blood Groups */}
          <div className="space-y-1">
            <label className="text-xs font-mono font-bold uppercase text-secondary-var">Target Blood Groups</label>
            <div className="flex flex-wrap gap-1.5">
              {["ALL", "O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"].map((bg) => {
                const isSelected = bg === "ALL" ? selectedGroups.length === 0 : selectedGroups.includes(bg);
                return (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => {
                      if (bg === "ALL") setSelectedGroups([]);
                      else {
                        setSelectedGroups((prev) =>
                          prev.includes(bg) ? prev.filter((g) => g !== bg) : [...prev, bg]
                        );
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                      isSelected
                        ? "bg-[#D62828] text-white border-[#D62828]"
                        : "bg-[#F6F7F5] dark:bg-[#101720] text-secondary-var border-gray-300 dark:border-gray-700"
                    }`}
                  >
                    {bg}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Message Input & Action */}
        <div className="space-y-2 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="Alert Title (e.g. 'CODE RED: Emergency O- Donors Needed')"
              className="p-3 bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white rounded-xl text-xs font-mono font-bold"
            />
            <input
              type="text"
              value={broadcastLocationName}
              onChange={(e) => setBroadcastLocationName(e.target.value)}
              placeholder="Epicenter Name (e.g. 'City General Trauma Wing')"
              className="p-3 bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white rounded-xl text-xs font-mono font-bold"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                required
                placeholder="Lat"
                value={broadcastLat}
                onChange={(e) => setBroadcastLat(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-1/2 p-3 bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white rounded-xl text-xs font-mono font-bold"
              />
              <input
                type="number"
                step="any"
                required
                placeholder="Lng"
                value={broadcastLng}
                onChange={(e) => setBroadcastLng(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-1/2 p-3 bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white rounded-xl text-xs font-mono font-bold"
              />
              <button
                type="button"
                onClick={handleDetectAdminLocation}
                disabled={detectingAdminLoc}
                className="px-3 bg-[#14213D] hover:bg-black text-white rounded-xl text-[10px] font-mono font-bold whitespace-nowrap shrink-0"
              >
                {detectingAdminLoc ? "..." : "📍 GPS"}
              </button>
            </div>
          </div>

          <textarea
            rows={2}
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder="Official broadcast message detailing incident, rendezvous hospital, and contact instructions..."
            className="w-full p-3 bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white rounded-xl text-xs font-mono"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-mono text-secondary-var">
              ⚠️ Authorized Administrative Function • Dispatches multi-channel alerts to all matching active donors.
            </span>
            <button
              type="button"
              disabled={isBroadcasting}
              onClick={handleDispatchBroadcast}
              className="px-6 py-3 bg-[#D62828] hover:bg-red-700 text-white font-mono font-extrabold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <span>{isBroadcasting ? "📡 Dispatching Broadcast..." : "🚨 Transmit Disaster Mobilization Alert"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Predictions & Audit Log Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PredictionDashboard predictions={predictions} />
        <AdminAnalytics auditLogs={auditLogs} />
      </div>

    </div>
  );
}
