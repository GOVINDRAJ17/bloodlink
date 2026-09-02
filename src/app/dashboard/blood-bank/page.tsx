"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { VerifiedBadge, MonoData } from "@/app/components/ui/Badge";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function BloodBankDashboardPage() {
  const supabase = createClient();

  const [bankProfile, setBankProfile] = useState<any>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchBankData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: bank } = await supabase
        .from("blood_bank_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (bank) {
        setBankProfile(bank);

        // Fetch inventory rows
        const { data: items } = await supabase
          .from("blood_inventory")
          .select("*")
          .eq("blood_bank_id", bank.id);

        const stockMap: Record<string, number> = {};
        BLOOD_GROUPS.forEach(bg => { stockMap[bg] = 0; });

        if (items) {
          items.forEach((item: any) => {
            stockMap[item.blood_group] = item.units_available;
          });
        }
        setInventory(stockMap);
      }
    } catch (err) {
      console.error("Error loading blood bank dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankData();
  }, []);

  const handleUpdateStock = async (bloodGroup: string, delta: number) => {
    if (!bankProfile) return;
    try {
      setUpdating(true);
      const currentQty = inventory[bloodGroup] || 0;
      const newQty = Math.max(0, currentQty + delta);

      const { error } = await supabase
        .from("blood_inventory")
        .upsert({
          blood_bank_id: bankProfile.id,
          blood_group: bloodGroup,
          units_available: newQty,
          updated_at: new Date().toISOString()
        }, { onConflict: "blood_bank_id, blood_group" });

      if (!error) {
        setInventory(prev => ({ ...prev, [bloodGroup]: newQty }));
      }
    } catch (err) {
      alert("Failed to update inventory stock");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto p-10 text-center font-mono text-xs text-secondary-var">Loading Inventory Matrix...</div>;
  }

  const lowStockAlerts = Object.entries(inventory).filter(([_, qty]) => qty < 5);

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-surface p-6 rounded-xl border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <VerifiedBadge type="BLOOD_BANK" />
            <MonoData className="text-secondary-var">Facility: {bankProfile?.blood_bank_name || "Regional Storage"}</MonoData>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-black text-primary-var">
            Regional Blood Storage Facility
          </h1>
          <p className="text-xs text-secondary-var mt-1">
            At-a-glance stock matrix with frictionless inline quick-edit controls.
          </p>
        </div>

        <button onClick={fetchBankData} className="px-4 py-2 bg-[#14213D] text-white text-xs font-mono font-bold rounded-lg shadow">
          🔄 Refresh Stock
        </button>
      </div>

      {/* Low-Stock Warning Banner */}
      {lowStockAlerts.length > 0 && (
        <div className="p-4 bg-[#D62828]/10 border border-[#D62828]/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🚨</span>
            <h3 className="text-xs font-mono font-black text-[#D62828] uppercase tracking-wide">
              Critical Low Stock Warnings ({lowStockAlerts.length} Groups below 5 units)
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockAlerts.map(([bg, qty]) => (
              <span key={bg} className="bg-white dark:bg-[#101720] border border-[#D62828]/30 text-[#D62828] px-3 py-1 rounded-md text-xs font-mono font-bold shadow-sm">
                ⚠️ {bg}: <strong>{qty} units remaining</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stock Inventory Grid */}
      <div className="card-surface p-6 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-bold text-primary-var">Inventory Stock Cards</h2>
          <span className="text-xs font-mono text-secondary-var">Supabase Realtime Sync</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {BLOOD_GROUPS.map((group) => {
            const qty = inventory[group] || 0;
            const isLow = qty < 5;

            return (
              <div key={group} className={`p-4 rounded-xl border transition-all ${
                isLow ? "bg-[#D62828]/5 border-[#D62828]/30 shadow-sm" : "bg-[#F6F7F5] dark:bg-[#101720] border-gray-200 dark:border-[#2A3547]"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-heading text-2xl font-black ${isLow ? "text-[#D62828]" : "text-primary-var"}`}>
                    {group}
                  </span>
                  {isLow && (
                    <span className="text-[10px] font-mono font-black bg-[#D62828] text-white px-2 py-0.5 rounded uppercase">
                      ⚠️ LOW ({qty})
                    </span>
                  )}
                </div>

                {/* Inline Quick-Edit Controls */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs bg-white dark:bg-[#182233] p-2.5 rounded-lg border border-gray-200 dark:border-[#2A3547] shadow-sm">
                    <span className="font-bold text-primary-var">Available Units</span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={updating}
                        onClick={() => handleUpdateStock(group, -1)}
                        className="w-7 h-7 bg-gray-100 dark:bg-gray-800 text-primary-var rounded-md font-mono font-black text-sm flex items-center justify-center border"
                      >
                        -
                      </button>
                      <strong className="font-mono text-base font-black min-w-[24px] text-center text-primary-var">{qty}</strong>
                      <button
                        disabled={updating}
                        onClick={() => handleUpdateStock(group, 1)}
                        className="w-7 h-7 bg-[#D62828] hover:bg-red-700 text-white rounded-md font-mono font-black text-sm flex items-center justify-center shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
