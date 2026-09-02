"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";

export default function EmergencyRequestsDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (filterUrgency) params.append("urgency", filterUrgency);

      const res = await axios.get(`/api/requests?${params.toString()}`);
      if (res.status === 200) {
        setRequests(res.data.requests || []);
      }
    } catch (err) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filterStatus, filterUrgency]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Top Banner Navigation & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#14213D]/5 dark:bg-white/10 hover:bg-[#14213D]/10 dark:hover:bg-white/15 text-[#14213D] dark:text-white font-mono text-xs font-bold rounded-lg transition-colors"
            >
              <span>🏠</span>
              <span>Home</span>
            </Link>
            <span className="text-xs font-extrabold text-[#D62828] bg-[#D62828]/10 px-2.5 py-1 rounded-full uppercase font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D62828] animate-pulse" />
              Live Operations
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#14213D] dark:text-white tracking-tight">
            Emergency Blood Coordination
          </h1>
          <p className="text-xs md:text-sm text-[#5B6472] dark:text-[#9AA5B4] mt-1">
            Real-time emergency requests, candidate matching, and expanding radius dispatch monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/"
            className="px-4 py-2.5 bg-white dark:bg-[#101720] hover:bg-gray-50 dark:hover:bg-[#1c283c] text-[#14213D] dark:text-white border border-[#E2E4E1] dark:border-[#2A3547] font-mono font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <span>←</span> Back to Home
          </Link>
          <Link
            href="/requests/create"
            className="px-5 py-2.5 bg-[#D62828] hover:bg-[#b01f1f] text-white font-mono font-extrabold text-xs rounded-xl shadow-md shadow-[#D62828]/20 transition-all text-center flex items-center gap-2"
          >
            <span>🚨</span> Create Request
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#F6F7F5] dark:bg-[#131B28] p-4 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547]">
        
        {/* Status Pills */}
        <div className="flex flex-wrap gap-2">
          {["", "SEARCHING", "MATCHED", "ACCEPTED", "IN_PROGRESS", "FULFILLED", "CANCELLED"].map((s) => (
            <button
              key={s || "ALL"}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-xl transition-all ${
                filterStatus === s
                  ? "bg-[#14213D] dark:bg-white text-white dark:text-[#14213D] shadow-sm"
                  : "bg-white dark:bg-[#182233] text-[#5B6472] dark:text-[#9AA5B4] border border-[#E2E4E1] dark:border-[#2A3547] hover:border-[#14213D]"
              }`}
            >
              {s ? s.replace("_", " ") : "ALL STATUSES"}
            </button>
          ))}
        </div>

        {/* Urgency Filter */}
        <select
          value={filterUrgency}
          onChange={(e) => setFilterUrgency(e.target.value)}
          aria-label="Filter by urgency"
          className="px-3 py-1.5 bg-white dark:bg-[#182233] text-[#14213D] dark:text-white border border-[#E2E4E1] dark:border-[#2A3547] rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
        >
          <option value="">All Urgencies</option>
          <option value="CRITICAL">Critical Only (🚨)</option>
          <option value="URGENT">Urgent (⚡)</option>
          <option value="NORMAL">Normal Routine</option>
        </select>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-16 text-secondary-var font-mono text-xs flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#D62828] border-t-transparent rounded-full animate-spin" />
          <span>Fetching live emergency requests...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white dark:bg-[#182233] p-12 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] text-center space-y-4">
          <span className="text-4xl">📋</span>
          <p className="text-sm font-semibold text-[#5B6472] dark:text-[#9AA5B4]">
            No emergency blood requests match the selected filters.
          </p>
          <Link
            href="/requests/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#D62828] text-white font-mono font-bold text-xs rounded-xl shadow hover:bg-[#b01f1f] transition-colors"
          >
            <span>+</span> Create New Emergency Request
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((req, idx) => {
            const reqId = req.id || req._id || `req-${idx}`;
            const bloodGroup = req.blood_group || req.bloodGroup || "O+";
            const units = req.units_required || req.unitsNeeded || req.units_needed || 1;
            const urgency = req.urgency || "NORMAL";
            const status = req.status || "SEARCHING";
            const hospitalName = req.hospital_profiles?.hospital_name || req.hospitalName || "Central Emergency Ward";
            const hospitalAddress = req.hospital_profiles?.address || req.hospitalAddress || "";
            const createdAt = req.created_at || req.createdAt || new Date().toISOString();
            const message = req.additional_message || req.patientName ? `Patient: ${req.patientName || "Emergency patient"}` : null;

            return (
              <div
                key={reqId}
                className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-extrabold uppercase flex items-center gap-1.5 ${
                      urgency === "CRITICAL"
                        ? "bg-[#D62828] text-white shadow-sm shadow-[#D62828]/30"
                        : urgency === "URGENT" || urgency === "HIGH"
                        ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20"
                        : "bg-[#14213D] text-white"
                    }`}>
                      {urgency === "CRITICAL" && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                      {urgency} URGENCY
                    </span>

                    <span className="text-[10px] font-mono font-extrabold text-[#5B6472] dark:text-[#9AA5B4] bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] px-2.5 py-1 rounded-lg">
                      {status}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <h3 className="text-2xl font-black text-[#14213D] dark:text-white font-mono">
                      {bloodGroup} <span className="text-xs font-normal text-secondary-var">({units} unit{units > 1 ? "s" : ""})</span>
                    </h3>
                  </div>

                  {message && (
                    <p className="text-xs font-semibold text-[#14213D] dark:text-[#F6F7F5] mt-2 line-clamp-1">
                      {message}
                    </p>
                  )}

                  <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4] mt-2 flex items-center gap-1.5">
                    <span>🏥</span>
                    <strong className="text-[#14213D] dark:text-white">{hospitalName}</strong>
                    {hospitalAddress && <span className="truncate">({hospitalAddress})</span>}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-[#E2E4E1] dark:border-[#2A3547] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-secondary-var">
                    ⏱️ {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <Link
                    href={`/requests/${reqId}`}
                    className="px-3.5 py-1.5 bg-[#D62828]/10 hover:bg-[#D62828] text-[#D62828] hover:text-white font-mono font-bold text-xs rounded-xl transition-all"
                  >
                    Track Dispatch →
                  </Link>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
