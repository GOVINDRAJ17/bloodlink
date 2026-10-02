/**
 * Dynamic Expanding Search Radius Service
 * 
 * Instead of statically querying a single fixed distance, this service progressively
 * steps outward through configured radii until sufficient compatible units are located
 * or maximum reach is reached.
 * 
 * Captures comprehensive telemetry for UI progress indicators and academic analysis.
 */

import { EMERGENCY_CONFIG } from "./config";
import { GeoLocation, calculateHaversineDistance } from "./etaService";
import { CandidateResource } from "./scoringEngine";
import { checkBloodCompatibility } from "./compatibility";

export interface RadiusStepLog {
  stepIndex: number;
  radiusKm: number;
  compatibleUnitsFound: number;
  cumulativeUnitsFound: number;
  candidatesCount: number;
  isSufficient: boolean;
  timestamp: string;
}

export interface DynamicRadiusSearchResult {
  initialRadiusKm: number;
  finalRadiusKm: number;
  maxRadiusKm: number;
  expandedCount: number;
  steps: RadiusStepLog[];
  filteredCandidates: CandidateResource[];
  totalCompatibleUnitsFound: number;
  isFullySufficient: boolean;
  summaryText: string;
}

/**
 * Filters candidates through dynamic stepwise radius expansion.
 */
export function executeDynamicRadiusSearch(
  allCandidates: CandidateResource[],
  request: {
    bloodGroup: string;
    component: string;
    unitsRequired: number;
    urgency: "NORMAL" | "URGENT" | "CRITICAL";
    hospitalLocation: GeoLocation;
  }
): DynamicRadiusSearchResult {
  const urgency = request.urgency || "NORMAL";
  const profile = EMERGENCY_CONFIG.urgencyProfiles[urgency] || EMERGENCY_CONFIG.urgencyProfiles.NORMAL;
  const radiiSteps = [...profile.searchRadiiKm];
  const maxRadiusKm = profile.maxRadiusKm;

  // Pre-filter candidates by compatibility
  const compatiblePool = allCandidates.filter((cand) => {
    const comp = checkBloodCompatibility(
      request.bloodGroup,
      cand.bloodGroup,
      request.component
    );
    return comp.isCompatible;
  });

  // Calculate distance from hospital for all candidates
  const candidatesWithDistance = compatiblePool.map((cand) => ({
    ...cand,
    distanceKm: calculateHaversineDistance(cand.location, request.hospitalLocation),
  }));

  const steps: RadiusStepLog[] = [];
  let matchingCandidates: CandidateResource[] = [];
  let cumulativeUnits = 0;
  let finalRadiusKm = radiiSteps[0];
  let isFullySufficient = false;

  for (let i = 0; i < radiiSteps.length; i++) {
    const currentRadius = radiiSteps[i];
    finalRadiusKm = currentRadius;

    // Filter resources within current step radius
    const withinRadius = candidatesWithDistance.filter(
      (c) => c.distanceKm <= currentRadius
    );

    // Tally available units (for blood banks: availableUnits; for donors: 1 unit each if available)
    let stepUnits = 0;
    withinRadius.forEach((c) => {
      if (c.sourceType === "DONOR" && c.isAvailable === false) return;
      const units = c.sourceType === "BLOOD_BANK" ? c.availableUnits : 1;
      stepUnits += units;
    });

    cumulativeUnits = stepUnits;
    matchingCandidates = withinRadius;
    const isSufficient = cumulativeUnits >= request.unitsRequired;

    steps.push({
      stepIndex: i + 1,
      radiusKm: currentRadius,
      compatibleUnitsFound: stepUnits,
      cumulativeUnitsFound: cumulativeUnits,
      candidatesCount: withinRadius.length,
      isSufficient,
      timestamp: new Date().toISOString(),
    });

    if (isSufficient) {
      isFullySufficient = true;
      break; // Halt expansion as soon as required units are satisfied
    }
  }

  // Generate clear summary text
  const initialRadius = radiiSteps[0];
  let summaryText = "";
  if (steps.length === 1 && isFullySufficient) {
    summaryText = `Sufficient resources located within initial ${initialRadius} km radius (${cumulativeUnits} units available).`;
  } else if (isFullySufficient) {
    summaryText = `Expanded search radius from ${initialRadius} km to ${finalRadiusKm} km to meet required ${request.unitsRequired} units (${cumulativeUnits} units located).`;
  } else {
    summaryText = `Shortage alert: Expanded to maximum ${finalRadiusKm} km search radius. Found ${cumulativeUnits} of ${request.unitsRequired} required units.`;
  }

  return {
    initialRadiusKm: initialRadius,
    finalRadiusKm,
    maxRadiusKm,
    expandedCount: steps.length - 1,
    steps,
    filteredCandidates: matchingCandidates,
    totalCompatibleUnitsFound: cumulativeUnits,
    isFullySufficient,
    summaryText,
  };
}
