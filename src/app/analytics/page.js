"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { MonoData } from "@/app/components/ui/Badge";

export default function PredictiveAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await axios.get("/api/analytics/predict");
      if (res.status === 200 && res.data.success) {
        setData(res.data);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      await fetchPredictions();
    } finally {
      setRecalculating(false);
    }
  };

  const { summary = {}, predictions = [], recentRequests = [] } = data || {};

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6 bg-[#F6F7F5] dark:bg-[#101720] min-h-[calc(100vh-64px)] text-[#14213D] dark:text-[#F6F7F5] transition-colors duration-200">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
        <div>
          <span className="text-[10px] font-mono font-extrabold text-[#C97A2B] bg-[#C97A2B]/10 px-2.5 py-1 rounded-full uppercase border border-[#C97A2B]/20">
            Real Database Analytics
          </span>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] mt-2">
            BloodLink Operations & Forecast Radar
          </h1>
          <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4] mt-1">
            Real-time analytics, inventory burn-rate modeling, and risk forecasting calculated directly from live database tables.
          </p>
        </div>

        <button
          disabled={recalculating || loading}
          onClick={handleRecalculate}
          className="px-4 py-2.5 bg-[#14213D] hover:bg-black dark:bg-[#0F766E] dark:hover:bg-[#0d645e] text-white text-xs font-mono font-bold rounded-xl shadow transition-colors text-center shrink-0 disabled:opacity-50"
        >
          {recalculating ? "Refreshing Data..." : "⚡ Refresh Real Metrics"}
        </button>
      </div>

      {/* Skeleton Loader during fetch */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-white dark:bg-[#182233] rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] p-4 animate-pulse space-y-2">
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-6 w-10 bg-gray-300 dark:bg-gray-600 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 bg-white dark:bg-[#182233] rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] p-6 animate-pulse space-y-3">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 w-full bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-8 border/30 rounded-2xl text-center space-y-3">
          <p className="text-sm font-bold text-red-600 dark:text-red-400">Failed to load real analytics metrics from the database.</p>
          <button onClick={fetchPredictions} className="px-4 py-2 bg-red-600 text-white text-xs font-mono font-bold rounded-xl shadow">
            Retry Loading
          </button>
        </div>
      )}

      {/* Real Data Metrics Strip */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Total Requests" value={summary.totalRequests ?? 0} accent="text-[#14213D] dark:text-[#F6F7F5]" />
            <MetricCard label="Fulfilled" value={summary.fulfilledRequests ?? 0} accent="text-[#0F766E] dark:text-[#6FD6BC]" />
            <MetricCard label="Pending" value={summary.pendingRequests ?? 0} accent="text-[#C97A2B] dark:text-[#F5C77A]" />
            <MetricCard label="Emergency Requests" value={summary.emergencyRequests ?? 0} accent="text-[#D62828] dark:text-[#F5A3A3]" />
            <MetricCard label="Available Blood Units" value={summary.totalAvailableUnits ?? 0} accent="text-[#0F766E] dark:text-[#6FD6BC]" />
            <MetricCard label="Active Hospitals" value={summary.activeHospitals ?? 0} accent="text-[#14213D] dark:text-[#F6F7F5]" />
          </div>

          {/* Summary Warning */}
          {summary.criticalRiskCount > 0 && (
            <div className="p-4 bg-[#D62828]/10 border border-[#D62828]/30 rounded-2xl text-[#D62828] dark:text-[#F5A3A3] text-xs flex gap-3 items-center">
              <span className="text-2xl">🚨</span>
              <div>
                <strong className="font-heading text-sm font-extrabold uppercase">Critical Shortage Warning</strong>
                <p className="mt-0.5 font-sans">
                  {summary.criticalRiskCount} blood group(s) have critical shortages (0 units or ≤1 day remaining supply).
                </p>
              </div>
            </div>
          )}

          {/* Risk Forecast Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {predictions.map((p) => {
              const isCritical = p.riskLevel === "CRITICAL";
              const isHigh = p.riskLevel === "HIGH";

              return (
                <div
                  key={p.bloodGroup}
                  className={`p-6 rounded-2xl border transition-all ${
                    isCritical
                      ? "bg-[#D62828]/5 border-[#D62828]/30 shadow-sm"
                      : isHigh
                      ? "bg-[#C97A2B]/5 border-[#C97A2B]/30"
                      : "bg-white dark:bg-[#182233] border-[#E2E4E1] dark:border-[#2A3547] shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-2xl font-black text-[#14213D] dark:text-[#F6F7F5]">{p.bloodGroup}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase ${
                        isCritical
                          ? "bg-[#D62828] text-white"
                          : isHigh
                          ? "bg-[#C97A2B] text-white"
                          : p.riskLevel === "MODERATE"
                          ? "bg-[#14213D] text-white"
                          : "bg-[#0F766E] text-white"
                      }`}>
                        {p.riskLevel} RISK
                      </span>
                    </div>

                    {/* Score Gauge */}
                    <div className="text-right">
                      <span className="text-[10px] font-mono font-bold text-[#5B6472] dark:text-[#9AA5B4] uppercase block">Risk Score</span>
                      <MonoData className="text-2xl font-black text-[#14213D] dark:text-[#F6F7F5]">{p.riskScore}/100</MonoData>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isCritical ? "bg-[#D62828]" : isHigh ? "bg-[#C97A2B]" : "bg-[#0F766E]"
                      }`}
                      style={{ width: `${p.riskScore}%` }}
                    />
                  </div>

                  {/* Specs Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-[#F6F7F5] dark:bg-[#101720] p-3 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] mb-3">
                    <div>
                      <span className="text-[10px] font-mono text-[#5B6472] dark:text-[#9AA5B4] uppercase font-bold block">Current Stock</span>
                      <MonoData className="text-sm font-bold text-[#14213D] dark:text-[#F6F7F5]">{p.currentStockUnits} units</MonoData>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-[#5B6472] dark:text-[#9AA5B4] uppercase font-bold block">Burn Rate / Day</span>
                      <MonoData className="text-sm font-bold text-[#14213D] dark:text-[#F6F7F5]">{p.projectedBurnRatePerDay} u/day</MonoData>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-[#5B6472] dark:text-[#9AA5B4] uppercase font-bold block">Days Left</span>
                      <MonoData className={`text-sm font-bold ${daysColor(p.projectedDaysRemaining)}`}>
                        {p.projectedDaysRemaining} days
                      </MonoData>
                    </div>
                  </div>

                  {/* Actionable Insight */}
                  <div className="p-3 bg-white dark:bg-[#182233] rounded-xl text-xs text-[#5B6472] dark:text-[#9AA5B4] border border-[#E2E4E1] dark:border-[#2A3547]">
                    <strong className="block text-[#14213D] dark:text-[#F6F7F5] mb-0.5">Actionable Insight:</strong>
                    {p.recommendation}
                  </div>

                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div className="bg-white dark:bg-[#182233] p-4 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-1">
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5B6472] dark:text-[#9AA5B4] block">
        {label}
      </span>
      <MonoData className={`text-2xl font-black ${accent}`}>
        {value}
      </MonoData>
    </div>
  );
}

function daysColor(days) {
  if (days <= 2) return "text-[#D62828]";
  if (days <= 4) return "text-[#C97A2B]";
  return "text-[#0F766E] dark:text-[#6FD6BC]";
}
