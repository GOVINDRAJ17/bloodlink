import { NextRequest, NextResponse } from "next/server";
import {
  getStoredEmergencyRequest,
  buildResponsePlanForRequest,
} from "@/lib/emergency/emergencyStore";
import { CITYCARE_HOSPITAL } from "@/lib/emergency/demoSeedData";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const plan = buildResponsePlanForRequest({
      requestId: id,
      bloodGroup: reqData.blood_group || "O-",
      component: reqData.component || "Platelets",
      unitsRequired: reqData.units_required || 4,
      urgency: reqData.urgency || "CRITICAL",
      hospitalLocation: reqData.location || CITYCARE_HOSPITAL.location,
      hospitalName: reqData.hospital_name || CITYCARE_HOSPITAL.name,
      deadlineMinutes: reqData.deadline_minutes || 90,
    });

    return NextResponse.json({
      success: true,
      message: "Emergency response plan generated successfully",
      plan,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to find emergency response" },
      { status: 500 }
    );
  }
}
