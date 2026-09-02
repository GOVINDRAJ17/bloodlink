"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { UrgencyBadge, MonoData } from "@/app/components/ui/Badge";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

export default function DonorDashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [donorProfile, setDonorProfile] = useState<any>(null);
  const [assignedResponses, setAssignedResponses] = useState<any[]>([]);
  const [available, setAvailable] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const { notifications } = useRealtimeNotifications(userId || undefined);

  const fetchDonorData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Fetch donor profile
      const { data: donor } = await supabase
        .from("donor_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (donor) {
        setDonorProfile(donor);
        setAvailable(donor.available ?? true);

        // Fetch assigned/notified emergency responses for this donor
        const { data: responses } = await supabase
          .from("donor_responses")
          .select("*, blood_requests(*, hospital_profiles(hospital_name, address, phone))")
          .eq("donor_id", donor.id)
          .order("created_at", { ascending: false });

        if (responses) {
          setAssignedResponses(responses);
        }
      }
    } catch (err) {
      console.error("Error loading donor portal:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonorData();
  }, []);

  const handleToggleAvailability = async () => {
    if (!donorProfile) return;
    try {
      setUpdating(true);
      const nextState = !available;

      const { error } = await supabase
        .from("donor_profiles")
        .update({ available: nextState, updated_at: new Date().toISOString() })
        .eq("id", donorProfile.id);

      if (!error) {
        setAvailable(nextState);
      }
    } catch (err) {
      alert("Failed to update availability");
    } finally {
      setUpdating(false);
    }
  };

  const handleRespondMatch = async (matchId: string, action: "ACCEPT" | "REJECT") => {
    try {
      const res = await fetch(`/api/matches/${matchId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        await fetchDonorData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to respond");
      }
    } catch (err) {
      alert("Error responding to emergency request");
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto p-10 text-center font-mono text-xs text-secondary-var">Loading Supabase Donor Portal...</div>;
  }

  const bloodGroup = donorProfile?.blood_group || "O+";
  const lastDonationDate = donorProfile?.last_donation_date;
  const isEligible = !lastDonationDate || (Date.now() - new Date(lastDonationDate).getTime()) / (1000 * 60 * 60 * 24) >= 90;

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      
      {/* Hero Availability Control (Ink Shell) */}
      <div className={`p-8 rounded-2xl border transition-all shadow-md ${
        available
          ? "bg-[#14213D] text-white border-[#14213D]"
          : "bg-white text-[#14213D] border-[#5B6472]/30"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase ${
                available ? "bg-[#0F766E] text-white" : "bg-[#5B6472]/20 text-[#5B6472]"
              }`}>
                {available ? "● LIVE ACTIVE" : "PAUSED"}
              </span>
              <span className="font-mono text-xs font-semibold opacity-80">Group: {bloodGroup}</span>
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-extrabold tracking-tight mt-2">
              {available ? "Registered Donor Active & Available" : "Donation Alerts Are Paused"}
            </h1>
            <p className="text-xs mt-1 opacity-80 max-w-xl">
              {available
                ? "You are currently queued to receive instant emergency dispatch alerts in your area."
                : "Toggle availability back on whenever you are ready to receive donor alerts."}
            </p>
          </div>

          {/* Hero Toggle Switch Button */}
          <button
            type="button"
            disabled={updating}
            onClick={handleToggleAvailability}
            className={`py-3.5 px-6 rounded-xl font-mono text-xs font-bold shadow-md transition-all shrink-0 flex items-center gap-3 ${
              available
                ? "bg-[#0F766E] text-white hover:bg-[#0d645e]"
                : "bg-[#14213D] text-white hover:bg-black"
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${available ? "bg-white animate-pulse" : "bg-gray-400"}`} />
            {updating ? "Updating..." : available ? "Available (Click to Pause)" : "Unavailable (Click to Activate)"}
          </button>
        </div>
      </div>

      {/* Passive Eligibility Countdown Bar */}
      <div className="card-surface p-4 rounded-xl border shadow-sm flex items-center justify-between text-xs text-secondary-var">
        <div className="flex items-center gap-3">
          <span className="text-base">{isEligible ? "🟢" : "ℹ️"}</span>
          <div>
            <strong className="text-primary-var font-bold">
              {isEligible ? "Medically Eligible to Donate Blood" : "Donation Cooldown Active"}
            </strong>
            <p className="text-xs font-mono text-secondary-var mt-0.5">
              {isEligible ? "90-day donation interval verified" : `Last donated on ${lastDonationDate}`}
            </p>
          </div>
        </div>

        <Link href="/profile/setup" className="text-xs font-bold text-[#0F766E] dark:text-[#6FD6BC] hover:underline font-mono">
          Update Profile →
        </Link>
      </div>

      {/* Scannable Card Feed for Assigned / Notified Emergency Requests */}
      <div className="card-surface p-6 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-heading text-xl font-extrabold text-primary-var">
              Nearby Emergency Alerts ({assignedResponses.length})
            </h2>
            <p className="text-xs text-secondary-var mt-0.5">
              Urgent blood requirements matching your {bloodGroup} blood group.
            </p>
          </div>

          <button onClick={fetchDonorData} className="text-xs font-mono font-bold text-[#D62828] hover:underline">
            🔄 Refresh
          </button>
        </div>

        {assignedResponses.length === 0 ? (
          <div className="py-12 text-center text-secondary-var">
            <span className="text-3xl block mb-2">🎉</span>
            <p className="font-bold text-primary-var">No active emergency alerts matching {bloodGroup} right now.</p>
            <p className="text-xs font-mono text-secondary-var mt-1">System will dispatch Email & SMS alerts when an emergency arises.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignedResponses.map((resItem) => {
              const req = resItem.blood_requests;
              if (!req) return null;

              return (
                <div
                  key={resItem.id}
                  className="p-5 rounded-xl border border-gray-200 dark:border-[#2A3547] hover:border-[#14213D] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F6F7F5] dark:bg-[#101720]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <UrgencyBadge level={req.urgency} />
                      <MonoData className="bg-white dark:bg-[#182233] px-2 py-0.5 rounded border border-gray-200 dark:border-[#2A3547]">
                        ~{resItem.distance_km || 2.5} km away
                      </MonoData>
                      <span className="text-[10px] font-mono font-black uppercase text-secondary-var">
                        Status: {resItem.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-heading text-2xl font-extrabold text-primary-var">
                        {req.blood_group} <span className="text-xs font-mono font-semibold text-secondary-var">({req.units_required} unit{req.units_required > 1 ? "s" : ""})</span>
                      </h3>
                      <p className="text-xs font-bold text-primary-var mt-0.5">
                        Hospital: 🏥 <strong>{req.hospital_profiles?.hospital_name || "General Hospital"}</strong>
                      </p>
                      <p className="text-xs text-secondary-var mt-0.5">
                        Address: {req.hospital_profiles?.address || "Emergency ICU Ward"}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {resItem.status === "NOTIFIED" && (
                      <>
                        <button
                          onClick={() => handleRespondMatch(resItem.id, "ACCEPT")}
                          className="px-5 py-2.5 bg-[#0F766E] hover:bg-[#0d645e] text-white font-mono font-bold text-xs rounded-xl shadow transition-colors"
                        >
                          ✓ Accept & Help
                        </button>
                        <button
                          onClick={() => handleRespondMatch(resItem.id, "REJECT")}
                          className="px-4 py-2.5 border border-gray-300 dark:border-[#2A3547] text-secondary-var font-mono font-bold text-xs rounded-xl"
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {resItem.status === "ASSIGNED" && (
                      <span className="px-4 py-2 bg-[#0F766E] text-white font-mono font-extrabold text-xs rounded-xl shadow">
                        ✓ Assigned Donor (En Route)
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
