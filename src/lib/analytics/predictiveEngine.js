/**
 * Predictive Shortage Analytics Engine
 * 
 * Analyzes historical emergency blood request velocity and real-time blood bank
 * stock levels to compute Shortage Risk Scores (0-100), daily burn rates, and
 * projected stock exhaustion timelines.
 */

const BLOOD_GROUPS = [
  "O-Ve", "O+Ve", "A+Ve", "A-Ve", "B+Ve", "B-Ve", "AB+Ve", "AB-Ve", "Oh+VE", "Oh-VE"
];

export function calculateShortagePredictions(inventoryStock = {}, emergencyRequests = []) {
  const predictions = [];
  const now = new Date();

  for (const group of BLOOD_GROUPS) {
    // Current available units across blood bank inventory
    const components = inventoryStock[group] || {};
    const stockUnits = Number(components["Packed Red Blood Cells"] ?? components["Whole Blood"] ?? 3);

    // Count recent emergency requests for this blood group
    const matchingRequests = emergencyRequests.filter(r => r.bloodGroup === group);
    const recentRequestsCount = matchingRequests.length;

    // Projected daily burn rate based on request velocity (minimum baseline 0.5 units/day)
    const burnRatePerDay = Number(Math.max(0.5, (recentRequestsCount * 0.4) + 0.5).toFixed(1));

    // Projected days remaining before stock exhaustion
    const daysRemaining = Number((stockUnits / burnRatePerDay).toFixed(1));

    // Calculate composite Shortage Risk Score (0 - 100)
    let riskScore = 0;
    if (stockUnits === 0) {
      riskScore = 100;
    } else {
      const inverseDays = 1 / Math.max(0.1, daysRemaining);
      riskScore = Math.min(100, Math.round(inverseDays * 220));
    }

    // Determine Risk Level Category
    let riskLevel = "LOW";
    if (riskScore >= 75 || daysRemaining <= 2) {
      riskLevel = "CRITICAL";
    } else if (riskScore >= 50 || daysRemaining <= 4) {
      riskLevel = "HIGH";
    } else if (riskScore >= 25 || daysRemaining <= 7) {
      riskLevel = "MODERATE";
    }

    // Actionable Recommendation
    let recommendation = "Stock levels optimal. Routine inventory monitoring.";
    if (riskLevel === "CRITICAL") {
      recommendation = `🚨 CRITICAL SHORTAGE: Mobilize ${group} donors immediately & request inter-bank transfer.`;
    } else if (riskLevel === "HIGH") {
      recommendation = `⚠️ HIGH RISK: Initiate targeted ${group} donor notifications within 24 hours.`;
    } else if (riskLevel === "MODERATE") {
      recommendation = `💡 MODERATE: Schedule upcoming ${group} donation camps for next week.`;
    }

    predictions.push({
      bloodGroup: group,
      riskScore,
      riskLevel,
      currentStockUnits: stockUnits,
      projectedBurnRatePerDay: burnRatePerDay,
      projectedDaysRemaining: daysRemaining,
      recommendation,
      calculatedAt: now
    });
  }

  // Sort descending by risk score
  predictions.sort((a, b) => b.riskScore - a.riskScore);

  return predictions;
}
