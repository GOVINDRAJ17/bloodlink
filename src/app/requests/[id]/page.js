"use client";

import { use } from "react";
import EmergencyResponseDashboard from "@/components/emergency/EmergencyResponseDashboard";

export default function RequestDetailsPage({ params }) {
  const unwrappedParams = use(params);
  const requestId = unwrappedParams.id;

  return (
    <div className="min-h-screen bg-[#F6F7F5] dark:bg-[#101720] text-[#14213D] dark:text-[#F6F7F5] transition-colors duration-200 py-4 md:py-8">
      <EmergencyResponseDashboard requestId={requestId} />
    </div>
  );
}
