import { NextRequest, NextResponse } from "next/server";
import {
  getStoredEmergencyRequest,
  setCandidateAvailability,
  buildResponsePlanForRequest,
  getStoredEmergencyPlan,
} from "@/lib/emergency/emergencyStore";
import { CITYCARE_HOSPITAL } from "@/lib/emergency/demoSeedData";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // empty body is acceptable
    }

    const { toggleUnavailableId, excludeSourceId } = body;

    // If simulating unavailability for a resource (e.g. Blood Bank A during demo)
    if (toggleUnavailableId) {
      setCandidateAvailability(toggleUnavailableId, false);
    }

    const excludedList: string[] = [];
    if (toggleUnavailableId) excludedList.push(toggleUnavailableId);
    if (excludeSourceId) excludedList.push(excludeSourceId);

    const reqData = getStoredEmergencyRequest(id) || {
      id,
      blood_group: "O-",
      component: "Platelets",
      units_required: 4,
      urgency: "CRITICAL",
      location: CITYCARE_HOSPITAL.location,
      hospital_name: CITYCARE_HOSPITAL.name,
      deadline_minutes: 90,
    };

    const updatedPlan = buildResponsePlanForRequest(
      {
        requestId: id,
        bloodGroup: reqData.blood_group || "O-",
        component: reqData.component || "Platelets",
        unitsRequired: reqData.units_required || 4,
        urgency: reqData.urgency || "CRITICAL",
        hospitalLocation: reqData.location || CITYCARE_HOSPITAL.location,
        hospitalName: reqData.hospital_name || CITYCARE_HOSPITAL.name,
        deadlineMinutes: reqData.deadline_minutes || 90,
      },
      excludedList
    );

    return NextResponse.json({
      success: true,
      message: toggleUnavailableId
        ? `Recalculated after marking resource ${toggleUnavailableId} unavailable`
        : "Emergency plan recalculated successfully",
      plan: updatedPlan,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to recalculate emergency plan" },
      { status: 500 }
    );
  }
}
