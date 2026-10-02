"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface InventoryTrendChartProps {
  data?: { time: string; units: number }[];
}

const defaultTrendData = [
  { time: "00:00", units: 142 },
  { time: "04:00", units: 138 },
  { time: "08:00", units: 120 },
  { time: "12:00", units: 110 },
  { time: "16:00", units: 95 },
  { time: "20:00", units: 130 },
  { time: "24:00", units: 140 },
];

export default function InventoryTrendChart({ data = defaultTrendData }: InventoryTrendChartProps) {
  return (
    <div className="w-full h-48 p-4 rounded-xl bg-white dark:bg-[#182233] border border-[#E2E4E1] dark:border-[#2A3547]">
      <h3 className="font-heading text-sm font-bold text-primary-var mb-2">
        Inventory Reserve Trajectory (24h)
      </h3>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#182233",
              borderColor: "#2A3547",
              color: "#fff",
              borderRadius: "8px",
              fontSize: "11px",
            }}
          />
          <Area
            type="monotone"
            dataKey="units"
            stroke="#0F766E"
            fill="#0F766E"
            fillOpacity={0.2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
