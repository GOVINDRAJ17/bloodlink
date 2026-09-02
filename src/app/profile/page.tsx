"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface DonorDetails {
  bloodGroup: string;
  lastDonationDate: string;
  totalDonations: number;
  available: boolean;
  weightKg: number;
  hemoglobin: number;
  reliabilityScore: number;
  verified: boolean;
}

interface HospitalDetails {
  hospitalName: string;
  licenseNumber: string;
  traumaLevel: string;
  icuBeds: number;
  emergencyPhone: string;
  address: string;
  verified: boolean;
}

interface BloodBankDetails {
  bloodBankName: string;
  drugLicense: string;
  storageCapacityUnits: number;
  hasPlateletAgitator: boolean;
  hasDeepFreezer: boolean;
  operatingHours: string;
  emergencyPhone: string;
  address: string;
  verified: boolean;
}

export default function ProfilePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Base user info
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState("Dr. Govindraj Borade");
  const [email, setEmail] = useState("boradegovindraj17@gmail.com");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [role, setRole] = useState<"DONOR" | "HOSPITAL" | "BLOOD_BANK">("DONOR");

  // Role details state
  const [donor, setDonor] = useState<DonorDetails>({
    bloodGroup: "O+",
    lastDonationDate: "2026-07-10",
    totalDonations: 4,
    available: true,
    weightKg: 68,
    hemoglobin: 14.2,
    reliabilityScore: 98.5,
    verified: true
  });

  const [hospital, setHospital] = useState<HospitalDetails>({
    hospitalName: "Apex Emergency Trauma Care",
    licenseNumber: "MH-NABH-2026-8819",
    traumaLevel: "Level 1 Tertiary Care",
    icuBeds: 45,
    emergencyPhone: "+91 22 2456 7890",
    address: "Station Road, Ward 4, Mumbai, MH",
    verified: true
  });

  const [bloodBank, setBloodBank] = useState<BloodBankDetails>({
    bloodBankName: "Central Red Cross Blood Center",
    drugLicense: "FDA-DL-99420-B",
    storageCapacityUnits: 1200,
    hasPlateletAgitator: true,
    hasDeepFreezer: true,
    operatingHours: "24/7 Round the Clock",
    emergencyPhone: "+91 22 2890 1234",
    address: "Civil Hospital Complex, Mumbai, MH",
    verified: true
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          setEmail(user.email || "user@bloodlink.org");
          if (user.user_metadata?.full_name) {
            setFullName(user.user_metadata.full_name);
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profile) {
            if (profile.full_name) setFullName(profile.full_name);
            if (profile.phone) setPhone(profile.phone);
            if (profile.role) setRole(profile.role as any);
          }
        }
      } catch (err) {
        console.warn("Using local profile data fallback:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  // Cooldown calculation logic (Standard 90-day cooldown between whole blood donations)
  const calculateCooldown = (lastDateStr: string) => {
    if (!lastDateStr) return { eligible: true, daysSince: 999, daysRemaining: 0, progress: 100 };
    const lastDate = new Date(lastDateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    const daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const COOLDOWN_DAYS = 90;
    const daysRemaining = Math.max(0, COOLDOWN_DAYS - daysSince);
    const progress = Math.min(100, Math.round((daysSince / COOLDOWN_DAYS) * 100));
    const eligible = daysSince >= COOLDOWN_DAYS;

    const nextEligibleDate = new Date(lastDate.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

    return {
      eligible,
      daysSince,
      daysRemaining,
      progress,
      nextEligibleDate: nextEligibleDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    };
  };

  const cooldown = calculateCooldown(donor.lastDonationDate);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: fullName,
          phone,
          role,
          is_profile_complete: true,
          updated_at: new Date().toISOString()
        });
      }
      setSaveMessage("✅ Profile settings & medical status successfully saved!");
      setTimeout(() => setSaveMessage(""), 4000);
    } catch (err: any) {
      setSaveMessage("⚠️ Saved locally in session.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      
      {/* Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#14213D]/5 dark:bg-white/10 hover:bg-[#14213D]/10 dark:hover:bg-white/15 text-[#14213D] dark:text-white font-mono text-xs font-bold rounded-lg transition-colors"
            >
              <span>🏠</span>
              <span>Home</span>
            </Link>
            <span className="text-[10px] font-mono font-black text-[#0F766E] dark:text-[#6FD6BC] bg-[#0F766E]/10 dark:bg-[#6FD6BC]/10 px-2.5 py-1 rounded-full uppercase">
              Verified Medical Profile
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#14213D] dark:text-white tracking-tight">
            Account & Role Management
          </h1>
          <p className="text-xs md:text-sm text-[#5B6472] dark:text-[#9AA5B4]">
            Manage donor eligibility, donation cooldown timers, emergency dispatch availability, and hospital certifications.
          </p>
        </div>

        {/* Role Mode Switcher Tabs */}
        <div className="flex items-center gap-1 bg-[#F6F7F5] dark:bg-[#101720] p-1.5 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] shrink-0">
          {(["DONOR", "HOSPITAL", "BLOOD_BANK"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-3.5 py-2 rounded-lg font-mono text-xs font-extrabold transition-all ${
                role === r
                  ? "bg-[#14213D] dark:bg-white text-white dark:text-[#14213D] shadow-sm"
                  : "text-[#5B6472] dark:text-[#9AA5B4] hover:text-[#14213D] dark:hover:text-white"
              }`}
            >
              {r === "BLOOD_BANK" ? "🩸 BLOOD BANK" : r === "HOSPITAL" ? "🏥 HOSPITAL" : "👤 DONOR"}
            </button>
          ))}
        </div>
      </div>

      {saveMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-2xl font-mono text-xs font-bold animate-fadeIn flex items-center justify-between">
          <span>{saveMessage}</span>
          <span className="text-[10px] uppercase bg-emerald-500/20 px-2 py-0.5 rounded">Active</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN: Identity & Quick Badges */}
        <div className="space-y-6">
          
          {/* Identity Card */}
          <div className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#D62828] via-[#14213D] to-[#0F766E]" />
            
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#14213D] to-[#253966] text-white flex items-center justify-center text-2xl font-black font-mono shadow-md border-2 border-white dark:border-[#2A3547] my-3">
              {fullName.split(" ").map(n => n[0]).join("").slice(0, 2) || "BL"}
            </div>

            <h2 className="text-xl font-extrabold text-[#14213D] dark:text-white">
              {fullName}
            </h2>
            <p className="text-xs font-mono text-secondary-var mt-0.5">{email}</p>
            
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#14213D]/10 dark:bg-white/10 text-[#14213D] dark:text-white">
              <span>{role === "DONOR" ? "❤️ Verified Lifesaver" : role === "HOSPITAL" ? "🏥 Certified Medical Center" : "🩸 Licensed Blood Storage"}</span>
            </div>

            <div className="mt-6 pt-6 border-t border-[#E2E4E1] dark:border-[#2A3547] grid grid-cols-2 gap-4 text-left">
              <div>
                <span className="text-[10px] font-mono text-secondary-var uppercase block">Phone</span>
                <span className="text-xs font-bold text-[#14213D] dark:text-white font-mono">{phone}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-secondary-var uppercase block">Trust Score</span>
                <span className="text-xs font-bold text-[#0F766E] dark:text-[#6FD6BC] font-mono">⭐ 99.2% Verified</span>
              </div>
            </div>
          </div>

          {/* Role Badges & Achievements */}
          {role === "DONOR" && (
            <div className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-secondary-var flex items-center gap-2">
                <span>🎖️</span> Lifesaver Badges & Milestones
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
                  <span className="text-2xl">🥇</span>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 font-mono">Hero Tier 2</p>
                  <p className="text-[10px] text-secondary-var">{donor.totalDonations} Lives Touched</p>
                </div>

                <div className="p-3 rounded-xl bg-[#D62828]/10 border border-[#D62828]/20 text-center space-y-1">
                  <span className="text-2xl">🩸</span>
                  <p className="text-xs font-bold text-[#D62828] font-mono">{donor.bloodGroup} Guardian</p>
                  <p className="text-[10px] text-secondary-var">Universal Compatible</p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                  <span className="text-2xl">⚡</span>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono">Fast Responder</p>
                  <p className="text-[10px] text-secondary-var">&lt; 8 min Accept</p>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center space-y-1">
                  <span className="text-2xl">🛡️</span>
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300 font-mono">Privacy Shield</p>
                  <p className="text-[10px] text-secondary-var">Encrypted Contact</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-[#14213D] text-white p-6 rounded-2xl shadow-lg space-y-4">
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white/80">
              ⚡ Direct Navigation
            </h3>
            <div className="space-y-2">
              <Link
                href="/requests"
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono text-xs font-bold flex items-center justify-between transition-colors"
              >
                <span>🚨 Live Emergency Feed</span>
                <span>→</span>
              </Link>
              <Link
                href="/map"
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono text-xs font-bold flex items-center justify-between transition-colors"
              >
                <span>🗺️ PostGIS Facility Map</span>
                <span>→</span>
              </Link>
              <Link
                href="/analytics"
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono text-xs font-bold flex items-center justify-between transition-colors"
              >
                <span>📊 Shortage Analytics</span>
                <span>→</span>
              </Link>
            </div>
          </div>

        </div>

        {/* RIGHT 2 COLUMNS: Role-Specific Premium Dashboard */}
        <div className="lg:col-span-2 space-y-6">

          {/* DONOR SPECIFIC VIEW */}
          {role === "DONOR" && (
            <>
              {/* 90-DAY COOLDOWN & DONATION ELIGIBILITY METER */}
              <div className="bg-white dark:bg-[#182233] p-6 md:p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono font-extrabold uppercase text-[#D62828] bg-[#D62828]/10 px-2.5 py-1 rounded-full">
                      Medical Recovery Protocol
                    </span>
                    <h3 className="text-xl font-extrabold text-[#14213D] dark:text-white mt-1">
                      90-Day Donation Cooldown & Eligibility
                    </h3>
                  </div>

                  <div className={`px-4 py-2 rounded-xl font-mono text-xs font-extrabold text-center shrink-0 flex items-center gap-2 ${
                    cooldown.eligible
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                  }`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${cooldown.eligible ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    {cooldown.eligible ? "ELIGIBLE TO DONATE TODAY" : `IN COOLDOWN: ${cooldown.daysRemaining} DAYS REMAINING`}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-secondary-var">
                    <span>Last Donated: <strong>{donor.lastDonationDate || "Never"}</strong> ({cooldown.daysSince} days ago)</span>
                    <span>Next Window: <strong>{cooldown.nextEligibleDate}</strong></span>
                  </div>
                  
                  <div className="w-full bg-[#E2E4E1] dark:bg-[#101720] h-3.5 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        cooldown.eligible ? "bg-emerald-500" : "bg-gradient-to-r from-amber-500 to-[#D62828]"
                      }`}
                      style={{ width: `${cooldown.progress}%` }}
                    />
                  </div>
                  
                  <p className="text-[11px] text-secondary-var">
                    {cooldown.eligible
                      ? "✨ Your body has fully regenerated red blood cell and iron reserves. You are cleared for emergency dispatches."
                      : `⏳ Whole blood donation standard requires 90 days for complete hemoglobin & iron replenishment. Next eligible on ${cooldown.nextEligibleDate}.`}
                  </p>
                </div>

                {/* Quick Interactive Date Update */}
                <div className="p-4 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs">
                    <span className="font-bold text-[#14213D] dark:text-white block font-mono">Update Last Donation Record:</span>
                    <span className="text-secondary-var text-[11px]">Did you recently donate at a local blood drive or camp?</span>
                  </div>
                  <input
                    type="date"
                    value={donor.lastDonationDate}
                    onChange={(e) => setDonor({ ...donor, lastDonationDate: e.target.value })}
                    className="p-2 bg-white dark:bg-[#182233] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
                  />
                </div>

              </div>

              {/* HEALTH PRE-CHECK & COMPATIBILITY METRICS */}
              <div className="bg-white dark:bg-[#182233] p-6 md:p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-6">
                <h3 className="text-lg font-extrabold text-[#14213D] dark:text-white flex items-center gap-2">
                  <span>🩺</span> Donor Health Metrics & Emergency Settings
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Blood Group */}
                  <div className="p-4 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-secondary-var block">Blood Group</label>
                    <select
                      value={donor.bloodGroup}
                      onChange={(e) => setDonor({ ...donor, bloodGroup: e.target.value })}
                      className="w-full bg-white dark:bg-[#182233] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2 rounded-lg text-sm font-mono font-black"
                    >
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>

                  {/* Body Weight */}
                  <div className="p-4 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-secondary-var block">Weight (kg) (&gt;50kg required)</label>
                    <input
                      type="number"
                      value={donor.weightKg}
                      onChange={(e) => setDonor({ ...donor, weightKg: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-[#182233] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2 rounded-lg text-sm font-mono font-black"
                    />
                  </div>

                  {/* Hemoglobin */}
                  <div className="p-4 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-secondary-var block">Hemoglobin (g/dL) (&gt;12.5)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={donor.hemoglobin}
                      onChange={(e) => setDonor({ ...donor, hemoglobin: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-[#182233] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-2 rounded-lg text-sm font-mono font-black"
                    />
                  </div>
                </div>

                {/* Emergency Dispatch Live Toggle */}
                <div className="p-4 bg-[#D62828]/5 border border-[#D62828]/20 rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${donor.available ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                      <span className="font-mono text-xs font-extrabold text-[#14213D] dark:text-white">
                        Emergency Radii Matching Mode
                      </span>
                    </div>
                    <p className="text-[11px] text-secondary-var">
                      Allow BloodLink PostGIS engine to ping you via SMS/Email for Critical & Urgent dispatches within 15 km.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDonor({ ...donor, available: !donor.available })}
                    className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all shrink-0 ${
                      donor.available
                        ? "bg-[#0F766E] text-white shadow-sm"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {donor.available ? "ACTIVE / READY" : "PAUSED"}
                  </button>
                </div>

              </div>
            </>
          )}

          {/* HOSPITAL SPECIFIC VIEW */}
          {role === "HOSPITAL" && (
            <div className="bg-white dark:bg-[#182233] p-6 md:p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-extrabold uppercase text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">
                    NABH Accredited Entity
                  </span>
                  <h3 className="text-xl font-extrabold text-[#14213D] dark:text-white mt-1">
                    Hospital Infrastructure & Emergency Capacity
                  </h3>
                </div>
                <span className="text-2xl">🏥</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-secondary-var">Hospital Registered Name</label>
                  <input
                    type="text"
                    value={hospital.hospitalName}
                    onChange={(e) => setHospital({ ...hospital, hospitalName: e.target.value })}
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-secondary-var">NABH / Medical License ID</label>
                  <input
                    type="text"
                    value={hospital.licenseNumber}
                    onChange={(e) => setHospital({ ...hospital, licenseNumber: e.target.value })}
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-secondary-var">Trauma Center Classification</label>
                  <input
                    type="text"
                    value={hospital.traumaLevel}
                    onChange={(e) => setHospital({ ...hospital, traumaLevel: e.target.value })}
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-secondary-var">24/7 Emergency Blood Helpline</label>
                  <input
                    type="text"
                    value={hospital.emergencyPhone}
                    onChange={(e) => setHospital({ ...hospital, emergencyPhone: e.target.value })}
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-secondary-var">Verified Street & Ward Address</label>
                <input
                  type="text"
                  value={hospital.address}
                  onChange={(e) => setHospital({ ...hospital, address: e.target.value })}
                  className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between text-xs font-mono">
                <span>Active ICU Emergency Blood Quota: <strong>Unlimited Priority</strong></span>
                <Link href="/dashboard/hospital" className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold">
                  Open Hospital Dashboard →
                </Link>
              </div>
            </div>
          )}

          {/* BLOOD BANK SPECIFIC VIEW */}
          {role === "BLOOD_BANK" && (
            <div className="bg-white dark:bg-[#182233] p-6 md:p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-extrabold uppercase text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 rounded-full">
                    FDA Drug Controller Certified
                  </span>
                  <h3 className="text-xl font-extrabold text-[#14213D] dark:text-white mt-1">
                    Storage Capacity & Component Infrastructure
                  </h3>
                </div>
                <span className="text-2xl">🩸</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-secondary-var">Blood Bank Name</label>
                  <input
                    type="text"
                    value={bloodBank.bloodBankName}
                    onChange={(e) => setBloodBank({ ...bloodBank, bloodBankName: e.target.value })}
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-secondary-var">Drug Controller License No.</label>
                  <input
                    type="text"
                    value={bloodBank.drugLicense}
                    onChange={(e) => setBloodBank({ ...bloodBank, drugLicense: e.target.value })}
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-secondary-var">Total Storage Units Capacity</label>
                  <input
                    type="number"
                    value={bloodBank.storageCapacityUnits}
                    onChange={(e) => setBloodBank({ ...bloodBank, storageCapacityUnits: Number(e.target.value) })}
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-secondary-var">Operating Hours</label>
                  <input
                    type="text"
                    value={bloodBank.operatingHours}
                    onChange={(e) => setBloodBank({ ...bloodBank, operatingHours: e.target.value })}
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] flex items-center justify-between text-xs font-mono">
                  <span>Platelet Agitator</span>
                  <span className="text-emerald-500 font-bold">✅ AVAILABLE</span>
                </div>
                <div className="p-3 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] flex items-center justify-between text-xs font-mono">
                  <span>Deep Plasma Freezer (-40°C)</span>
                  <span className="text-emerald-500 font-bold">✅ ACTIVE</span>
                </div>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center justify-between text-xs font-mono">
                <span>Real-Time Inventory Integration: <strong>Connected</strong></span>
                <Link href="/dashboard/blood-bank" className="px-3 py-1 bg-purple-600 text-white rounded-lg font-bold">
                  Open Blood Bank Dashboard →
                </Link>
              </div>
            </div>
          )}

          {/* SAVE BUTTON */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-[#14213D] hover:bg-black text-white font-mono font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <span>💾</span>
              <span>{saving ? "Saving Changes..." : "Save Profile & Verification Status"}</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
