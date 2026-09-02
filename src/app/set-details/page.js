'use client';
import data from "@/../assets/district_data.json";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import axios from "axios";

const bloodGroups = {
  "A-Ve": 12,
  "B+Ve": 13,
  "B-Ve": 14,
  "O+Ve": 15,
  "AB+Ve": 17,
  "AB-Ve": 18,
  "A+Ve": 11,
  "O-Ve": 16,
  "Oh+VE": 22,
  "Oh-VE": 23
};

export default function SetDetails() {
  const supabase = createClient();
  const [part, setPart] = useState(0);
  const states = data.statesWithDistricts;
  const [districts, setDistricts] = useState([]);

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("male");
  const [phone, setPhone] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const [donor, setDonor] = useState(true);
  const [bloodGroupId, setBloodGroupId] = useState("");

  const [lastDonationDate, setLastDonationDate] = useState("");
  const [donationCamp, setDonationCamp] = useState("");
  const [recentTattoo, setRecentTattoo] = useState(false);
  const [pregnant, setPregnant] = useState(false);
  const [underweight, setUnderweight] = useState(false);
  const [onMedication, setOnMedication] = useState(false);
  const [medicationDetails, setMedicationDetails] = useState("");
  const [hasDisease, setHasDisease] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  var isEligibleToDonate =
    donor &&
    !recentTattoo &&
    !pregnant &&
    !underweight &&
    !hasDisease;

  useEffect(() => {
    const selectedState = states.find(s => s.stateCode === stateCode);
    if (selectedState) {
      setDistricts(selectedState.districts);
      setDistrictCode("");
    } else {
      setDistricts([]);
    }
  }, [stateCode, states]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        email: session?.user?.email || "user@example.com",
        details: {
          fullName,
          dob,
          gender,
          phone,
          stateCode,
          districtCode,
          emergencyContact: {
            name: emergencyName,
            phone: emergencyPhone,
          },
          isDonor: donor,
          bloodGroupId,
          donorDetails: donor
            ? {
              lastDonationDate: lastDonationDate || null,
              donationCamp: donationCamp || null,
              recentTattoo,
              pregnant,
              underweight,
              onMedication,
              medicationDetails: onMedication ? medicationDetails : null,
              hasDisease,
              isEligibleToDonate,
            }
            : null,
          isProfileComplete: true
        }
      };

      const response = await axios.post("/api/details", { payload });
      if (response.status === 200) {
        alert("Profile details saved successfully!");
        window.location.href = "/dashboard/donor";
      } else {
        setError("Failed to submit details. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while submitting details.");
    } finally {
      setLoading(false);
    }
  };

  const handlePart0Continue = (e) => {
    e.preventDefault();
    if (!fullName || !dob || !phone || !stateCode) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setPart(1);
  };

  const handlePart1Continue = (e) => {
    e.preventDefault();
    if (!bloodGroupId) {
      setError("Please select a blood group.");
      return;
    }
    setError("");
    donor ? setPart(2) : handleSubmit();
  };

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-10">
      
      {/* Stepper Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-red-600">
            Step {part + 1} of {donor ? 3 : 2}: {part === 0 ? "Personal Details" : part === 1 ? "Blood Specification" : "Donor Medical Screening"}
          </span>
          <span className="text-xs font-bold text-gray-400">{Math.round(((part + 1) / (donor ? 3 : 2)) * 100)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-red-600 h-full transition-all duration-300"
            style={{ width: `${((part + 1) / (donor ? 3 : 2)) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
        {error && <div className="mb-6 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-bold">{error}</div>}

        {/* ───── STEP 1: Personal Details ───── */}
        {part === 0 && (
          <form onSubmit={handlePart0Continue} className="space-y-4">
            <h2 className="text-xl font-black text-gray-900 mb-1">Personal Details</h2>
            <p className="text-xs text-gray-500 mb-4">Basic information required for emergency contact and verification.</p>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">State *</label>
                <select
                  required
                  value={stateCode}
                  onChange={(e) => { setStateCode(e.target.value); setDistrictCode(""); }}
                  className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  <option value="">Select State</option>
                  {states.map(s => (
                    <option key={s.stateCode} value={s.stateCode}>{s.stateName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">District</label>
                <select
                  value={districtCode}
                  onChange={(e) => setDistrictCode(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  <option value="">Select District</option>
                  {districts.map(d => (
                    <option key={d.districtCode} value={d.districtCode}>{d.districtName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Kin / Relative Name"
                  className="w-full p-2.5 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Emergency Contact Phone</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="w-full p-2.5 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg shadow mt-4 transition-colors"
            >
              Continue to Step 2 →
            </button>
          </form>
        )}

        {/* ───── STEP 2: Blood Specifications ───── */}
        {part === 1 && (
          <form onSubmit={handlePart1Continue} className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-1">Blood Specification & Opt-In</h2>
              <p className="text-xs text-gray-500">Specify your blood group and whether you are available to donate blood.</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Do you wish to register as a Blood Donor?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-gray-800">
                  <input
                    type="radio"
                    name="donorToggle"
                    checked={donor === true}
                    onChange={() => setDonor(true)}
                    className="accent-red-600"
                  />
                  Yes, I want to help save lives
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-gray-600">
                  <input
                    type="radio"
                    name="donorToggle"
                    checked={donor === false}
                    onChange={() => setDonor(false)}
                    className="accent-gray-600"
                  />
                  No, recipient only
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Select Blood Group *</label>
              <select
                required
                value={bloodGroupId}
                onChange={(e) => setBloodGroupId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-base font-bold focus:ring-2 focus:ring-red-500"
              >
                <option value="">-- Select Blood Group --</option>
                {Object.entries(bloodGroups).map(([name, code]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPart(0)}
                className="w-1/3 py-3 border border-gray-300 text-gray-700 font-bold text-sm rounded-lg"
              >
                ← Back
              </button>
              <button
                type="submit"
                className="w-2/3 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg shadow transition-colors"
              >
                {donor ? "Continue to Donor Screening →" : "Save Profile"}
              </button>
            </div>
          </form>
        )}

        {/* ───── STEP 3: Medical Screening (Donor Only) ───── */}
        {part === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-1">Donor Medical Screening</h2>
              <p className="text-xs text-gray-500">
                Please answer these screening questions truthfully. <em>This helps us confirm you can safely donate without risk to yourself or recipients.</em>
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <label className="flex items-center justify-between cursor-pointer font-bold text-gray-800">
                  <span>Recent Tattoo or Piercing within 6 months?</span>
                  <input
                    type="checkbox"
                    checked={recentTattoo}
                    onChange={(e) => setRecentTattoo(e.target.checked)}
                    className="w-4 h-4 accent-red-600"
                  />
                </label>
              </div>

              <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <label className="flex items-center justify-between cursor-pointer font-bold text-gray-800">
                  <span>Currently Pregnant or Breastfeeding?</span>
                  <input
                    type="checkbox"
                    checked={pregnant}
                    onChange={(e) => setPregnant(e.target.checked)}
                    className="w-4 h-4 accent-red-600"
                  />
                </label>
              </div>

              <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <label className="flex items-center justify-between cursor-pointer font-bold text-gray-800">
                  <span>Body weight below 45 kg (Underweight)?</span>
                  <input
                    type="checkbox"
                    checked={underweight}
                    onChange={(e) => setUnderweight(e.target.checked)}
                    className="w-4 h-4 accent-red-600"
                  />
                </label>
              </div>

              <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <label className="flex items-center justify-between cursor-pointer font-bold text-gray-800">
                  <span>Chronic Medical Conditions / Blood Transmissible Disease?</span>
                  <input
                    type="checkbox"
                    checked={hasDisease}
                    onChange={(e) => setHasDisease(e.target.checked)}
                    className="w-4 h-4 accent-red-600"
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setPart(1)}
                className="w-1/3 py-3 border border-gray-300 text-gray-700 font-bold text-sm rounded-lg"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="w-2/3 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg shadow transition-colors"
              >
                {loading ? "Saving Profile..." : "Complete Profile & Register"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}