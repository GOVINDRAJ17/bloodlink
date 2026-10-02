"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import { UrgencyBadge, StatusBadge, VerifiedBadge, MonoData } from "@/app/components/ui/Badge";
import { useRealtimeRequests } from "@/hooks/useRealtimeRequests";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { getPreciseLiveLocation } from "@/lib/geo/location";

const HospitalInventorySearch = dynamic(
  () => import("@/components/inventory/HospitalInventorySearch"),
  {
    loading: () => <SkeletonLoader rows={4} className="p-6 bg-white dark:bg-[#182233] rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547]" />
  }
);

export default function HospitalDashboardPage() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [hospitalProfile, setHospitalProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Quick Emergency Creation Modal State
  const [showModal, setShowModal] = useState(false);
  const [bloodGroup, setBloodGroup] = useState("O-");
  const [unitsRequired, setUnitsRequired] = useState(2);
  const [urgency, setUrgency] = useState<"NORMAL" | "URGENT" | "CRITICAL">("CRITICAL");
  const [dispatchLat, setDispatchLat] = useState<number | "">("");
  const [dispatchLng, setDispatchLng] = useState<number | "">("");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Hospital Management Navigation Tab
  const [activeTab, setActiveTab] = useState<"DISPATCHES" | "CAMPS" | "APPOINTMENTS" | "VERIFICATIONS">("DISPATCHES");
  const [camps, setCamps] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [showCampModal, setShowCampModal] = useState(false);
  const [campTitle, setCampTitle] = useState("");
  const [campLocation, setCampLocation] = useState("");
  const [campStartDate, setCampStartDate] = useState("");
  const [campEndDate, setCampEndDate] = useState("");
  const [campTargetUnits, setCampTargetUnits] = useState(150);

  const fetchHospitalModules = async () => {
    try {
      const [campsRes, aptsRes, versRes] = await Promise.all([
        fetch("/api/hospitals/camps").then(r => r.json()),
        fetch("/api/hospitals/appointments").then(r => r.json()),
        fetch("/api/hospitals/verifications").then(r => r.json()),
      ]);
      if (campsRes.camps) setCamps(campsRes.camps);
      if (aptsRes.appointments) setAppointments(aptsRes.appointments);
      if (versRes.verifications) setVerifications(versRes.verifications);
    } catch (e) {
      console.warn("Could not fetch hospital auxiliary modules", e);
    }
  };

  useEffect(() => {
    fetchHospitalModules();
  }, []);

  const handleUpdateAppointment = async (appointmentId: string, status: string) => {
    try {
      await fetch("/api/hospitals/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, status }),
      });
      fetchHospitalModules();
    } catch (e) {
      alert("Failed to update appointment");
    }
  };

  const handleUpdateVerification = async (verificationId: string, status: string) => {
    try {
      await fetch("/api/hospitals/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId, status }),
      });
      fetchHospitalModules();
    } catch (e) {
      alert("Failed to update verification");
    }
  };

  const handleCreateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/hospitals/camps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: campTitle,
          locationName: campLocation,
          startDate: campStartDate,
          endDate: campEndDate,
          targetUnits: campTargetUnits,
          organizerHospital: hospitalProfile?.hospital_name || "City General Hospital",
        }),
      });
      if (res.ok) {
        setShowCampModal(false);
        setCampTitle("");
        setCampLocation("");
        fetchHospitalModules();
      }
    } catch (e) {
      alert("Failed to create camp");
    }
  };

  const { requests, loading: loadingRequests } = useRealtimeRequests(hospitalProfile?.id);

  useEffect(() => {
    if (authLoading) return;

    async function loadHospital() {
      try {
        if (!user) return;

        const { data: hosp } = await supabase
          .from("hospital_profiles")
          .select("id, user_id, hospital_name, license_number, verified, phone, address")
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

  const handleDetectDispatchLocation = async () => {
    try {
      setDetectingLocation(true);
      const loc = await getPreciseLiveLocation();
      setDispatchLat(loc.lat);
      setDispatchLng(loc.lng);
    } catch {
      alert("Could not automatically retrieve GPS coordinates. Please enter latitude and longitude manually.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleQuickCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError("");

    if (dispatchLat === "" || dispatchLng === "" || isNaN(Number(dispatchLat)) || isNaN(Number(dispatchLng))) {
      setModalError("Please provide dispatch latitude and longitude or click 'Detect GPS'.");
      setSubmitting(false);
      return;
    }

    if (!dispatchMessage.trim()) {
      setModalError("Please provide an emergency reason or patient requirement note.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blood_group: bloodGroup,
          units_required: Number(unitsRequired),
          urgency,
          lat: Number(dispatchLat),
          lng: Number(dispatchLng),
          hospital_name: hospitalProfile?.hospital_name || "Hospital Emergency Facility",
          hospital_address: hospitalProfile?.address || "",
          additional_message: dispatchMessage.trim()
        })
      });

      const resData = await res.json();
      if (res.ok) {
        setShowModal(false);
        setDispatchMessage("");
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

      {/* HOSPITAL OPERATIONS NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white dark:bg-[#182233] rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
        {[
          { id: "DISPATCHES", label: "🚨 Emergency Dispatches & Triage", count: requests.length },
          { id: "CAMPS", label: "🎪 Blood Donation Camps", count: camps.length },
          { id: "APPOINTMENTS", label: "📅 Donor Appointments", count: appointments.length },
          { id: "VERIFICATIONS", label: "🛡️ Certificate & ID Verification", count: verifications.filter(v => v.status === "PENDING").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl font-mono text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-[#14213D] dark:bg-white text-white dark:text-[#14213D] shadow-sm"
                : "text-secondary-var hover:bg-gray-100 dark:hover:bg-[#101720]"
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === tab.id
                ? "bg-[#D62828] text-white"
                : "bg-gray-200 dark:bg-gray-800 text-secondary-var"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* TAB 1: EMERGENCY DISPATCHES (ORIGINAL VIEW) */}
      {activeTab === "DISPATCHES" && (
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
                      <UrgencyBadge level={req.urgency} />
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
      )}

      {/* TAB 2: DONATION CAMPS ORGANIZER */}
      {activeTab === "CAMPS" && (
        <div className="card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E4E1] dark:border-[#2A3547] pb-4">
            <div>
              <h2 className="font-heading text-xl font-extrabold text-[#14213D] dark:text-white">
                🎪 Blood Donation Drives & Community Camps
              </h2>
              <p className="text-xs text-secondary-var mt-0.5">
                Organize public blood donation camps, set target units, and mobilize community donors.
              </p>
            </div>
            <button
              onClick={() => setShowCampModal(true)}
              className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0b5b54] text-white text-xs font-mono font-bold rounded-xl shadow transition-colors flex items-center gap-1.5 shrink-0"
            >
              <span>➕</span>
              <span>Host New Blood Camp</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {camps.map((camp) => (
              <div key={camp.id} className="p-5 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-[#14213D] dark:text-white">{camp.title}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0F766E]/15 text-[#0F766E]">
                    {camp.status}
                  </span>
                </div>
                <p className="text-xs text-secondary-var font-mono">📍 {camp.locationName} • {camp.address}</p>
                <div className="flex justify-between text-xs font-mono text-secondary-var">
                  <span>Dates: <strong>{camp.startDate}</strong> to <strong>{camp.endDate}</strong></span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span>Collection Target</span>
                    <span className="font-bold text-[#D62828]">{camp.collectedUnits} / {camp.targetUnits} Units</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#D62828] h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((camp.collectedUnits / camp.targetUnits) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-[#E2E4E1] dark:border-[#2A3547]">
                  <span className="text-secondary-var">Registered: <strong>{camp.registeredDonorsCount} donors</strong></span>
                  <span className="text-emerald-600 font-bold">Active Drive</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DONOR APPOINTMENTS */}
      {activeTab === "APPOINTMENTS" && (
        <div className="card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#E2E4E1] dark:border-[#2A3547] pb-4">
            <div>
              <h2 className="font-heading text-xl font-extrabold text-[#14213D] dark:text-white">
                📅 Voluntary Donor Appointment Slots
              </h2>
              <p className="text-xs text-secondary-var mt-0.5">
                Review and confirm scheduled donor arrivals to manage hospital blood bank intake.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-secondary-var">
              {appointments.length} Appointments on Schedule
            </span>
          </div>

          <div className="space-y-3">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="p-4 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-[#D62828] bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded">
                      {apt.bloodGroup}
                    </span>
                    <span className="font-heading font-extrabold text-sm text-[#14213D] dark:text-white">
                      {apt.donorName}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      apt.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {apt.status}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-secondary-var">
                    📞 {apt.donorPhone} • Date: <strong>{apt.appointmentDate}</strong> ({apt.timeSlot})
                  </p>
                  {apt.notes && <p className="text-[11px] text-secondary-var italic">{apt.notes}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {apt.status === "PENDING" && (
                    <button
                      onClick={() => handleUpdateAppointment(apt.id, "CONFIRMED")}
                      className="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0c5c55] text-white text-xs font-mono font-bold rounded-lg shadow"
                    >
                      ✓ Confirm Arrival
                    </button>
                  )}
                  {apt.status === "CONFIRMED" && (
                    <button
                      onClick={() => handleUpdateAppointment(apt.id, "COMPLETED")}
                      className="px-3 py-1.5 bg-[#14213D] hover:bg-black text-white text-xs font-mono font-bold rounded-lg shadow"
                    >
                      🩸 Mark Donated
                    </button>
                  )}
                  <button
                    onClick={() => handleUpdateAppointment(apt.id, "CANCELLED")}
                    className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-mono font-bold rounded-lg hover:bg-red-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DONOR CERTIFICATE & ID VERIFICATION */}
      {activeTab === "VERIFICATIONS" && (
        <div className="card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#E2E4E1] dark:border-[#2A3547] pb-4">
            <div>
              <h2 className="font-heading text-xl font-extrabold text-[#14213D] dark:text-white">
                🛡️ Donor Certificate & Identity Verification Queue
              </h2>
              <p className="text-xs text-secondary-var mt-0.5">
                Inspect medical fitness certificates, laboratory serology reports, and government credentials.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-600">
              {verifications.filter(v => v.status === "PENDING").length} Awaiting Inspection
            </span>
          </div>

          <div className="space-y-3">
            {verifications.map((ver) => (
              <div
                key={ver.id}
                className="p-4 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-[#0F766E] bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                      {ver.bloodGroup}
                    </span>
                    <span className="font-heading font-extrabold text-sm text-[#14213D] dark:text-white">
                      {ver.donorName}
                    </span>
                    <span className="text-xs font-mono text-secondary-var">({ver.documentType})</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      ver.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {ver.status}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-secondary-var">
                    Doc Ref: <strong>{ver.documentNumber}</strong> • Submitted: {ver.submittedDate}
                  </p>
                  {ver.notes && <p className="text-[11px] text-secondary-var italic">{ver.notes}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {ver.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleUpdateVerification(ver.id, "VERIFIED")}
                        className="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0c5c55] text-white text-xs font-mono font-bold rounded-lg shadow"
                      >
                        ✓ Approve Verified Badge
                      </button>
                      <button
                        onClick={() => handleUpdateVerification(ver.id, "REJECTED")}
                        className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-mono font-bold rounded-lg hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {ver.status === "VERIFIED" && (
                    <span className="text-xs font-mono font-bold text-emerald-600">✓ Verified Certified Donor</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE CAMP MODAL */}
      {showCampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card-surface p-6 rounded-2xl border shadow-2xl max-w-md w-full space-y-4 bg-white dark:bg-[#182233]">
            <h3 className="font-heading text-lg font-extrabold text-[#14213D] dark:text-white">
              Host Blood Donation Drive
            </h3>
            <form onSubmit={handleCreateCamp} className="space-y-3">
              <div>
                <label className="text-xs font-mono font-bold text-secondary-var">Drive Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Corporate Mega Blood Drive"
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-mono font-bold text-secondary-var">Venue / Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Hall, MG Road, Mumbai"
                  value={campLocation}
                  onChange={(e) => setCampLocation(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono font-bold text-secondary-var">Start Date</label>
                  <input
                    type="date"
                    required
                    value={campStartDate}
                    onChange={(e) => setCampStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono font-bold text-secondary-var">End Date</label>
                  <input
                    type="date"
                    required
                    value={campEndDate}
                    onChange={(e) => setCampEndDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-mono font-bold text-secondary-var">Target Units</label>
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={campTargetUnits}
                  onChange={(e) => setCampTargetUnits(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCampModal(false)}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-mono font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#0F766E] text-white font-mono font-bold text-xs rounded-xl shadow"
                >
                  Publish Camp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

              {/* Coordinates & Location Detection */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold text-[#5B6472]">Dispatch Coordinates</label>
                  <button
                    type="button"
                    onClick={handleDetectDispatchLocation}
                    disabled={detectingLocation}
                    className="text-[10px] font-mono text-[#0F766E] dark:text-[#6FD6BC] hover:underline font-bold"
                  >
                    {detectingLocation ? "Detecting..." : "📍 Detect GPS"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Latitude (e.g. 19.10)"
                    value={dispatchLat}
                    onChange={(e) => setDispatchLat(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold"
                  />
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Longitude (e.g. 72.85)"
                    value={dispatchLng}
                    onChange={(e) => setDispatchLng(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Clinical Requirement Message */}
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-[#5B6472]">Emergency Requirement Note</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Critical trauma surgery, urgent crossmatch required immediately"
                  value={dispatchMessage}
                  onChange={(e) => setDispatchMessage(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono"
                />
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
