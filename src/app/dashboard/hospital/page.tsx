"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { UrgencyBadge, StatusBadge, VerifiedBadge, MonoData } from "@/app/components/ui/Badge";
import { useRealtimeRequests } from "@/hooks/useRealtimeRequests";
import HospitalInventorySearch from "@/components/inventory/HospitalInventorySearch";

export default function HospitalDashboardPage() {
  const supabase = createClient();

  const [hospitalProfile, setHospitalProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Quick Emergency Creation Modal State
  const [showModal, setShowModal] = useState(false);
  const [bloodGroup, setBloodGroup] = useState("O-");
  const [unitsRequired, setUnitsRequired] = useState(2);
  const [urgency, setUrgency] = useState<"NORMAL" | "URGENT" | "CRITICAL">("CRITICAL");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const { requests, loading: loadingRequests } = useRealtimeRequests(hospitalProfile?.id);

  useEffect(() => {
    async function loadHospital() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: hosp } = await supabase
          .from("hospital_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (hosp) setHospitalProfile(hosp);
      } catch (err) {
        console.error("Error loading hospital profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadHospital();
  }, []);

  const handleQuickCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError("");

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blood_group: bloodGroup,
          units_required: Number(unitsRequired),
          urgency,
          lat: 20.5937,
          lng: 78.9629,
          additional_message: "Emergency ICU Requirement"
        })
      });

      const resData = await res.json();
      if (res.ok) {
        setShowModal(false);
      } else {
        setModalError(resData.error || "Failed to create request");
      }
    } catch (err: any) {
      setModalError(err.message || "Error dispatching emergency request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return <div className="max-w-6xl mx-auto p-10 text-center font-mono text-xs text-secondary-var">Loading Hospital Command...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6 bg-[#F6F7F5] dark:bg-[#101720] min-h-[calc(100vh-64px)] text-[#14213D] dark:text-[#F6F7F5] transition-colors duration-200">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <VerifiedBadge type="HOSPITAL" />
            <MonoData className="text-secondary-var">Facility: {hospitalProfile?.hospital_name || "City General Hospital"}</MonoData>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-[#14213D] dark:text-[#F6F7F5]">
            Hospital Triage & Dispatch Command
          </h1>
          <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4] mt-1">
            Real-time emergency blood dispatch management and candidate response tracking.
          </p>
        </div>

        {/* Fast Dispatch Modal Trigger Button */}
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-3 bg-[#D62828] hover:bg-red-700 text-white font-extrabold text-xs font-mono rounded-xl shadow-md transition-colors text-center shrink-0"
        >
          🚨 + Dispatch Emergency Blood
        </button>
      </div>

      {/* Live Emergency Matching & Triage Operations Console */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Live Candidate Matching Queue Console */}
        <div className="md:col-span-2 card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-4">
          
          <div className="flex items-center justify-between border-b border-[#E2E4E1] dark:border-[#2A3547] pb-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#6FD6BC]">
                PostGIS Match Engine
              </span>
              <h2 className="font-heading text-xl font-extrabold text-[#14213D] dark:text-[#F6F7F5]">
                Candidate Response & Dispatch Queue
              </h2>
            </div>

            <span className="flex items-center gap-1.5 px-3 py-1 bg-[#0F766E]/10 text-[#0F766E] dark:text-[#6FD6BC] font-mono text-xs font-bold rounded-full border border-[#0F766E]/20">
              <span className="w-2 h-2 rounded-full bg-[#0F766E] animate-pulse" />
              <span>Realtime Socket Active</span>
            </span>
          </div>

          {/* Active Dispatch Radar Cards */}
          {requests.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-[#E2E4E1] dark:border-[#2A3547] rounded-xl space-y-2">
              <span className="text-3xl block">📡</span>
              <p className="font-heading text-sm font-extrabold text-[#14213D] dark:text-[#F6F7F5]">
                No Active Emergency Dispatches Right Now
              </p>
              <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4]">
                Create an emergency blood request to trigger high-accuracy expanding radius candidate notifications.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.slice(0, 3).map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-lg font-black text-[#D62828]">{req.blood_group}</span>
                      <UrgencyBadge urgency={req.urgency} />
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4]">
                      {req.units_required} units required • Dispatch ID: <span className="font-mono">{req.id.slice(0, 8)}</span>
                    </p>
                  </div>

                  <Link
                    href={`/requests/${req.id}`}
                    className="px-4 py-2 bg-[#14213D] hover:bg-black dark:bg-[#0F766E] text-white text-xs font-mono font-bold rounded-xl shadow transition-colors text-center shrink-0"
                  >
                    Track Dispatch →
                  </Link>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Dispatch Metrics Column */}
        <div className="space-y-4">
          <div className="card-surface p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm">
            <p className="text-xs font-bold text-[#5B6472] dark:text-[#9AA5B4] uppercase">Active Dispatches</p>
            <p className="font-mono text-3xl font-extrabold text-[#D62828] mt-1">{requests.length}</p>
          </div>

          <div className="card-surface p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm">
            <p className="text-xs font-bold text-[#5B6472] dark:text-[#9AA5B4] uppercase">Critical Pinned</p>
            <p className="font-mono text-3xl font-extrabold text-[#C97A2B] mt-1">
              {requests.filter(r => r.urgency === "CRITICAL").length}
            </p>
          </div>

          <div className="card-surface p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm">
            <p className="text-xs font-bold text-[#5B6472] dark:text-[#9AA5B4] uppercase">Fulfilled Requests</p>
            <p className="font-mono text-3xl font-extrabold text-[#0F766E] dark:text-[#6FD6BC] mt-1">
              {requests.filter(r => r.status === "FULFILLED").length}
            </p>
          </div>
        </div>

      </div>

      {/* Hospital Inventory Lookup Component */}
      <div id="inventory-search">
        <HospitalInventorySearch />
      </div>

      {/* Emergency Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card-surface p-6 rounded-2xl border shadow-2xl max-w-md w-full space-y-4 bg-white dark:bg-[#182233]">
            <h3 className="font-heading text-lg font-extrabold text-[#14213D] dark:text-[#F6F7F5]">
              Dispatch Emergency Blood Request
            </h3>

            {modalError && (
              <div className="p-3 bg-[#D62828]/10 text-[#D62828] border border-[#D62828]/30 rounded-xl text-xs font-mono font-bold">
                ⚠️ {modalError}
              </div>
            )}

            <form onSubmit={handleQuickCreateRequest} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-[#5B6472]">Blood Group Needed</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold"
                >
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-[#5B6472]">Units Required</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={unitsRequired}
                  onChange={(e) => setUnitsRequired(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-[#5B6472]">Urgency Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["NORMAL", "URGENT", "CRITICAL"] as const).map((u) => (
                    <button
                      type="button"
                      key={u}
                      onClick={() => setUrgency(u)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold border ${
                        urgency === u ? "bg-[#D62828] text-white" : "bg-[#F6F7F5] dark:bg-[#101720] text-[#5B6472]"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-mono font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#D62828] text-white font-mono font-bold text-xs rounded-xl shadow disabled:opacity-50"
                >
                  {submitting ? "Dispatching..." : "Confirm Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
