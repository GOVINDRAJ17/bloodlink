/**
 * Multi-Source Emergency Response Plan Optimizer
 * 
 * Synthesizes an actionable, multi-source response plan by solving a constrained
 * greedy knapsack optimization:
 * 
 * Objective:
 * Maximize cumulative resource score and minimize arrival ETA, subject to:
 * - Sum(allocatedUnits) <= unitsRequired (no wasteful overallocation)
 * - Blood Bank stored units prioritized for immediate stable reserve
 * - High-reliability donors activated to close remaining deficit
 * 
 * Generates transparent execution steps and handles partial shortages gracefully.
 */

import { GeoLocation } from "./etaService";
import { CandidateResource, ScoredResource, rankEmergencyResources } from "./scoringEngine";
import { executeDynamicRadiusSearch, DynamicRadiusSearchResult } from "./dynamicRadiusService";

export interface EmergencyPlanItem {
  id: string;
  sourceType: "BLOOD_BANK" | "DONOR";
  sourceId: string;
  name: string;
  bloodGroup: string;
  allocatedUnits: number;
  availableUnits: number;
  totalScore: number;
  distanceKm: number;
  etaMinutes: number;
  availabilityConfidence: number;
  recommendedAction: "RESERVE" | "CONTACT";
  status: "PROPOSED" | "RESERVED" | "CONTACTED" | "CONFIRMED" | "UNAVAILABLE";
  whyRecommended: string[];
  location: GeoLocation;
  phone?: string;
  address?: string;
}

export interface EmergencyResponsePlan {
  id: string;
  requestId: string;
  urgency: "NORMAL" | "URGENT" | "CRITICAL";
  bloodGroup: string;
  component: string;
  totalUnitsRequired: number;
  totalUnitsPlanned: number;
  remainingShortage: number;
  isFullyFulfilled: boolean;
  estimatedResponseMinutes: number;
  overallConfidence: number;
  searchRadiusKm: number;
  items: EmergencyPlanItem[];
  executionSteps: string[];
  shortageGuidance?: string;
  searchTelemetry: DynamicRadiusSearchResult;
  createdAt: string;
}

export interface OptimizationRequest {
  requestId: string;
  bloodGroup: string;
  component: string;
  unitsRequired: number;
  urgency: "NORMAL" | "URGENT" | "CRITICAL";
  hospitalLocation: GeoLocation;
  hospitalName?: string;
  deadlineMinutes?: number;
}

/**
 * Generates an optimized emergency blood response plan.
 */
