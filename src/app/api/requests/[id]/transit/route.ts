import { NextRequest, NextResponse } from "next/server";
import { getStoredEmergencyRequest, storeEmergencyRequest } from "@/lib/emergency/emergencyStore";
import { calculateHaversineDistance, estimateEmergencyEta } from "@/lib/emergency/etaService";
import { getAllDemoCandidates } from "@/lib/emergency/demoSeedData";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      lat,
      lng,
      speedKmH = 45,
      heading = 90,
      vehicleId = "AMBULANCE-ICU-04",
      destination = "District Emergency Trauma Center",
    } = body;

    if (!lat || !lng) {
      return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
    }

    const currentCoords = { lat: Number(lat), lng: Number(lng) };
    const locationWkt = `POINT(${currentCoords.lng} ${currentCoords.lat})`;

    // Fetch existing or initialize request
    const existing = getStoredEmergencyRequest(id) || {
      id,
      blood_group: "O-",
      component: "Packed Red Blood Cells",
      urgency: "CRITICAL",
      units_required: 2,
    };

    const transitData = {
      ...existing,
      isInTransit: true,
      vehicleId,
      transitDestination: destination,
      currentSpeedKmH: speedKmH,
      heading,
      currentLocation: currentCoords,
      lastTelemetryAt: new Date().toISOString(),
    };

    storeEmergencyRequest(transitData);

    // Compute real-time distances & ETAs from current moving coordinates to all nearby blood banks & hospitals
    const candidates = getAllDemoCandidates();
    const liveRankedResources = candidates
      .filter((c) => c.bloodGroup === existing.blood_group || existing.blood_group === "O-")
      .map((c) => {
        const distKm = calculateHaversineDistance(currentCoords, c.location);
        const eta = estimateEmergencyEta(currentCoords, c.location, c.sourceType, (existing.urgency as any) || "CRITICAL");
        return {
          id: c.id,
          name: c.name,
          sourceType: c.sourceType,
          bloodGroup: c.bloodGroup,
          distanceKm: distKm,
          etaMinutes: eta.totalEtaMinutes,
          travelMinutes: eta.transitMinutes,
          prepMinutes: eta.prepMinutes,
          availableUnits: c.availableUnits,
        };
      })
      .sort((a, b) => a.etaMinutes - b.etaMinutes)
      .slice(0, 5);

    // Best-effort Supabase sync
    try {
      const adminClient = createAdminClient();
      await adminClient.from("blood_requests").update({
        location: locationWkt,
        is_in_transit: true,
        vehicle_id: vehicleId,
        transit_destination: destination,
        current_speed_kmh: speedKmH,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
    } catch {
      // Local fallback active
    }

    return NextResponse.json({
      success: true,
      requestId: id,
      telemetry: {
        vehicleId,
        destination,
        currentLocation: currentCoords,
        speedKmH,
        heading,
        lastTelemetryAt: transitData.lastTelemetryAt,
      },
      nearestResources: liveRankedResources,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "In-transit telemetry update failed" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stored = getStoredEmergencyRequest(id);
  if (!stored) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    request: stored,
  });
}
