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
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <span className="text-xs font-extrabold text-red-600 bg-red-50 px-2.5 py-1 rounded-full uppercase">
            Live Operations
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-2">
            Emergency Blood Coordination
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Real-time emergency requests, candidate matching, and dispatch lifecycle monitoring.
          </p>
        </div>

        <Link
          href="/requests/create"
          className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg shadow-md transition-colors text-center shrink-0"
        >
          🚨 Create Emergency Request
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
        
        {/* Status Pills */}
        <div className="flex flex-wrap gap-2">
          {["", "SEARCHING", "MATCHED", "ACCEPTED", "IN_PROGRESS", "FULFILLED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterStatus === s
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
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
          className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none"
        >
          <option value="">All Urgencies</option>
          <option value="CRITICAL">Critical Only</option>
          <option value="HIGH">High Urgency</option>
          <option value="MEDIUM">Medium Urgency</option>
          <option value="LOW">Low Urgency</option>
        </select>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 font-medium">
          Fetching live emergency requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-200 text-center">
          <p className="text-gray-500 font-medium mb-4">No emergency blood requests match the selected filters.</p>
          <Link
            href="/requests/create"
            className="text-red-600 font-bold hover:underline text-sm"
          >
            + Create a new blood request now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((req) => (
            <div
              key={req._id}
              className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase ${
                    req.urgency === "CRITICAL"
                      ? "bg-red-600 text-white"
                      : req.urgency === "HIGH"
                      ? "bg-orange-500 text-white"
                      : "bg-blue-600 text-white"
                  }`}>
                    {req.urgency} URGENCY
                  </span>

                  <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                    {req.status}
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-gray-900">
                  {req.bloodGroup} • {req.bloodComponent || "Whole Blood"}
                </h3>

                <p className="text-sm font-semibold text-gray-700 mt-1">
                  Patient: {req.patientName} ({req.unitsNeeded} unit{req.unitsNeeded > 1 ? "s" : ""})
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  🏥 <strong>{req.hospitalName}</strong> {req.hospitalAddress ? `(${req.hospitalAddress})` : ""}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">
                  Created: {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>

                <Link
                  href={`/requests/${req._id}`}
                  className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-md transition-colors"
                >
                  Track Live →
                </Link>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
