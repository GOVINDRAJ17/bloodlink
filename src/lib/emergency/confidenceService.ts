/**
 * Inventory Freshness & Availability Confidence Service
 * 
 * Quantifies how reliable a reported stock number is based on how recently
 * it was updated by the blood bank. Stale inventory receives lower confidence
 * so the engine can prioritize recently audited supplies.
 */

import { EMERGENCY_CONFIG } from "./config";

export interface FreshnessAssessment {
  confidence: number;      // 0 - 100 percentage
  elapsedMinutes: number;
  label: string;
  isStale: boolean;
  humanAge: string;
}

/**
 * Assesses availability confidence based on last stock update timestamp.
 */
export function assessInventoryFreshness(
  updatedAtInput: string | Date | null | undefined
): FreshnessAssessment {
  if (!updatedAtInput) {
    return {
      confidence: EMERGENCY_CONFIG.inventoryFreshness.unknownConfidence,
      elapsedMinutes: 9999,
      label: "Unverified timestamp",
      isStale: true,
      humanAge: "Unknown",
    };
  }

  const updatedDate = new Date(updatedAtInput);
  if (isNaN(updatedDate.getTime())) {
    return {
      confidence: EMERGENCY_CONFIG.inventoryFreshness.unknownConfidence,
      elapsedMinutes: 9999,
      label: "Invalid timestamp",
      isStale: true,
      humanAge: "Unknown",
    };
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - updatedDate.getTime());
  const elapsedMinutes = Math.round(diffMs / 60000);

  // Match against configured decay tiers
  const tier = EMERGENCY_CONFIG.inventoryFreshness.tiers.find(
    (t) => elapsedMinutes <= t.maxMinutes
  ) || EMERGENCY_CONFIG.inventoryFreshness.tiers[EMERGENCY_CONFIG.inventoryFreshness.tiers.length - 1];

  let humanAge: string;
  if (elapsedMinutes < 1) {
    humanAge = "Just now";
  } else if (elapsedMinutes < 60) {
    humanAge = `${elapsedMinutes}m ago`;
  } else if (elapsedMinutes < 1440) {
    const hours = Math.round(elapsedMinutes / 60);
    humanAge = `${hours}h ago`;
  } else {
    const days = Math.round(elapsedMinutes / 1440);
    humanAge = `${days}d ago`;
  }

  return {
    confidence: tier.confidence,
    elapsedMinutes,
    label: tier.label,
    isStale: tier.confidence < 70,
    humanAge,
  };
}
