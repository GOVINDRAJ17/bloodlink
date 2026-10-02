/**
 * Multi-Criteria Emergency Resource Scoring Engine
 * 
 * Scores candidate resources (Blood Banks and Donors) using a normalized multi-factor
 * model weighted by urgency level:
 * 
 * 1. Compatibility Score (0 - 100)
 * 2. ETA / Proximity Score (0 - 100, where closer/faster is higher)
 * 3. Availability / Stock Score (0 - 100)
 * 4. Reliability Score (0 - 100, based on donor history or bank verification)
 * 
 * Produces structured "Why recommended?" explanation points for transparency.
 */

import { EMERGENCY_CONFIG } from "./config";
import { checkBloodCompatibility, CompatibilityEvaluation } from "./compatibility";
import { estimateEmergencyEta, GeoLocation, EtaResult } from "./etaService";
import { assessInventoryFreshness, FreshnessAssessment } from "./confidenceService";

export type SourceType = "BLOOD_BANK" | "DONOR";

export interface CandidateResource {
  id: string;
  sourceType: SourceType;
  name: string;
  bloodGroup: string;
  location: GeoLocation;
  availableUnits: number;
  phone?: string;
  address?: string;
  verified?: boolean;
  // Blood Bank specific
  updatedAt?: string | Date;
  component?: string;
  // Donor specific
  reliabilityScore?: number; // 0 - 100
  lastDonationDate?: string | Date;
  totalDonations?: number;
  isAvailable?: boolean;
}

export interface ScoredResource {
  candidate: CandidateResource;
  totalScore: number;       // Normalized 0 - 100
  subScores: {
    compatibility: number;  // 0 - 100
    eta: number;            // 0 - 100
    availability: number;   // 0 - 100
    reliability: number;    // 0 - 100
  };
  weights: {
    compatibility: number;
    eta: number;
    availability: number;
    reliability: number;
  };
  compatibility: CompatibilityEvaluation;
  eta: EtaResult;
  freshness?: FreshnessAssessment;
  allocatedUnits: number;
  recommendedAction: "RESERVE" | "CONTACT";
  whyRecommended: string[]; // Transparent factual bullet points
}

/**
 * Normalizes ETA into a 0 - 100 score where faster ETA scores higher.
 * e.g. <= 10 mins -> 100, 30 mins -> 75, 60 mins -> 50, 120 mins -> 20.
 */
function normalizeEtaScore(totalEtaMinutes: number): number {
  if (totalEtaMinutes <= 10) return 100;
  if (totalEtaMinutes >= 150) return 10;
  // Linear decay between 10 and 150 minutes
  const score = 100 - ((totalEtaMinutes - 10) / (150 - 10)) * 90;
  return Math.max(10, Math.round(score));
}

/**
 * Scores a single candidate resource against an emergency blood request.
 */
export function scoreEmergencyCandidate(
  candidate: CandidateResource,
  request: {
    bloodGroup: string;
    component: string;
    unitsRequired: number;
    urgency: "NORMAL" | "URGENT" | "CRITICAL";
    hospitalLocation: GeoLocation;
    deadlineMinutes?: number;
  }
): ScoredResource {
  const urgency = request.urgency || "NORMAL";
  const profile = EMERGENCY_CONFIG.urgencyProfiles[urgency] || EMERGENCY_CONFIG.urgencyProfiles.NORMAL;
  const weights = profile.weights;

  // 1. Compatibility
  const compEval = checkBloodCompatibility(
    request.bloodGroup,
    candidate.bloodGroup,
    request.component
  );
  const compatSubScore = compEval.score;

  // 2. ETA & Distance
  const eta = estimateEmergencyEta(
    candidate.location,
    request.hospitalLocation,
    candidate.sourceType,
    urgency
  );
  const etaSubScore = normalizeEtaScore(eta.totalEtaMinutes);

  // 3. Availability & Freshness
  let availSubScore = 50;
  let freshness: FreshnessAssessment | undefined;

  if (candidate.sourceType === "BLOOD_BANK") {
    freshness = assessInventoryFreshness(candidate.updatedAt);
    // Availability score combines units on hand + confidence
    const unitFactor = Math.min(100, (candidate.availableUnits / Math.max(1, request.unitsRequired)) * 100);
    availSubScore = Math.round(freshness.confidence * 0.6 + unitFactor * 0.4);
  } else {
    // Donor availability
    availSubScore = candidate.isAvailable !== false ? 90 : 30;
  }

  // 4. Reliability
  let relSubScore = 75;
  if (candidate.sourceType === "BLOOD_BANK") {
    relSubScore = candidate.verified ? 95 : 75;
  } else {
    relSubScore = Math.min(100, Math.max(20, candidate.reliabilityScore ?? 80));
  }

  // Weighted Total Score
  const rawTotal =
    compatSubScore * weights.compatibility +
    etaSubScore * weights.eta +
    availSubScore * weights.availability +
    relSubScore * weights.reliability;

  const totalScore = Math.min(100, Math.max(0, Math.round(rawTotal)));

  // Generate transparent "Why recommended?" rationale
  const whyRecommended: string[] = [];

  // Compatibility reason
  if (compEval.tier === "EXACT") {
    whyRecommended.push(`Exact ${candidate.bloodGroup} match for ${request.component}`);
  } else if (compEval.isCompatible) {
    whyRecommended.push(`Clinically compatible alternative (${candidate.bloodGroup})`);
  }

  // Proximity & ETA reason
  whyRecommended.push(
    `~${eta.distanceKm} km away with estimated ETA of ${eta.totalEtaMinutes} min`
  );

  // Inventory / Reliability reason
  if (candidate.sourceType === "BLOOD_BANK") {
    whyRecommended.push(
      `${candidate.availableUnits} unit${candidate.availableUnits > 1 ? "s" : ""} on hand (${freshness?.label || "Inventory verified"}, updated ${freshness?.humanAge})`
    );
  } else {
    whyRecommended.push(
      `Verified voluntary donor with ${relSubScore}% historical response reliability`
    );
    if (candidate.totalDonations && candidate.totalDonations > 0) {
      whyRecommended.push(`Proven track record of ${candidate.totalDonations} previous successful donations`);
    }
  }

  // Urgency alignment
  if (urgency === "CRITICAL" && eta.totalEtaMinutes <= 25) {
    whyRecommended.push(`Optimal rapid transit time for ${urgency} priority window`);
  }

  const recommendedAction: "RESERVE" | "CONTACT" =
    candidate.sourceType === "BLOOD_BANK" ? "RESERVE" : "CONTACT";

  return {
    candidate,
    totalScore,
    subScores: {
      compatibility: compatSubScore,
      eta: etaSubScore,
      availability: availSubScore,
      reliability: relSubScore,
    },
    weights,
    compatibility: compEval,
    eta,
    freshness,
    allocatedUnits: 0, // Assigned by optimizer
    recommendedAction,
    whyRecommended,
  };
}

/**
 * Ranks candidates by total score descending.
 */
export function rankEmergencyResources(
  candidates: CandidateResource[],
  request: {
    bloodGroup: string;
    component: string;
    unitsRequired: number;
    urgency: "NORMAL" | "URGENT" | "CRITICAL";
    hospitalLocation: GeoLocation;
    deadlineMinutes?: number;
  }
): ScoredResource[] {
  return candidates
    .map((c) => scoreEmergencyCandidate(c, request))
    .filter((s) => s.compatibility.isCompatible)
    .sort((a, b) => b.totalScore - a.totalScore);
}
