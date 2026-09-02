import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleAnalyticsQuery();
}

export async function POST(request: Request) {
  return handleAnalyticsQuery();
}

async function handleAnalyticsQuery() {
  const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  try {
    const supabase = await createClient();

    // Parallel database queries for speed and efficiency
    const [
      requestsRes,
      inventoryRes,
      hospitalsRes,
      donorsRes
    ] = await Promise.all([
      supabase.from("blood_requests").select("id, blood_group, units_needed, status, urgency, created_at"),
      supabase.from("blood_inventory").select("id, blood_group, units_available, updated_at"),
      supabase.from("hospital_profiles").select("id", { count: "exact" }),
      supabase.from("donor_profiles").select("id", { count: "exact" })
    ]);

    const requests = requestsRes.data || [];
    const inventory = inventoryRes.data || [];
    const activeHospitals = hospitalsRes.count ?? hospitalsRes.data?.length ?? 0;
    const activeDonors = donorsRes.count ?? donorsRes.data?.length ?? 0;

    // Real Metrics Aggregation
    const totalRequests = requests.length;
    const fulfilledRequests = requests.filter(r => r.status === "FULFILLED" || r.status === "MATCHED").length;
    const pendingRequests = requests.filter(r => r.status === "SEARCHING").length;
    const emergencyRequests = requests.filter(r => r.urgency === "CRITICAL" || r.urgency === "URGENT").length;

    // Total available units in inventory
    const totalAvailableUnits = inventory.reduce((sum, item) => sum + (Number(item.units_available) || 0), 0);

    // Group breakdown map
    const groupStock: Record<string, number> = {};
    const groupRequests: Record<string, number> = {};

    BLOOD_GROUPS.forEach(bg => {
      groupStock[bg] = 0;
      groupRequests[bg] = 0;
    });

    inventory.forEach(item => {
      if (item.blood_group) {
        groupStock[item.blood_group] = (groupStock[item.blood_group] || 0) + (Number(item.units_available) || 0);
      }
    });

    requests.forEach(r => {
      if (r.blood_group) {
        groupRequests[r.blood_group] = (groupRequests[r.blood_group] || 0) + 1;
      }
    });

    // Shortage Risk Analysis based on real inventory vs requests
    const predictions = BLOOD_GROUPS.map((bg) => {
      const stock = groupStock[bg] || 0;
      const reqCount = groupRequests[bg] || 0;
      const burnRatePerDay = Math.max(1, Math.round(reqCount * 0.5 + 1));
      const daysRemaining = stock === 0 ? 0 : Math.round((stock / burnRatePerDay) * 10) / 10;

      let riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" = "LOW";
      let riskScore = 15;

      if (stock === 0 || daysRemaining <= 1) {
        riskLevel = "CRITICAL";
        riskScore = 95;
      } else if (stock <= 5 || daysRemaining <= 3) {
        riskLevel = "HIGH";
        riskScore = 75;
      } else if (stock <= 10 || daysRemaining <= 5) {
        riskLevel = "MODERATE";
        riskScore = 45;
      }

      let recommendation = `Stock levels healthy (${stock} units). Continue routine monitoring.`;
      if (riskLevel === "CRITICAL") {
        recommendation = `CRITICAL: Immediate blood drive required for ${bg}. Only ${stock} units available!`;
      } else if (riskLevel === "HIGH") {
        recommendation = `ALERT: Low ${bg} inventory (${stock} units). Issue targeted donor alerts.`;
      }

      return {
        bloodGroup: bg,
        currentStockUnits: stock,
        totalRequestsCount: reqCount,
        projectedBurnRatePerDay: burnRatePerDay,
        projectedDaysRemaining: daysRemaining,
        riskLevel,
        riskScore,
        recommendation
      };
    });

    const criticalRiskCount = predictions.filter(p => p.riskLevel === "CRITICAL").length;

    return NextResponse.json({
      success: true,
      summary: {
        totalRequests,
        fulfilledRequests,
        pendingRequests,
        emergencyRequests,
        totalAvailableUnits,
        activeHospitals,
        activeDonors,
        criticalRiskCount,
        overallStatus: criticalRiskCount > 0 ? "CRITICAL_WARNING" : "OPERATIONAL"
      },
      predictions,
      recentRequests: requests.slice(0, 5)
    }, { status: 200 });

  } catch (err: any) {
    console.error("Analytics query error:", err);
    return NextResponse.json({
      success: false,
      error: "Failed to query real analytics data from database.",
      details: err.message
    }, { status: 500 });
  }
}
