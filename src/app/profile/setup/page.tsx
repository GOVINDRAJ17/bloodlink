"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPreciseLiveLocation } from "@/lib/geo/location";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function ProfileSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string>("");
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"DONOR" | "HOSPITAL" | "BLOOD_BANK">("DONOR");
  
  // Donor fields
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [available, setAvailable] = useState(true);

  // Hospital / Blood Bank common fields
  const [hospitalName, setHospitalName] = useState("");
  const [bloodBankName, setBloodBankName] = useState("");
  const [address, setAddress] = useState("");

  // Location coordinates
  const [location, setLocation] = useState<{ lat: number; lng: number }>({ lat: 20.5937, lng: 78.9629 });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        setFetchingProfile(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);
          setFullName(user.user_metadata?.full_name || user.user_metadata?.name || "");

          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profile) {
            if (profile.full_name) setFullName(profile.full_name);
            if (profile.phone) setPhone(profile.phone);
            if (profile.role && profile.role !== "ADMIN") setRole(profile.role as any);
          }
        } else {
          // Dev Mode / Fallback local user ID
          setUserId(`usr_local_${Date.now()}`);
        }
      } catch (err) {
        console.warn("Error loading user profile, using fallback session:", err);
        setUserId(`usr_local_${Date.now()}`);
      } finally {
        setFetchingProfile(false);
      }
    }
    loadUser();
  }, []);

  const handleDetectLocation = async () => {
    try {
      setLocating(true);
      const loc = await getPreciseLiveLocation();
      setLocation({ lat: loc.lat, lng: loc.lng });
      if (loc.address && !address) {
        setAddress(loc.address);
      }
    } catch (err: any) {
      alert(`Location Error: ${err.message || "Could not detect live location"}`);
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // 1. Client Field Validations
    if (!fullName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter a valid contact phone number");
      return;
    }

    if (role === "HOSPITAL" && !hospitalName.trim()) {
      setError("Please enter your hospital name");
      return;
    }

    if (role === "BLOOD_BANK" && !bloodBankName.trim()) {
      setError("Please enter your blood bank name");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const activeUserId = userId || `usr_${Date.now()}`;
      const pointWkt = `POINT(${location.lng} ${location.lat})`;

      // 2. Persist to primary profiles table
      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert({
          id: activeUserId,
          full_name: fullName.trim(),
          phone: phone.trim(),
          role,
          is_profile_complete: true,
          updated_at: new Date().toISOString()
        });

      if (profileErr && !profileErr.message.includes("fetch")) {
        console.warn("Primary profile update warning:", profileErr);
      }

      // 3. Persist to role-specific profile table
      if (role === "DONOR") {
        await supabase
          .from("donor_profiles")
          .upsert({
            user_id: activeUserId,
            blood_group: bloodGroup,
            available,
            location: pointWkt,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });
      } else if (role === "HOSPITAL") {
        await supabase
          .from("hospital_profiles")
          .upsert({
            user_id: activeUserId,
            hospital_name: hospitalName.trim(),
            phone: phone.trim(),
            address: address.trim() || "Local Address",
            location: pointWkt,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });
      } else if (role === "BLOOD_BANK") {
        await supabase
          .from("blood_bank_profiles")
          .upsert({
            user_id: activeUserId,
            blood_bank_name: bloodBankName.trim(),
            phone: phone.trim(),
            address: address.trim() || "Local Address",
            location: pointWkt,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });
      }

      // Store local completion state for instant recognition
      if (typeof window !== "undefined") {
        localStorage.setItem("bloodlink_profile_completed", "true");
        localStorage.setItem("bloodlink_user_role", role);
      }

      // 4. Navigate to dashboard
      const targetRole = role.toLowerCase() === "blood_bank" ? "blood-bank" : role.toLowerCase();
      router.push(`/dashboard/${targetRole}`);

    } catch (err: any) {
      console.error("Profile setup error:", err);
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetchingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-xs text-secondary-var bg-[#F6F7F5] dark:bg-[#101720]">
        Loading Profile Setup...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-[#F6F7F5] dark:bg-[#101720] transition-colors duration-200">
      <div className="card-surface p-8 md:p-10 rounded-2xl border shadow-xl max-w-xl w-full space-y-6 bg-white dark:bg-[#182233] border-[#E2E4E1] dark:border-[#2A3547]">
        
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-black text-[#0F766E] dark:text-[#6FD6BC] uppercase tracking-wider">
            Mandatory Registration Step
          </span>
          <h1 className="font-heading text-2xl font-extrabold text-[#14213D] dark:text-[#F6F7F5]">
            Complete Your BloodLink Profile
          </h1>
          <p className="text-xs text-[#5B6472] dark:text-[#9AA5B4]">
            Setup your emergency role, contact details, and location coordinates to start dispatching or matching blood requests.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-[#D62828]/10 text-[#D62828] border border-[#D62828]/30 rounded-xl text-xs font-mono font-bold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Role Selection Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold uppercase text-[#5B6472] dark:text-[#9AA5B4]">
              Select Your Operating Role *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["DONOR", "HOSPITAL", "BLOOD_BANK"] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-mono font-bold border transition-all ${
                    role === r
                      ? "bg-[#14213D] text-white border-[#14213D]"
                      : "bg-[#F6F7F5] dark:bg-[#101720] text-[#5B6472] dark:text-[#9AA5B4] border-[#E2E4E1] dark:border-[#2A3547] hover:border-[#14213D]"
                  }`}
                >
                  {r === "BLOOD_BANK" ? "BLOOD BANK" : r}
                </button>
              ))}
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold uppercase text-[#5B6472] dark:text-[#9AA5B4]">
              Full Name / Entity Contact Person *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Rajesh Kumar / Ananya Sharma"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] text-[#14213D] dark:text-[#F6F7F5] text-xs focus:outline-none focus:border-[#0F766E]"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold uppercase text-[#5B6472] dark:text-[#9AA5B4]">
              Emergency Contact Phone Number *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] text-[#14213D] dark:text-[#F6F7F5] text-xs focus:outline-none focus:border-[#0F766E]"
            />
          </div>

          {/* Role-Specific Fields */}
          {role === "DONOR" && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-[#5B6472] dark:text-[#9AA5B4]">
                  Blood Group *
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] text-[#14213D] dark:text-[#F6F7F5] text-xs font-mono font-bold focus:outline-none focus:border-[#0F766E]"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={available}
                    onChange={(e) => setAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E]"
                  />
                  <span className="text-xs font-mono font-bold text-[#14213D] dark:text-[#F6F7F5]">
                    Available for Alerts
                  </span>
                </label>
              </div>
            </div>
          )}

          {role === "HOSPITAL" && (
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-mono font-bold uppercase text-[#5B6472] dark:text-[#9AA5B4]">
                Official Hospital Name *
              </label>
              <input
                type="text"
                required
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="e.g. City General Hospital & Trauma Center"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] text-[#14213D] dark:text-[#F6F7F5] text-xs focus:outline-none focus:border-[#0F766E]"
              />
            </div>
          )}

          {role === "BLOOD_BANK" && (
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-mono font-bold uppercase text-[#5B6472] dark:text-[#9AA5B4]">
                Blood Bank / Storage Facility Name *
              </label>
              <input
                type="text"
                required
                value={bloodBankName}
                onChange={(e) => setBloodBankName(e.target.value)}
                placeholder="e.g. Regional Metro Blood Storage Facility"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] text-[#14213D] dark:text-[#F6F7F5] text-xs focus:outline-none focus:border-[#0F766E]"
              />
            </div>
          )}

          {/* Address / Location Detection */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase text-[#5B6472] dark:text-[#9AA5B4]">
                Street Address / Location
              </label>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={locating}
                className="text-[11px] font-mono font-bold text-[#0F766E] dark:text-[#6FD6BC] hover:underline"
              >
                {locating ? "Detecting GPS..." : "📍 Detect Live Location"}
              </button>
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Gate 2, Medical College Road, Central District"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] text-[#14213D] dark:text-[#F6F7F5] text-xs focus:outline-none focus:border-[#0F766E]"
            />
            <span className="text-[10px] font-mono text-[#5B6472] dark:text-[#9AA5B4] block">
              Coordinates: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#D62828] hover:bg-red-700 text-white font-heading font-extrabold text-sm rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
          >
            <span>{loading ? "Saving Profile..." : "Save & Continue to Dashboard →"}</span>
          </button>

        </form>

      </div>
    </div>
  );
}
