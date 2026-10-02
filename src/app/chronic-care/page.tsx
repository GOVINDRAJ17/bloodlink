"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { UrgencyBadge, StatusBadge, MonoData } from "@/app/components/ui/Badge";
import { INITIAL_CHRONIC_PATIENTS, getChronicMetrics, ChronicPatient } from "@/lib/data/chronicCareData";

export default function ChronicCarePage() {
  const [patients, setPatients] = useState<ChronicPatient[]>(INITIAL_CHRONIC_PATIENTS);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [stats, setStats] = useState(() => {
    const m = getChronicMetrics("ALL");
    return {
      totalPatients: m.totalPatients,
      dueNext7Days: m.dueNext7Days,
      totalUnitsReserved: m.totalUnitsReserved,
    };
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [conditionType, setConditionType] = useState<any>("THALASSEMIA_MAJOR");
  const [bloodGroup, setBloodGroup] = useState("O-");
  const [requiredComponent, setRequiredComponent] = useState("Packed Red Blood Cells (Leukodepleted)");
  const [unitsPerCycle, setUnitsPerCycle] = useState(2);
  const [cycleFrequencyDays, setCycleFrequencyDays] = useState(21);
  const [nextTransfusionDate, setNextTransfusionDate] = useState("");
  const [hospitalName, setHospitalName] = useState("City Hospital Pediatric Hematology");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reservation In-Progress
  const [reservingId, setReservingId] = useState<string | null>(null);

  const fetchPatients = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/chronic-care?condition=${activeFilter}`, {
        signal,
      });
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients || []);
        setStats({
          totalPatients: data.totalPatients || 0,
          dueNext7Days: data.dueNext7Days || 0,
          totalUnitsReserved: data.totalUnitsReserved || 0,
        });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Error loading chronic care patients:", err);
      }
    }
  }, [activeFilter]);

  useEffect(() => {
    const controller = new AbortController();

    // Instant local response on filter switch
    const localFiltered = activeFilter === "ALL"
      ? INITIAL_CHRONIC_PATIENTS
      : INITIAL_CHRONIC_PATIENTS.filter(p => p.conditionType === activeFilter);
    setPatients(localFiltered);

    const m = getChronicMetrics(activeFilter);
    setStats({
      totalPatients: m.totalPatients,
      dueNext7Days: m.dueNext7Days,
      totalUnitsReserved: m.totalUnitsReserved,
    });

    fetchPatients(controller.signal);

    return () => {
      controller.abort();
    };
  }, [activeFilter, fetchPatients]);

  const handleReserveUnits = async (patientId: string) => {
    try {
      setReservingId(patientId);
      const res = await fetch("/api/chronic-care", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, action: "RESERVE_MATCH" }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchPatients();
      } else {
        alert(data.error || "Failed to reserve units");
      }
    } catch (err: any) {
      alert(`Error reserving: ${err.message}`);
    } finally {
      setReservingId(null);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/chronic-care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          conditionType,
          bloodGroup,
          requiredComponent,
          unitsPerCycle,
          cycleFrequencyDays,
          nextTransfusionDate,
          hospitalName,
          notes,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        // Reset form
        setFullName("");
        setNextTransfusionDate("");
        setNotes("");
        fetchPatients();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to register patient");
      }
    } catch (err: any) {
      alert(`Registration error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const calculateDaysUntil = (dateStr: string) => {
    const target = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-6 min-h-screen">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-[#0F766E] bg-[#0F766E]/10 px-2.5 py-1 rounded-full">
              Recurring Transfusion Registry
            </span>
            <span className="text-xs font-mono text-secondary-var">Lifeline Protocol</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-[#14213D] dark:text-white">
            Chronic Care & Thalassemia Tracking Dashboard
          </h1>
          <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4] mt-1">
            Dedicated recurring blood schedule management for Thalassemia Major, Leukemia, and Sickle Cell patients.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-3 bg-[#D62828] hover:bg-red-700 text-white font-mono font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0"
        >
          <span>➕</span>
          <span>Register Chronic Patient</span>
        </button>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm">
          <p className="text-xs font-mono font-bold text-secondary-var uppercase">Active Care Patients</p>
          <p className="font-mono text-3xl font-extrabold text-[#14213D] dark:text-white mt-1">{stats.totalPatients}</p>
          <span className="text-[11px] font-mono text-emerald-600 mt-1 block">Recurring Transfusions</span>
        </div>

        <div className="p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm">
          <p className="text-xs font-mono font-bold text-secondary-var uppercase">Cycles Due This Week</p>
          <p className="font-mono text-3xl font-extrabold text-[#D62828] mt-1">{stats.dueNext7Days}</p>
          <span className="text-[11px] font-mono text-amber-600 mt-1 block">Requires Donor Confirmation</span>
        </div>

        <div className="p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm">
          <p className="text-xs font-mono font-bold text-secondary-var uppercase">Units Secured</p>
          <p className="font-mono text-3xl font-extrabold text-[#0F766E] dark:text-[#6FD6BC] mt-1">{stats.totalUnitsReserved}</p>
          <span className="text-[11px] font-mono text-emerald-600 mt-1 block">Allocated in Inventory</span>
        </div>

        <div className="p-5 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm">
          <p className="text-xs font-mono font-bold text-secondary-var uppercase">Average Interval</p>
          <p className="font-mono text-3xl font-extrabold text-[#C97A2B] mt-1">21 Days</p>
          <span className="text-[11px] font-mono text-secondary-var mt-1 block">Preventive Schedule</span>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-[#182233] rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
        <span className="text-xs font-mono font-bold text-secondary-var uppercase px-3">Filter Condition:</span>
        {[
          { label: "All Patients", val: "ALL" },
          { label: "🩸 Thalassemia Major", val: "THALASSEMIA_MAJOR" },
          { label: "🎗️ Leukemia / Oncology", val: "LEUKEMIA" },
          { label: "🧬 Sickle Cell Disease", val: "SICKLE_CELL" },
          { label: "🛡️ Aplastic Anemia", val: "APLASTIC_ANEMIA" },
        ].map((tab) => (
          <button
            key={tab.val}
            onClick={() => setActiveFilter(tab.val)}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeFilter === tab.val
                ? "bg-[#14213D] dark:bg-white text-white dark:text-[#14213D] shadow-sm"
                : "bg-transparent text-secondary-var hover:bg-gray-100 dark:hover:bg-[#101720]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PATIENTS TIMELINE & ROSTER */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center font-mono text-xs text-secondary-var">Loading Chronic Care Roster...</div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#182233] rounded-2xl border border-dashed border-[#E2E4E1] dark:border-[#2A3547] space-y-2">
            <span className="text-3xl block">🩺</span>
            <p className="font-bold text-sm">No registered patients under this condition filter.</p>
            <p className="text-xs text-secondary-var">Click "Register Chronic Patient" to enroll a recurring transfusion recipient.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patients.map((pat) => {
              const daysUntil = calculateDaysUntil(pat.nextTransfusionDate);
              const isUrgent = daysUntil <= 3;

              return (
                <div
                  key={pat.id}
                  className="p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-4 hover:border-[#0F766E] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-black text-[#D62828] bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-lg border border-red-200 dark:border-red-800">
                          {pat.bloodGroup}
                        </span>
                        <h3 className="font-heading text-base font-extrabold text-[#14213D] dark:text-white">
                          {pat.fullName}
                        </h3>
                      </div>
                      <p className="text-xs text-secondary-var mt-1 font-mono">
                        Facility: <strong>{pat.hospitalName}</strong>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase ${
                        pat.conditionType === "THALASSEMIA_MAJOR"
                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300"
                          : pat.conditionType === "LEUKEMIA"
                          ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border border-purple-300"
                          : "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300"
                      }`}>
                        {pat.conditionType.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl text-xs font-mono">
                    <div>
                      <span className="text-secondary-var block text-[10px] uppercase font-bold">Required Component</span>
                      <span className="font-bold text-[#14213D] dark:text-white">{pat.requiredComponent}</span>
                    </div>
                    <div>
                      <span className="text-secondary-var block text-[10px] uppercase font-bold">Cycle Dosage</span>
                      <span className="font-bold text-[#14213D] dark:text-white">{pat.unitsPerCycle} Units every {pat.cycleFrequencyDays} days</span>
                    </div>
                    <div>
                      <span className="text-secondary-var block text-[10px] uppercase font-bold">Next Transfusion</span>
                      <span className={`font-black ${isUrgent ? "text-[#D62828]" : "text-emerald-600"}`}>
                        {pat.nextTransfusionDate} ({daysUntil > 0 ? `In ${daysUntil} days` : "DUE TODAY"})
                      </span>
                    </div>
                    <div>
                      <span className="text-secondary-var block text-[10px] uppercase font-bold">Stock Allocation</span>
                      <span className={`font-bold ${pat.matchingStatus === "CONFIRMED" ? "text-emerald-600" : "text-amber-600"}`}>
                        {pat.reservedUnits} / {pat.unitsPerCycle} Units Secured
                      </span>
                    </div>
                  </div>

                  {pat.notes && (
                    <p className="text-[11px] text-secondary-var italic bg-gray-50 dark:bg-[#141d2b] p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                      📝 {pat.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[#E2E4E1] dark:border-[#2A3547]">
                    <span className={`text-[11px] font-mono font-bold flex items-center gap-1.5 ${
                      pat.matchingStatus === "CONFIRMED" ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${pat.matchingStatus === "CONFIRMED" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                      {pat.matchingStatus === "CONFIRMED" ? "Blood Secured & Donor Confirmed" : "Matching Unconfirmed"}
                    </span>

                    {pat.matchingStatus !== "CONFIRMED" ? (
                      <button
                        onClick={() => handleReserveUnits(pat.id)}
                        disabled={reservingId === pat.id}
                        className="px-4 py-2 bg-[#0F766E] hover:bg-[#0c5f59] text-white text-xs font-mono font-bold rounded-xl shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span>{reservingId === pat.id ? "Securing..." : "🩸 Reserve & Match Units"}</span>
                      </button>
                    ) : (
                      <span className="text-xs font-mono font-bold text-emerald-600">✓ Ready for Transfusion</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REGISTER CHRONIC PATIENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card-surface p-6 rounded-2xl border shadow-2xl max-w-lg w-full space-y-4 bg-white dark:bg-[#182233]">
            <div className="flex items-center justify-between border-b border-[#E2E4E1] dark:border-[#2A3547] pb-3">
              <h3 className="font-heading text-lg font-extrabold text-[#14213D] dark:text-white">
                Register Chronic Transfusion Patient
              </h3>
              <button onClick={() => setShowModal(false)} className="text-xs font-mono text-secondary-var hover:text-black dark:hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreatePatient} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-secondary-var">Patient Full Name & Age</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh K. Verma (Child / 11y)"
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold text-[#14213D] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-secondary-var">Clinical Condition</label>
                  <select
                    value={conditionType}
                    onChange={(e) => setConditionType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold text-[#14213D] dark:text-white"
                  >
                    <option value="THALASSEMIA_MAJOR">Thalassemia Major</option>
                    <option value="LEUKEMIA">Leukemia / Oncology</option>
                    <option value="SICKLE_CELL">Sickle Cell Disease</option>
                    <option value="APLASTIC_ANEMIA">Aplastic Anemia</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-secondary-var">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold text-[#14213D] dark:text-white"
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-secondary-var">Units Per Cycle</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={unitsPerCycle}
                    onChange={(e) => setUnitsPerCycle(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold text-[#14213D] dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-secondary-var">Cycle Interval (Days)</label>
                  <input
                    type="number"
                    min="7"
                    max="60"
                    value={cycleFrequencyDays}
                    onChange={(e) => setCycleFrequencyDays(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold text-[#14213D] dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-secondary-var">Next Scheduled Transfusion Date *</label>
                <input
                  type="date"
                  required
                  value={nextTransfusionDate}
                  onChange={(e) => setNextTransfusionDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold text-[#14213D] dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-secondary-var">Primary Treating Facility</label>
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono font-bold text-[#14213D] dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-secondary-var">Clinical Notes & Chelation Protocols</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Leukodepleted PRBC strictly required; Desferal chelation..."
                  className="w-full p-2.5 rounded-xl border bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono text-[#14213D] dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#E2E4E1] dark:border-[#2A3547]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-mono font-bold text-secondary-var"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#D62828] hover:bg-red-700 text-white font-mono font-bold text-xs rounded-xl shadow disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Enroll Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
