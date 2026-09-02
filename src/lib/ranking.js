import { checkBloodCompatibility } from "./compatibility.js";

/**
 * Calculates the great-circle distance between two points in kilometers using the Haversine formula.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Evaluates donor medical eligibility based on screening criteria.
 */
export function evaluateDonorEligibility(userDoc) {
  if (!userDoc) return { eligible: false, reason: "User profile missing" };
  const details = userDoc.details || userDoc;

  if (!details.isDonor) {
    return { eligible: false, reason: "User is not registered as a donor" };
  }

  const donorDetails = details.donorDetails || {};
  
  if (donorDetails.recentTattoo) return { eligible: false, reason: "Recent tattoo within 6 months" };
  if (donorDetails.pregnant) return { eligible: false, reason: "Currently pregnant/lactating" };
  if (donorDetails.underweight) return { eligible: false, reason: "Body weight below donor threshold" };
  if (donorDetails.hasDisease) return { eligible: false, reason: "Medical condition flag" };

  // Check 90-day donation interval rule
  if (donorDetails.lastDonationDate) {
    const lastDate = new Date(donorDetails.lastDonationDate);
    const diffDays = (new Date() - lastDate) / (1000 * 60 * 60 * 24);
    if (diffDays < 90) {
      return { 
        eligible: false, 
        reason: `Donated ${Math.round(diffDays)} days ago (requires 90-day interval)` 
      };
    }
  }

  return { eligible: true, reason: "Eligible for blood donation" };
}

/**
 * Score and rank candidate donors & blood banks for an emergency request.
 * 
 * @param {object} request - Emergency request object containing { bloodGroup, urgency, location: { coordinates: [lng, lat] } }
 * @param {Array} donors - List of donor user documents from MongoDB
 * @param {Array} bloodBanks - List of blood bank inventory objects (e.g. from eRaktKosh API)
 * @returns {Array} Sorted list of ranked candidates
 */
export function rankCandidates(request, donors = [], bloodBanks = []) {
  const reqLat = request.location?.coordinates?.[1] ?? request.lat;
  const reqLng = request.location?.coordinates?.[0] ?? request.lng;
  const reqBloodGroup = request.bloodGroup;
  const urgency = (request.urgency || "MEDIUM").toUpperCase();

  const urgencyMultiplier = {
    CRITICAL: 1.3,
    HIGH: 1.15,
    MEDIUM: 1.0,
    LOW: 0.95
  }[urgency] || 1.0;

  const rankedCandidates = [];

  // 1. Process & score registered individual donors
  for (const donorDoc of donors) {
    const details = donorDoc.details || {};
    const donorGroup = details.bloodGroupId || details.bloodGroup;
    
    // Check medical eligibility
    const eligibility = evaluateDonorEligibility(donorDoc);
    if (!eligibility.eligible) continue;

    // Check blood compatibility
    const compat = checkBloodCompatibility(reqBloodGroup, donorGroup);
    if (!compat.isCompatible) continue;

    const donorLat = details.location?.lat || details.lat || donorDoc.lat;
    const donorLng = details.location?.lng || details.lng || donorDoc.lng;
    
    // Calculate distance
    const distKm = (donorLat !== undefined && donorLng !== undefined)
      ? calculateHaversineDistance(reqLat, reqLng, donorLat, donorLng)
      : 25.0; // fallback estimated distance if location unspecified

    // Distance decay score: 100 * e^(-0.05 * distKm)
    const distScore = Math.min(100, Math.max(0, 100 * Math.exp(-0.05 * distKm)));

    // Composite score computation
    const totalScore = Number(((0.55 * compat.score + 0.45 * distScore) * urgencyMultiplier).toFixed(1));

    rankedCandidates.push({
      candidateId: donorDoc.email || String(donorDoc._id),
      candidateType: "DONOR",
      candidateName: details.fullName || donorDoc.name || "Anonymous Donor",
      bloodGroup: compat.tier === "EXACT" ? reqBloodGroup : donorGroup,
      distanceKm: distKm,
      compatibilityScore: compat.score,
      totalScore,
      compatTier: compat.tier,
      // PRIVACY SHIELD: Do not expose exact donor phone or raw coordinates to public endpoints
      privacyMasked: true
    });
  }

  // 2. Process & score blood banks (e.g. eRaktKosh inventory)
  for (const bank of bloodBanks) {
    const bankGroup = bank.bloodGroup || bank.group;
    const compat = checkBloodCompatibility(reqBloodGroup, bankGroup || reqBloodGroup);
    if (!compat.isCompatible) continue;

    const bankLat = bank.latitude || bank.lat;
    const bankLng = bank.longitude || bank.lng;
    const distKm = bank.dist 
      ? Number((bank.dist / 1000).toFixed(2)) 
      : calculateHaversineDistance(reqLat, reqLng, bankLat, bankLng);

    const distScore = Math.min(100, Math.max(0, 100 * Math.exp(-0.05 * distKm)));
    const totalScore = Number(((0.60 * compat.score + 0.40 * distScore) * urgencyMultiplier).toFixed(1));

    rankedCandidates.push({
      candidateId: String(bank.hospitalCode || bank.id || bank.hospitalname),
      candidateType: "BLOOD_BANK",
      candidateName: bank.hospitalname || bank.name || "Regional Blood Bank",
      hospitalAddress: bank.hospitaladd || bank.address || "",
      bloodGroup: bankGroup || reqBloodGroup,
      distanceKm: distKm,
      compatibilityScore: compat.score,
      totalScore,
      compatTier: compat.tier,
      privacyMasked: false
    });
  }

  // Sort descending by totalScore
  rankedCandidates.sort((a, b) => b.totalScore - a.totalScore);
  return rankedCandidates;
}
