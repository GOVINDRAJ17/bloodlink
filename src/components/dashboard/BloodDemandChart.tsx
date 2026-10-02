"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface BloodDemandChartProps {
  data?: { bloodGroup: string; demand: number }[];
}

const defaultData = [
  { bloodGroup: "O-", demand: 18 },
  { bloodGroup: "O+", demand: 32 },
  { bloodGroup: "A+", demand: 24 },
  { bloodGroup: "A-", demand: 12 },
  { bloodGroup: "B+", demand: 28 },
  { bloodGroup: "B-", demand: 10 },
  { bloodGroup: "AB+", demand: 14 },
  { bloodGroup: "AB-", demand: 6 },
];

export default function BloodDemandChart({ data = defaultData }: BloodDemandChartProps) {
  return (
    <div className="w-full h-64 p-4 rounded-xl bg-white dark:bg-[#182233] border border-[#E2E4E1] dark:border-[#2A3547]">
      <h3 className="font-heading text-sm font-bold text-primary-var mb-2">
        Blood Group Demand Velocity
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
          <XAxis dataKey="bloodGroup" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#182233",
              borderColor: "#2A3547",
              color: "#fff",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="demand" fill="#E11D48" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
