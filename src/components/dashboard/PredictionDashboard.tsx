"use client";

import { MonoData } from "@/app/components/ui/Badge";

interface PredictionDashboardProps {
  predictions: {
    blood_group: string;
    predicted_demand: number;
    shortage_risk: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | string;
  }[];
}

export default function PredictionDashboard({ predictions = [] }: PredictionDashboardProps) {
  return (
    <div className="card-surface p-6 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-4">
      <h2 className="font-heading text-lg font-bold text-primary-var">
        AI Shortage Radar (ML Service)
      </h2>
      <div className="space-y-2">
        {predictions.length === 0 ? (
          <p className="text-xs font-mono text-secondary-var">No shortage predictions available.</p>
        ) : (
          predictions.slice(0, 5).map((p) => (
            <div
              key={p.blood_group}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720]"
            >
              <div>
                <span className="font-heading text-sm font-bold text-primary-var">
                  {p.blood_group}
                </span>
                <span className="text-[10px] font-mono text-secondary-var block">
                  Demand: {p.predicted_demand} units / day
                </span>
              </div>
              <MonoData
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  p.shortage_risk === "CRITICAL"
                    ? "bg-[#D62828] text-white"
                    : "bg-[#0F766E] text-white"
                }`}
              >
                {p.shortage_risk} RISK
              </MonoData>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
