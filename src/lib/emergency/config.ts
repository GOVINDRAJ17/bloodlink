/**
 * Emergency Blood Response Engine - Centralized Configuration
 * 
 * All algorithmic constants, urgency weights, radius expansion steps,
 * freshness decay thresholds, and ETA fallbacks are defined here.
 * Designed for research configurability and empirical tuning.
 */

export interface UrgencyProfile {
  name: "NORMAL" | "URGENT" | "CRITICAL";
  description: string;
  weights: {
    compatibility: number;  // Blood compatibility weight
    eta: number;            // Estimated arrival / response time weight
    availability: number;   // Unit availability / stock weight
    reliability: number;    // Donor response reliability / hospital verification
  };
  searchRadiiKm: number[];  // Dynamic stepwise search radius expansion
  maxRadiusKm: number;      // Maximum expansion ceiling
  speedKmH: number;         // Estimated urban transit speed under emergency sirens/traffic
  priorityMultiplier: number;
}

export const EMERGENCY_CONFIG = {
  urgencyProfiles: {
    NORMAL: {
      name: "NORMAL",
      description: "Elective or scheduled routine transfusion with moderate lead time",
      weights: {
        compatibility: 0.35,
        eta: 0.25,
        availability: 0.25,
        reliability: 0.15,
      },
      searchRadiiKm: [5, 15, 30, 60],
      maxRadiusKm: 60,
      speedKmH: 28, // Normal urban road speed
      priorityMultiplier: 1.0,
    },
    URGENT: {
      name: "URGENT",
      description: "Severe condition requiring rapid blood mobilization within hours",
      weights: {
        compatibility: 0.35,
        eta: 0.35,
        availability: 0.20,
        reliability: 0.10,
      },
      searchRadiiKm: [5, 20, 50, 90],
      maxRadiusKm: 90,
      speedKmH: 36, // Moderate traffic priority
      priorityMultiplier: 1.15,
    },
    CRITICAL: {
      name: "CRITICAL",
      description: "Immediate life-threatening trauma / massive hemorrhage requiring instantaneous response",
      weights: {
        compatibility: 0.30,
        eta: 0.40,
        availability: 0.25,
        reliability: 0.05,
      },
      searchRadiiKm: [3, 15, 45, 90],
      maxRadiusKm: 90,
      speedKmH: 45, // Emergency green corridor / siren transit speed
      priorityMultiplier: 1.30,
    },
  } as Record<string, UrgencyProfile>,

  // Inventory Freshness Confidence decay schedule (based on elapsed hours since last update)
  inventoryFreshness: {
    tiers: [
      { maxMinutes: 30, confidence: 98, label: "Real-time verified" },
      { maxMinutes: 120, confidence: 92, label: "Updated recently" },
      { maxMinutes: 360, confidence: 78, label: "Moderate confidence" },
      { maxMinutes: 720, confidence: 60, label: "Aging inventory log" },
      { maxMinutes: 1440, confidence: 45, label: "Stale (Needs re-verification)" },
      { maxMinutes: Infinity, confidence: 25, label: "Very stale inventory" },
    ],
    unknownConfidence: 50,
  },

  // Donor response mobilization buffer (minutes before donor can physically start traveling)
  donorMobilizationMinutes: {
    NORMAL: 30,
    URGENT: 20,
    CRITICAL: 10,
  },

  // Blood bank dispatch preparation buffer (minutes to cross-match and release stored units)
  bloodBankPrepMinutes: {
    NORMAL: 20,
    URGENT: 12,
    CRITICAL: 5,
  },

  // Minimum required donor interval (days)
  donorMinIntervalDays: 90,

  // Research comparative evaluation constants
  researchBaselines: {
    baseline1: "Nearest Compatible Source (Greedy Proximity)",
    baseline2: "Nearest Compatible Donor Only",
    baseline3: "Static Rule-Based Ranking",
    bloodlink: "BloodLink Multi-Criteria Response Optimizer",
  },
};
