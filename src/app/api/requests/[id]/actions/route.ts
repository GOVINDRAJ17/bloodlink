import { NextRequest, NextResponse } from "next/server";
import {
  getStoredEmergencyPlan,
  storeEmergencyPlan,
  updateCandidateStock,
  getStoredEmergencyRequest,
} from "@/lib/emergency/emergencyStore";
import { dispatchNotification } from "@/lib/notifications/orchestrator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { planItemId, action } = body;

    if (!planItemId || !action) {
      return NextResponse.json(
        { error: "planItemId and action ('RESERVE' | 'CONTACT') are required" },
        { status: 400 }
      );
    }

    const plan = getStoredEmergencyPlan(id);
    if (!plan) {
      return NextResponse.json(
        { error: "Emergency plan not found for this request" },
        { status: 404 }
      );
    }

    const item = plan.items.find((i) => i.id === planItemId);
    if (!item) {
      return NextResponse.json(
        { error: "Plan item not found in the emergency plan" },
        { status: 404 }
      );
    }

    const reqData = getStoredEmergencyRequest(id);
    const hospitalName = reqData?.hospital_name || "Emergency Department";

    if (action === "RESERVE") {
      item.status = "RESERVED";
      // Update inventory stock on hand
      updateCandidateStock(item.sourceId, -item.allocatedUnits);

      // Dispatch simulated notification to blood bank
      await dispatchNotification({
        userId: item.sourceId,
        type: "EMERGENCY_RESERVATION",
        title: `Emergency Blood Reservation: ${item.allocatedUnits} units ${item.bloodGroup}`,
        message: `${hospitalName} has placed an urgent reservation for ${item.allocatedUnits} units of ${item.bloodGroup} ${plan.component}.`,
      });
    } else if (action === "CONTACT") {
      item.status = "CONTACTED";

      // Dispatch emergency alert notification to donor
      await dispatchNotification({
        userId: item.sourceId,
        type: "DONOR_EMERGENCY_MOBILIZATION",
        title: `Urgent Blood Needed: ${item.bloodGroup} at ${hospitalName}`,
        message: `An emergency patient requires your ${item.bloodGroup} blood donation. Estimated travel distance is ~${item.distanceKm} km. Please confirm your availability immediately.`,
      });
    }

    // Save updated plan back to store
    storeEmergencyPlan(plan);

    return NextResponse.json({
      success: true,
      message: `${action} action completed successfully for ${item.name}`,
      item,
      plan,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to process emergency action" },
      { status: 500 }
    );
  }
}
