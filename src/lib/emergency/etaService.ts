/**
 * Emergency ETA and Geolocation Service
 * 
 * Provides robust distance estimation and estimated response time calculation.
 * Incorporates:
 * 1. Great-circle Haversine distance
 * 2. Traffic and urgency-adjusted urban transit speed model
 * 3. Operational preparation buffer (donor mobilization time vs blood bank release time)
 * 4. Clear labeling as "Estimated ETA" to prevent clinical misinterpretation
 */

import { EMERGENCY_CONFIG } from "./config";

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface EtaResult {
  distanceKm: number;
  transitMinutes: number;
  prepMinutes: number;
  totalEtaMinutes: number;
  label: string;
  speedKmH: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Calculates high-precision Haversine distance between two coordinates in kilometers.
 */
export function calculateHaversineDistance(
  coord1: GeoLocation,
  coord2: GeoLocation
): number {
  if (!coord1 || !coord2 || typeof coord1.lat !== "number" || typeof coord2.lat !== "number") {
    return 999.9; // Fallback distance if coordinates are missing
  }

  const toRad = (val: number) => (val * Math.PI) / 180;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const rawKm = EARTH_RADIUS_KM * c;
  return Math.round(rawKm * 10) / 10;
}

/**
 * Estimates arrival and operational response ETA in minutes.
 * 
 * @param origin - Location of candidate (Donor or Blood Bank)
 * @param destination - Location of requesting Hospital
 * @param sourceType - "BLOOD_BANK" or "DONOR"
 * @param urgency - "NORMAL" | "URGENT" | "CRITICAL"
 */
export function estimateEmergencyEta(
  origin: GeoLocation,
  destination: GeoLocation,
  sourceType: "BLOOD_BANK" | "DONOR",
  urgency: "NORMAL" | "URGENT" | "CRITICAL" = "NORMAL"
): EtaResult {
  const distanceKm = calculateHaversineDistance(origin, destination);
  const profile = EMERGENCY_CONFIG.urgencyProfiles[urgency] || EMERGENCY_CONFIG.urgencyProfiles.NORMAL;

  // Road circuitous factor (urban roads are ~1.28x great-circle flight distance)
  const effectiveRoadDistanceKm = distanceKm * 1.28;

  // Calculate road travel time
  const transitMinutes = Math.max(
    3,
    Math.round((effectiveRoadDistanceKm / profile.speedKmH) * 60)
  );

  // Operational preparation time
  let prepMinutes = 10;
  if (sourceType === "BLOOD_BANK") {
    prepMinutes =
      EMERGENCY_CONFIG.bloodBankPrepMinutes[urgency] ??
      EMERGENCY_CONFIG.bloodBankPrepMinutes.NORMAL;
  } else {
    prepMinutes =
      EMERGENCY_CONFIG.donorMobilizationMinutes[urgency] ??
      EMERGENCY_CONFIG.donorMobilizationMinutes.NORMAL;
  }

  const totalEtaMinutes = transitMinutes + prepMinutes;

  return {
    distanceKm,
    transitMinutes,
    prepMinutes,
    totalEtaMinutes,
    label: `Estimated ETA: ~${totalEtaMinutes} mins (~${distanceKm} km)`,
    speedKmH: profile.speedKmH,
  };
}