export function generateEmergencyResponsePlan(
  request: OptimizationRequest,
  availableCandidates: CandidateResource[],
  excludedSourceIds: string[] = []
): EmergencyResponsePlan {
  // Filter out any explicitly excluded sources (e.g., during recalculation when a resource is marked unavailable)
  const activeCandidates = availableCandidates.filter(
    (c) => !excludedSourceIds.includes(c.id) && (c.sourceType !== "DONOR" || c.isAvailable !== false)
  );

  // 1. Dynamic Expanding Radius Search
  const searchResult = executeDynamicRadiusSearch(activeCandidates, {
    bloodGroup: request.bloodGroup,
    component: request.component,
    unitsRequired: request.unitsRequired,
    urgency: request.urgency,
    hospitalLocation: request.hospitalLocation,
  });

  // 2. Score and Rank candidates within the sufficient radius
  const ranked = rankEmergencyResources(searchResult.filteredCandidates, {
    bloodGroup: request.bloodGroup,
    component: request.component,
    unitsRequired: request.unitsRequired,
    urgency: request.urgency,
    hospitalLocation: request.hospitalLocation,
    deadlineMinutes: request.deadlineMinutes,
  });

  // 3. Multi-Source Allocation:
  // We prefer immediate verified blood-bank inventory first (immediate stock),
  // supplemented by high-scoring donors.
  let remainingNeeded = request.unitsRequired;
  const planItems: EmergencyPlanItem[] = [];
  let maxEta = 0;
  let confidenceSum = 0;

  // Split ranked into Blood Banks and Donors
  const bloodBanks = ranked.filter((r) => r.candidate.sourceType === "BLOOD_BANK");
  const donors = ranked.filter((r) => r.candidate.sourceType === "DONOR");

  // Allocate from top blood banks first
  for (const item of bloodBanks) {
    if (remainingNeeded <= 0) break;
    const canTake = Math.min(remainingNeeded, item.candidate.availableUnits);
    if (canTake > 0) {
      remainingNeeded -= canTake;
      const etaMin = item.eta.totalEtaMinutes;
      if (etaMin > maxEta) maxEta = etaMin;
      const conf = item.freshness?.confidence ?? 85;
      confidenceSum += conf * canTake;

      planItems.push({
        id: `plan-item-${item.candidate.id}`,
        sourceType: "BLOOD_BANK",
        sourceId: item.candidate.id,
        name: item.candidate.name,
        bloodGroup: item.candidate.bloodGroup,
        allocatedUnits: canTake,
        availableUnits: item.candidate.availableUnits,
        totalScore: item.totalScore,
        distanceKm: item.eta.distanceKm,
        etaMinutes: etaMin,
        availabilityConfidence: conf,
        recommendedAction: "RESERVE",
        status: "PROPOSED",
        whyRecommended: item.whyRecommended,
        location: item.candidate.location,
        phone: item.candidate.phone,
        address: item.candidate.address,
      });
    }
  }

  // If deficit remains, mobilize top ranked voluntary donors (1 unit each)
  for (const item of donors) {
    if (remainingNeeded <= 0) break;
    remainingNeeded -= 1;
    const etaMin = item.eta.totalEtaMinutes;
    if (etaMin > maxEta) maxEta = etaMin;
    const conf = item.candidate.reliabilityScore ?? 80;
    confidenceSum += conf;

    planItems.push({
      id: `plan-item-${item.candidate.id}`,
      sourceType: "DONOR",
      sourceId: item.candidate.id,
      name: item.candidate.name,
      bloodGroup: item.candidate.bloodGroup,
      allocatedUnits: 1,
      availableUnits: 1,
      totalScore: item.totalScore,
      distanceKm: item.eta.distanceKm,
      etaMinutes: etaMin,
      availabilityConfidence: conf,
      recommendedAction: "CONTACT",
      status: "PROPOSED",
      whyRecommended: item.whyRecommended,
      location: item.candidate.location,
      phone: item.candidate.phone,
    });
  }

  const totalPlanned = request.unitsRequired - remainingNeeded;
  const isFullyFulfilled = remainingNeeded === 0;
  const overallConfidence =
    totalPlanned > 0 ? Math.round(confidenceSum / totalPlanned) : 0;

  // Formulate clear, actionable clinical execution steps
  const executionSteps: string[] = [];
  planItems.forEach((item, idx) => {
    if (item.sourceType === "BLOOD_BANK") {
      executionSteps.push(
        `Step ${idx + 1}: Reserve ${item.allocatedUnits} unit${item.allocatedUnits > 1 ? "s" : ""} at ${item.name} (~${item.distanceKm} km, ETA ${item.etaMinutes} min)`
      );
    } else {
      executionSteps.push(
        `Step ${idx + 1}: Dispatch priority emergency mobilization notification to donor ${item.name} (~${item.distanceKm} km, ETA ${item.etaMinutes} min)`
      );
    }
  });

  let shortageGuidance: string | undefined;
  if (!isFullyFulfilled) {
    shortageGuidance = `PARTIAL FULFILLMENT ALERT: Identified ${totalPlanned} of ${request.unitsRequired} required units within ${searchResult.finalRadiusKm} km. Recommended action: Immediately lock ${totalPlanned} proposed units, activate institutional plasma/platelet replacement protocol, and broaden dispatch request to regional network.`;
  }

  return {
    id: `plan-${Date.now()}`,
    requestId: request.requestId,
    urgency: request.urgency,
    bloodGroup: request.bloodGroup,
    component: request.component,
    totalUnitsRequired: request.unitsRequired,
    totalUnitsPlanned: totalPlanned,
    remainingShortage: remainingNeeded,
    isFullyFulfilled,
    estimatedResponseMinutes: maxEta || 15,
    overallConfidence,
    searchRadiusKm: searchResult.finalRadiusKm,
    items: planItems,
    executionSteps,
    shortageGuidance,
    searchTelemetry: searchResult,
    createdAt: new Date().toISOString(),
  };
}
