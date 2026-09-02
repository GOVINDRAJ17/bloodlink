"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface UserProfileState {
  fullName: string;
  email: string;
  phone: string;
  role: "DONOR" | "HOSPITAL" | "BLOOD_BANK";
  
  // Donor fields
  bloodGroup: string;
  lastDonationDate: string;
  totalDonations: number;
  available: boolean;
  weightKg: string;
  hemoglobin: string;
  city: string;
  
  // Hospital fields
  hospitalName: string;
  licenseNumber: string;
  traumaLevel: string;
  icuBeds: string;
  emergencyPhone: string;
  hospitalAddress: string;

  // Blood Bank fields
  bloodBankName: string;
  drugLicense: string;
  storageCapacityUnits: string;
  hasPlateletAgitator: boolean;
  hasDeepFreezer: boolean;
  operatingHours: string;
  bankPhone: string;
  bankAddress: string;
}

const STORAGE_KEY = "bloodlink_user_profile_v2";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        localStorage.removeItem("bloodlink_user_phone");
        localStorage.removeItem("bloodlink_profile_completed");
      }
      router.push("/auth/login");
    } catch (err) {
      console.error("Sign out error:", err);
      router.push("/auth/login");
    } finally {
      setSigningOut(false);
    }
  };

  // Clean, 100% user-input driven state
  const [profile, setProfile] = useState<UserProfileState>({
    fullName: "",
    email: "",
    phone: "",
    role: "DONOR",
    bloodGroup: "O+",
    lastDonationDate: "",
    totalDonations: 0,
    available: true,
    weightKg: "",
    hemoglobin: "",
    city: "",
    hospitalName: "",
    licenseNumber: "",
    traumaLevel: "Level 1 Emergency Center",
    icuBeds: "",
    emergencyPhone: "",
    hospitalAddress: "",
    bloodBankName: "",
    drugLicense: "",
    storageCapacityUnits: "",
    hasPlateletAgitator: true,
    hasDeepFreezer: true,
    operatingHours: "24/7 Operations",
    bankPhone: "",
    bankAddress: ""
  });

  // Load user data on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // 1. First check LocalStorage for fast instant retrieval
        const localSaved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        let loadedState: Partial<UserProfileState> = {};
        if (localSaved) {
          try {
            loadedState = JSON.parse(localSaved);
          } catch (e) {
            console.warn("Could not parse local profile storage", e);
          }
        }

        // 2. Check Supabase Auth user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          loadedState.email = user.email || loadedState.email || "";
          if (user.user_metadata?.full_name && !loadedState.fullName) {
            loadedState.fullName = user.user_metadata.full_name;
          }

          // 3. Query Supabase database profile if available
          try {
            const { data: dbProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .single();

            if (dbProfile) {
              if (dbProfile.full_name) loadedState.fullName = dbProfile.full_name;
              if (dbProfile.phone) loadedState.phone = dbProfile.phone;
              if (dbProfile.role) loadedState.role = dbProfile.role as any;
            }

            if (dbProfile?.role === "DONOR" || loadedState.role === "DONOR") {
              const { data: donorDb } = await supabase
                .from("donor_profiles")
                .select("*")
                .eq("user_id", user.id)
                .single();
              if (donorDb) {
                if (donorDb.blood_group) loadedState.bloodGroup = donorDb.blood_group;
                if (donorDb.available !== undefined) loadedState.available = donorDb.available;
                if (donorDb.last_donation_date) loadedState.lastDonationDate = donorDb.last_donation_date;
                if (donorDb.total_donations !== undefined) loadedState.totalDonations = donorDb.total_donations;
              }
            }
          } catch (e) {
            // silent fallback
          }
        }

        setProfile((prev) => ({
          ...prev,
          ...loadedState
        }));

      } catch (err) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Cooldown calculation purely derived from user's entered lastDonationDate
  const calculateCooldown = (lastDateStr: string) => {
    if (!lastDateStr) {
      return {
        hasDonatedBefore: false,
        eligible: true,
        daysSince: null,
        daysRemaining: 0,
        progress: 100,
        nextEligibleDate: "Ready to donate anytime"
      };
    }

    const lastDate = new Date(lastDateStr);
    const now = new Date();
    const diffTime = now.getTime() - lastDate.getTime();
    const daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Future date guard
    if (daysSince < 0) {
      return {
        hasDonatedBefore: true,
        eligible: false,
        daysSince: 0,
        daysRemaining: 90,
        progress: 0,
        nextEligibleDate: "Future date entered"
      };
    }

    const COOLDOWN_DAYS = 90;
    const daysRemaining = Math.max(0, COOLDOWN_DAYS - daysSince);
    const progress = Math.min(100, Math.round((daysSince / COOLDOWN_DAYS) * 100));
    const eligible = daysSince >= COOLDOWN_DAYS;

    const nextEligibleDate = new Date(lastDate.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

    return {
      hasDonatedBefore: true,
      eligible,
      daysSince,
      daysRemaining,
      progress,
      nextEligibleDate: nextEligibleDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    };
  };

  const cooldown = calculateCooldown(profile.lastDonationDate);

  const handleFieldChange = (field: keyof UserProfileState, value: any) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage("");

    try {
      // 1. Persist immediately to LocalStorage so it NEVER gets lost
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        localStorage.setItem("bloodlink_user_phone", profile.phone);
        localStorage.setItem("bloodlink_user_name", profile.fullName);
        localStorage.setItem("bloodlink_user_role", profile.role);
      }

      // 2. Persist to Supabase if connected
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: profile.fullName.trim(),
          phone: profile.phone.trim(),
          role: profile.role,
          is_profile_complete: true,
          updated_at: new Date().toISOString()
        });

        if (profile.role === "DONOR") {
          await supabase.from("donor_profiles").upsert({
            user_id: user.id,
            blood_group: profile.bloodGroup,
            available: profile.available,
            last_donation_date: profile.lastDonationDate || null,
            total_donations: Number(profile.totalDonations) || 0,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });
        } else if (profile.role === "HOSPITAL") {
          await supabase.from("hospital_profiles").upsert({
            user_id: user.id,
            hospital_name: profile.hospitalName.trim(),
            phone: profile.emergencyPhone.trim() || profile.phone.trim(),
            address: profile.hospitalAddress.trim(),
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });
        } else if (profile.role === "BLOOD_BANK") {
          await supabase.from("blood_bank_profiles").upsert({
            user_id: user.id,
            blood_bank_name: profile.bloodBankName.trim(),
            phone: profile.bankPhone.trim() || profile.phone.trim(),
            address: profile.bankAddress.trim(),
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });
        }
      }

      setSaveMessage("✅ Profile and contact details successfully saved!");
      setTimeout(() => setSaveMessage(""), 4000);
    } catch (err: any) {
      console.warn("Saved to local storage:", err);
      setSaveMessage("✅ Profile saved locally on this device!");
      setTimeout(() => setSaveMessage(""), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-xs text-secondary-var">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#D62828] border-t-transparent rounded-full animate-spin" />
          <span>Loading your profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      
      {/* Top Banner Navigation & Role Selection */}
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
              User Profile
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#14213D] dark:text-white tracking-tight">
            {profile.fullName || "My Profile"}
          </h1>
          <p className="text-xs md:text-sm text-[#5B6472] dark:text-[#9AA5B4]">
            Enter your personal contact info, medical details, and emergency operating parameters.
          </p>
        </div>

        {/* Role Mode Tabs */}
        <div className="flex items-center gap-1 bg-[#F6F7F5] dark:bg-[#101720] p-1.5 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] shrink-0">
          {(["DONOR", "HOSPITAL", "BLOOD_BANK"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleFieldChange("role", r)}
              className={`px-3.5 py-2 rounded-lg font-mono text-xs font-extrabold transition-all ${
                profile.role === r
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
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-2xl font-mono text-xs font-bold animate-fadeIn flex items-center justify-between shadow-sm">
          <span>{saveMessage}</span>
          <span className="text-[10px] uppercase bg-emerald-500/20 px-2 py-0.5 rounded font-mono">Saved</span>
        </div>
      )}

      {/* Main Profile Form Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN: User Contact & Identity Details */}
        <div className="space-y-6">
          
          {/* Identity & Basic Info Card */}
          <div className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-secondary-var flex items-center gap-2">
              <span>👤</span> Personal Contact Details
            </h2>

            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-[#14213D] dark:text-white uppercase block">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={profile.fullName}
                onChange={(e) => handleFieldChange("fullName", e.target.value)}
                placeholder="Enter your full name"
                className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
              />
            </div>

            {/* Phone Number Input (With Live Confirmation) */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-[#14213D] dark:text-white uppercase block">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={profile.phone}
                onChange={(e) => handleFieldChange("phone", e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
              />
              {profile.phone && (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 block mt-1">
                  📞 Active Contact: <strong>{profile.phone}</strong>
                </span>
              )}
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-[#14213D] dark:text-white uppercase block">
                Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
              />
            </div>

            {/* City / Location */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-[#14213D] dark:text-white uppercase block">
                City / District
              </label>
              <input
                type="text"
                value={profile.city}
                onChange={(e) => handleFieldChange("city", e.target.value)}
                placeholder="e.g. Mumbai, Maharashtra"
                className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
              />
            </div>

          </div>

          {/* Quick Navigation Card */}
          <div className="bg-[#14213D] text-white p-6 rounded-2xl shadow-lg space-y-4">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-white/80">
              ⚡ Quick Services
            </h2>
            <div className="space-y-2">
              <Link
                href="/search"
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono text-xs font-bold flex items-center justify-between transition-colors"
              >
                <span>🔍 Search Blood Availability</span>
                <span>→</span>
              </Link>
              <Link
                href="/requests"
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono text-xs font-bold flex items-center justify-between transition-colors"
              >
                <span>🚨 Emergency Dispatches</span>
                <span>→</span>
              </Link>
              <Link
                href="/map"
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono text-xs font-bold flex items-center justify-between transition-colors"
              >
                <span>🗺️ Facility Map</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Account Security & Sign Out Card */}
          <div className="bg-white dark:bg-[#182233] p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-secondary-var flex items-center gap-2">
              <span>🔐</span> Session & Security
            </h2>
            <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4]">
              Sign out of your active session on this device.
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full py-2.5 px-4 bg-[#E11D48]/10 hover:bg-[#E11D48] text-[#E11D48] hover:text-white border border-[#E11D48]/20 font-mono text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>🚪</span>
              <span>{signingOut ? "Signing Out..." : "Sign Out of Account"}</span>
            </button>
          </div>

        </div>

        {/* RIGHT 2 COLUMNS: Role-Specific User Inputs */}
        <div className="lg:col-span-2 space-y-6">

          {/* ================= DONOR VIEW ================= */}
          {profile.role === "DONOR" && (
            <>
              {/* 90-DAY DONATION COOLDOWN & ELIGIBILITY CALCULATOR */}
              <div className="bg-white dark:bg-[#182233] p-6 md:p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono font-extrabold uppercase text-[#D62828] bg-[#D62828]/10 px-2.5 py-1 rounded-full">
                      Live Donation Cooldown
                    </span>
                    <h2 className="text-xl font-extrabold text-[#14213D] dark:text-white mt-1">
                      90-Day Medical Eligibility Tracker
                    </h2>
                  </div>

                  <div className={`px-4 py-2 rounded-xl font-mono text-xs font-extrabold text-center shrink-0 flex items-center gap-2 ${
                    cooldown.eligible
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                  }`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${cooldown.eligible ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    {cooldown.eligible ? "ELIGIBLE TO DONATE TODAY" : `IN COOLDOWN: ${cooldown.daysRemaining} DAYS LEFT`}
                  </div>
                </div>

                {/* Progress Bar & Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-secondary-var">
                    <span>
                      {cooldown.hasDonatedBefore
                        ? `Last Donated: ${profile.lastDonationDate} (${cooldown.daysSince} days ago)`
                        : "No previous donation date recorded"}
                    </span>
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
                </div>

                {/* Date Input for Last Donation */}
                <div className="p-4 bg-[#F6F7F5] dark:bg-[#101720] rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] space-y-2">
                  <label className="text-xs font-mono font-bold text-[#14213D] dark:text-white uppercase block">
                    When did you last donate blood?
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      type="date"
                      value={profile.lastDonationDate}
                      onChange={(e) => handleFieldChange("lastDonationDate", e.target.value)}
                      className="p-2.5 bg-white dark:bg-[#182233] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
                    />
                    {profile.lastDonationDate && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange("lastDonationDate", "")}
                        className="text-xs font-mono text-red-600 hover:underline"
                      >
                        Clear date (I haven't donated recently)
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-secondary-var">
                    * Standard guidelines require 90 days between whole blood donations to ensure safe hemoglobin & iron replenishment.
                  </p>
                </div>

              </div>

              {/* MEDICAL & DONOR PARAMETERS */}
              <div className="bg-white dark:bg-[#182233] p-6 md:p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-6">
                <h2 className="text-lg font-extrabold text-[#14213D] dark:text-white flex items-center gap-2">
                  <span>🩸</span> Medical Info & Emergency Availability
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Blood Group */}
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white block">
                      Blood Group *
                    </label>
                    <select
                      value={profile.bloodGroup}
                      onChange={(e) => handleFieldChange("bloodGroup", e.target.value)}
                      className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-sm font-mono font-black focus:outline-none focus:ring-2 focus:ring-[#D62828]"
                    >
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>

                  {/* Weight */}
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white block">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={profile.weightKg}
                      onChange={(e) => handleFieldChange("weightKg", e.target.value)}
                      placeholder="e.g. 65"
                      className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
                    />
                  </div>

                  {/* Total Previous Donations */}
                  <div className="space-y-1">
                    <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white block">
                      Lifetime Donations
                    </label>
                    <input
                      type="number"
                      value={profile.totalDonations}
                      onChange={(e) => handleFieldChange("totalDonations", e.target.value)}
                      placeholder="e.g. 3"
                      className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D62828]"
                    />
                  </div>
                </div>

                {/* Emergency Availability Toggle */}
                <div className="p-4 bg-[#D62828]/5 border border-[#D62828]/20 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${profile.available ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                      <span className="font-mono text-xs font-extrabold text-[#14213D] dark:text-white">
                        Emergency Donor Dispatch Alerts
                      </span>
                    </div>
                    <p className="text-[11px] text-secondary-var mt-0.5">
                      Receive instant SMS / Email notifications when a patient nearby needs your blood type.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFieldChange("available", !profile.available)}
                    className={`px-4 py-2 rounded-xl font-mono text-xs font-extrabold transition-all shrink-0 ${
                      profile.available
                        ? "bg-[#0F766E] text-white shadow-sm"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {profile.available ? "ACTIVE / READY" : "PAUSED"}
                  </button>
                </div>

              </div>
            </>
          )}

          {/* ================= HOSPITAL VIEW ================= */}
          {profile.role === "HOSPITAL" && (
            <div className="bg-white dark:bg-[#182233] p-6 md:p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-6">
              <h2 className="text-xl font-extrabold text-[#14213D] dark:text-white flex items-center gap-2">
                <span>🏥</span> Hospital Profile & Emergency Infrastructure
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                    Hospital Name *
                  </label>
                  <input
                    type="text"
                    value={profile.hospitalName}
                    onChange={(e) => handleFieldChange("hospitalName", e.target.value)}
                    placeholder="e.g. City General Hospital"
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                    NABH / Medical License Number
                  </label>
                  <input
                    type="text"
                    value={profile.licenseNumber}
                    onChange={(e) => handleFieldChange("licenseNumber", e.target.value)}
                    placeholder="e.g. NABH-2026-9912"
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                    Emergency Blood Helpline Phone
                  </label>
                  <input
                    type="tel"
                    value={profile.emergencyPhone}
                    onChange={(e) => handleFieldChange("emergencyPhone", e.target.value)}
                    placeholder="e.g. +91 22 24567890"
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                    Trauma Care Level
                  </label>
                  <input
                    type="text"
                    value={profile.traumaLevel}
                    onChange={(e) => handleFieldChange("traumaLevel", e.target.value)}
                    placeholder="e.g. Level 1 Trauma Center"
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                  Hospital Street Address & Ward
                </label>
                <input
                  type="text"
                  value={profile.hospitalAddress}
                  onChange={(e) => handleFieldChange("hospitalAddress", e.target.value)}
                  placeholder="e.g. Central Avenue, Near Railway Station"
                  className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* ================= BLOOD BANK VIEW ================= */}
          {profile.role === "BLOOD_BANK" && (
            <div className="bg-white dark:bg-[#182233] p-6 md:p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-sm space-y-6">
              <h2 className="text-xl font-extrabold text-[#14213D] dark:text-white flex items-center gap-2">
                <span>🩸</span> Blood Bank Details & License Info
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                    Blood Bank Registered Name *
                  </label>
                  <input
                    type="text"
                    value={profile.bloodBankName}
                    onChange={(e) => handleFieldChange("bloodBankName", e.target.value)}
                    placeholder="e.g. Red Cross Blood Storage Center"
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                    FDA Drug Controller License No.
                  </label>
                  <input
                    type="text"
                    value={profile.drugLicense}
                    onChange={(e) => handleFieldChange("drugLicense", e.target.value)}
                    placeholder="e.g. FDA-DL-99420-B"
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                    Emergency Helpline Phone
                  </label>
                  <input
                    type="tel"
                    value={profile.bankPhone}
                    onChange={(e) => handleFieldChange("bankPhone", e.target.value)}
                    placeholder="e.g. +91 22 28901234"
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                    Storage Capacity (Units)
                  </label>
                  <input
                    type="number"
                    value={profile.storageCapacityUnits}
                    onChange={(e) => handleFieldChange("storageCapacityUnits", e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono uppercase font-bold text-[#14213D] dark:text-white">
                  Blood Bank Address
                </label>
                <input
                  type="text"
                  value={profile.bankAddress}
                  onChange={(e) => handleFieldChange("bankAddress", e.target.value)}
                  placeholder="e.g. Complex Gate 2, City Center"
                  className="w-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] text-[#14213D] dark:text-white p-3 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3.5 bg-[#D62828] hover:bg-[#b01f1f] text-white font-mono font-extrabold text-xs rounded-xl shadow-lg shadow-[#D62828]/20 transition-all flex items-center gap-2"
            >
              <span>💾</span>
              <span>{saving ? "Saving Changes..." : "Save Profile Details"}</span>
            </button>
          </div>

        </div>

      </form>

    </div>
  );
}
