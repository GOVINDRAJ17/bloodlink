/**
 * Donor Location & Contact Privacy Shield
 * 
 * Guarantees that individual donor exact home coordinates and personal contact phone
 * numbers are stripped from public API payloads. Exposes calculated distance (~X.X km)
 * until a match is explicitly ACCEPTED by both parties.
 */

export function sanitizeCandidatePrivacy(candidate) {
  if (!candidate) return candidate;

  // Donors require privacy masking prior to match confirmation
  if (candidate.candidateType === "DONOR" && candidate.status !== "ACCEPTED") {
    const { lat, lng, phone, contactPhone, exactLocation, ...safeCandidate } = candidate;
    return {
      ...safeCandidate,
      distanceKm: candidate.distanceKm,
      privacyMasked: true
    };
  }

  // Blood banks or accepted donor matches return standard info
  return candidate;
}

export function sanitizeMatchList(matches = []) {
  return (matches || []).map(sanitizeCandidatePrivacy);
}
