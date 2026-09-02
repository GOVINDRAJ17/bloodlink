"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import axios from "axios";
import { MEDICAL_DISCLAIMER } from "@/lib/compatibility";

const BloodMap = dynamic(() => import("@/app/components/Map.js"), { ssr: false });

const bloodGroups = [
  "A+Ve", "A-Ve", "B+Ve", "B-Ve", "O+Ve", "O-Ve", "AB+Ve", "AB-Ve", "Oh+VE", "Oh-VE"
];

const bloodComponents = [
  "Whole Blood",
  "Packed Red Blood Cells",
  "Fresh Frozen Plasma",
  "Single Donor Platelet",
  "Platelet Concentrate",
  "Cryoprecipitate"
];

export default function CreateBloodRequestPage() {
  const router = useRouter();
  
  const [patientName, setPatientName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [bloodComponent, setBloodComponent] = useState("Packed Red Blood Cells");
  const [unitsNeeded, setUnitsNeeded] = useState(2);
  const [urgency, setUrgency] = useState("HIGH");
  const [expiryHours, setExpiryHours] = useState(24);
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [coords, setCoords] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientName || !hospitalName || !bloodGroup || !coords) {
      setError("Please fill in all required fields and pick the hospital location on the map.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        patientName,
        hospitalName,
        hospitalAddress: hospitalAddress || locationLabel,
        bloodGroup,
        bloodComponent,
        unitsNeeded: Number(unitsNeeded),
        urgency,
        expiryHours: Number(expiryHours),
        requesterName,
        requesterPhone,
        location: {
          lat: coords.lat,
          lng: coords.lng
        }
      };

      const res = await axios.post("/api/requests", payload);
      if (res.status === 201 && res.data?.requestId) {
        router.push(`/requests/${res.data.requestId}`);
      } else {
        setError(res.data?.error || "Failed to create emergency request");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "An error occurred while creating the request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        
        <div className="mb-6 border-b border-gray-100 pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            Emergency Dispatch System
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-2">
            Create Emergency Blood Request
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Dispatch an emergency alert to compatible nearby donors and regional blood bank inventories.
          </p>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex gap-3 items-start">
          <span className="text-base">⚠️</span>
          <div>
            <strong>Medical Disclaimer:</strong> {MEDICAL_DISCLAIMER}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Patient & Hospital Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Patient Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Hospital Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. City General Hospital"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Hospital Address / Landmark
            </label>
            <input
              type="text"
              placeholder="e.g. Wing B, ICU Ward 4, M.G. Road"
              value={hospitalAddress}
              onChange={(e) => setHospitalAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
            />
          </div>

          {/* Blood Specs & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Blood Group Required *
              </label>
              <select
                required
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
              >
                <option value="">Select Blood Group</option>
                {bloodGroups.map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Blood Component
              </label>
              <select
                value={bloodComponent}
                onChange={(e) => setBloodComponent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
              >
                {bloodComponents.map(bc => (
                  <option key={bc} value={bc}>{bc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Units Needed
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={unitsNeeded}
                onChange={(e) => setUnitsNeeded(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
              />
            </div>
          </div>

          {/* Urgency & Expiration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Urgency Level
              </label>
              <div className="flex gap-2">
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all ${
                      urgency === u
                        ? u === "CRITICAL"
                          ? "bg-red-600 text-white shadow-sm"
                          : u === "HIGH"
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Alert Expiry Window (Hours)
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
              >
                <option value={4}>4 Hours (Immediate Emergency)</option>
                <option value={12}>12 Hours</option>
                <option value={24}>24 Hours (Standard)</option>
                <option value={48}>48 Hours</option>
              </select>
            </div>
          </div>

          {/* Requester Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Requester / Contact Person Name
              </label>
              <input
                type="text"
                placeholder="e.g. Dr. Verma / Attendant Name"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Contact Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 9876543210"
                value={requesterPhone}
                onChange={(e) => setRequesterPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Map Location Picker */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Select Hospital Location on Map *
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Click the map or tap "📍 Use My Location" to pinpoint exact hospital coordinates for nearest donor matching.
            </p>
            <div className="border border-gray-300 rounded-lg overflow-hidden h-[280px]">
              <BloodMap
                coords={coords}
                setCoords={setCoords}
                label={locationLabel}
                setLabel={setLocationLabel}
              />
            </div>
            {coords && (
              <p className="text-xs font-medium text-green-700 mt-1">
                ✓ Hospital location pinned: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !coords || !bloodGroup || !patientName}
            className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-base rounded-lg shadow transition-colors disabled:bg-gray-400"
          >
            {loading ? "Scanning & Matching Candidates..." : "🚨 Dispatch Emergency Blood Request"}
          </button>

        </form>
      </div>
    </div>
  );
}
