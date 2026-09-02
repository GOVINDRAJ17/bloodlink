"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import axios from "axios";
import { MEDICAL_DISCLAIMER } from "@/lib/compatibility";

const STATES_ORDER = ["PENDING", "SEARCHING", "MATCHED", "ACCEPTED", "IN_PROGRESS", "FULFILLED"];

export default function RequestDetailsPage({ params }) {
  const unwrappedParams = use(params);
  const requestId = unwrappedParams.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/requests/${requestId}`);
      if (res.status === 200) {
        setData(res.data);
      } else {
        setError("Failed to load request details.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Error loading emergency request");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) {
      fetchRequestDetails();
    }
  }, [requestId]);

  const handleStatusTransition = async (nextStatus, note = "") => {
    try {
      setActionLoading(true);
      const res = await axios.patch(`/api/requests/${requestId}`, { nextStatus, note });
      if (res.status === 200) {
        await fetchRequestDetails();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMatchResponse = async (matchId, action) => {
    try {
      setActionLoading(true);
      const res = await axios.post(`/api/matches/${matchId}/respond`, { action });
      if (res.status === 200) {
        await fetchRequestDetails();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to respond to match");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center text-gray-500 font-medium">
        Loading emergency request status & candidate rankings...
      </div>
    );
  }

  if (error || !data?.request) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <p className="text-red-600 font-bold mb-4">{error || "Request not found"}</p>
        <Link href="/requests" className="text-blue-600 underline font-medium">
          ← Back to All Emergency Requests
        </Link>
      </div>
    );
  }

  const { request: req, matches = [] } = data;
  const isTerminal = ["FULFILLED", "CANCELLED", "EXPIRED"].includes(req.status);
  const currentStepIndex = STATES_ORDER.indexOf(req.status);

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
              req.urgency === "CRITICAL" ? "bg-red-600 text-white" : "bg-orange-500 text-white"
            }`}>
              {req.urgency} URGENCY
            </span>
            <span className="text-xs font-bold text-gray-400">ID: {req._id}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mt-2">
            Emergency Request: {req.bloodGroup} ({req.bloodComponent})
          </h1>
          <p className="text-sm text-gray-600">
            Patient: <strong>{req.patientName}</strong> • {req.hospitalName} ({req.hospitalAddress || "Address provided"})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {req.status === "ACCEPTED" && (
            <button
              disabled={actionLoading}
              onClick={() => handleStatusTransition("IN_PROGRESS", "Blood dispatch in progress")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow"
            >
              🚚 Mark In Transit
            </button>
          )}

          {req.status === "IN_PROGRESS" && (
            <button
              disabled={actionLoading}
              onClick={() => handleStatusTransition("FULFILLED", "Blood successfully delivered and received")}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow"
            >
              ✅ Mark Fulfilled
            </button>
          )}

          {!isTerminal && (
            <button
              disabled={actionLoading}
              onClick={() => {
                if (confirm("Are you sure you want to cancel this emergency blood request?")) {
                  handleStatusTransition("CANCELLED", "Request cancelled by user");
                }
              }}
              className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold rounded-lg"
            >
              ❌ Cancel Request
            </button>
          )}
        </div>
      </div>

      {/* State Machine Stepper */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">
          Emergency Lifecycle Progress
        </h3>
        <div className="flex items-center justify-between overflow-x-auto py-2">
          {STATES_ORDER.map((step, idx) => {
            const isDone = currentStepIndex >= idx;
            const isCurrent = req.status === step;
            return (
              <div key={step} className="flex-1 flex flex-col items-center min-w-[90px]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isCurrent
                    ? "bg-red-600 text-white border-red-600 ring-4 ring-red-100"
                    : isDone
                    ? "bg-green-500 text-white border-green-500"
                    : "bg-gray-100 text-gray-400 border-gray-300"
                }`}>
                  {isDone && !isCurrent ? "✓" : idx + 1}
                </div>
                <span className={`text-[11px] font-bold mt-2 text-center uppercase ${
                  isCurrent ? "text-red-600" : isDone ? "text-gray-800" : "text-gray-400"
                }`}>
                  {step.replace("_", " ")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Medical Safety & Privacy Notices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
          <strong className="block mb-1">⚖️ Medical Compatibility Disclaimer</strong>
          {MEDICAL_DISCLAIMER}
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs">
          <strong className="block mb-1">🛡️ Donor Privacy Protection</strong>
          Individual donor precise coordinates & personal phone numbers are masked. Only calculated distance (~X.X km) is shown prior to confirmed match acceptance.
        </div>
      </div>

      {/* Ranked Candidate Matches */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Ranked Candidates & Nearby Stock ({matches.length})
            </h2>
            <p className="text-xs text-gray-500">
              Matches ranked by ABO/Rh compatibility, distance, urgency, and donor eligibility.
            </p>
          </div>
          <button
            onClick={fetchRequestDetails}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            🔄 Refresh List
          </button>
        </div>

        {matches.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No compatible nearby candidates matched yet. Expanding search scan radius...
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {matches.map((m) => (
              <div key={m._id || m.candidateId} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* Candidate Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      m.candidateType === "DONOR" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {m.candidateType}
                    </span>
                    <span className="font-bold text-gray-900 text-base">{m.candidateName}</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-semibold text-gray-700">
                      {m.bloodGroup}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500">
                    📍 <strong>~{m.distanceKm} km away</strong> • Compatibility Tier:{" "}
                    <span className="font-semibold text-gray-700">{m.compatTier}</span> • Match Score:{" "}
                    <strong className="text-green-700">{m.totalScore}/100</strong>
                  </p>
                </div>

                {/* Response Action Buttons */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                    m.status === "ACCEPTED"
                      ? "bg-green-100 text-green-800"
                      : m.status === "DECLINED"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {m.status}
                  </span>

                  {m.status === "NOTIFIED" && !isTerminal && (
                    <div className="flex gap-2">
                      <button
                        disabled={actionLoading}
                        onClick={() => handleMatchResponse(m._id, "ACCEPT")}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow"
                      >
                        Accept Match
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleMatchResponse(m._id, "DECLINE")}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
