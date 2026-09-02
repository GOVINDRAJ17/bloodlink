export interface DonorCandidate {
  donorId: string;
  bloodGroup: string;
  distanceMeters: number;
  available: boolean;
  reliabilityScore: number;
  lastDonationDate: string | null;
}

export const MATCH_WEIGHTS = {
  compatibility: 0.40,
  distance:      0.25,
  availability:  0.15,
  reliability:   0.10,
  eligibility:   0.10,
};

export function computeMatchScore(candidate: DonorCandidate): number {
  const compatibilityScore = 100;
  const distanceScore = Math.max(0, 100 - (candidate.distanceMeters / 500));
  const availabilityScore = candidate.available ? 100 : 0;
  const reliabilityScore = Number(candidate.reliabilityScore || 100);
  const eligibilityScore = isEligible(candidate.lastDonationDate) ? 100 : 0;

  const totalScore = (
    compatibilityScore * MATCH_WEIGHTS.compatibility +
    distanceScore      * MATCH_WEIGHTS.distance +
    availabilityScore  * MATCH_WEIGHTS.availability +
    reliabilityScore   * MATCH_WEIGHTS.reliability +
    eligibilityScore   * MATCH_WEIGHTS.eligibility
  );

  return Number(totalScore.toFixed(2));
}

export function isEligible(lastDonationDate: string | null): boolean {
  if (!lastDonationDate) return true;
  const daysSince = (Date.now() - new Date(lastDonationDate).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= 90;
}
