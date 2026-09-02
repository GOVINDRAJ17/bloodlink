import { createAdminClient } from "@/lib/supabase/server";
import { getCompatibleDonorGroups } from "@/lib/matching/compatibility";
import { computeMatchScore, type DonorCandidate } from "@/lib/matching/scorer";

const EXPANDING_RADII_METERS = [5000, 10000, 20000, 50000];

export async function processEmergencyMatching(requestId: string, recipientBloodGroup: string, requestLocationWkt: string) {
  const supabase = createAdminClient();
  const compatibleGroups = getCompatibleDonorGroups(recipientBloodGroup);

  let foundDonors: any[] = [];
  let matchedRadiusMeters = 0;

  // Expanding radius search: 5km -> 10km -> 20km -> 50km
  for (const radiusMeters of EXPANDING_RADII_METERS) {
    const { data: donors, error } = await supabase.rpc("find_nearby_donors", {
      request_location: requestLocationWkt,
      blood_groups: compatibleGroups,
      radius_meters: radiusMeters,
      limit_count: 20
    });

    if (error) {
      console.error(`PostGIS geo search error at radius ${radiusMeters}m:`, error);
      continue;
    }

    if (donors && donors.length > 0) {
      foundDonors = donors;
      matchedRadiusMeters = radiusMeters;
      break;
    }
  }

  if (foundDonors.length === 0) {
    // Flag request as no donors found
    await supabase
      .from("blood_requests")
      .update({ status: "SEARCHING", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    return { success: false, matchedCount: 0, message: "No compatible donors found within 50 km radius" };
  }

  // Score and rank candidates
  const scoredCandidates = foundDonors.map((d: any) => {
    const candidateObj: DonorCandidate = {
      donorId: d.donor_id,
      bloodGroup: d.blood_group,
      distanceMeters: d.distance_meters,
      available: d.available,
      reliabilityScore: Number(d.reliability_score || 100),
      lastDonationDate: null
    };

    const score = computeMatchScore(candidateObj);
    return {
      request_id: requestId,
      donor_id: d.donor_id,
      match_score: score,
      distance_km: Number((d.distance_meters / 1000).toFixed(2)),
      status: "NOTIFIED",
      notified_at: new Date().toISOString()
    };
  });

  // Insert candidate responses
  const { error: insertErr } = await supabase
    .from("donor_responses")
    .insert(scoredCandidates);

  if (insertErr) {
    console.error("Error inserting donor responses:", insertErr);
  }

  // Update request status to NOTIFIED
  await supabase
    .from("blood_requests")
    .update({ status: "NOTIFIED", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  return {
    success: true,
    matchedCount: scoredCandidates.length,
    radiusKm: matchedRadiusMeters / 1000,
    candidates: scoredCandidates
  };
}
