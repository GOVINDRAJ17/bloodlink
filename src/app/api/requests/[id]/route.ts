import { NextRequest, NextResponse } from "next/server";
import {
  getStoredEmergencyPlan,
  getStoredEmergencyRequest,
  buildResponsePlanForRequest,
  storeEmergencyRequest,
  getOrCreateDemoScenarioPlan,
} from "@/lib/emergency/emergencyStore";
import { createAdminClient } from "@/lib/supabase/server";
import { CITYCARE_HOSPITAL } from "@/lib/emergency/demoSeedData";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    // Special check for demo request
    if (id === "req-demo-citycare-001" || id === "demo") {
      const demo = getOrCreateDemoScenarioPlan();
      return NextResponse.json({
        request: demo.request,
        plan: demo.plan,
        matches: demo.plan.items.map((item) => ({
          _id: item.id,
          candidateId: item.sourceId,
          candidateName: item.name,
          candidateType: item.sourceType,
          bloodGroup: item.bloodGroup,
          distanceKm: item.distanceKm,
          compatTier: "EXACT",
          totalScore: item.totalScore,
          status: item.status === "PROPOSED" ? "NOTIFIED" : item.status,
          allocatedUnits: item.allocatedUnits,
          etaMinutes: item.etaMinutes,
          whyRecommended: item.whyRecommended,
        })),
      });
    }

    // 1. Check in-memory store
    let reqData = getStoredEmergencyRequest(id);
    let plan = getStoredEmergencyPlan(id);

    // 2. If not in memory, query Supabase
    if (!reqData) {
      try {
        const supabase = createAdminClient();
        const { data: dbReq, error } = await supabase
          .from("blood_requests")
          .select("*, hospital_profiles(hospital_name, address, phone)")
          .eq("id", id)
          .single();

        if (!error && dbReq) {
          reqData = dbReq;
          // Parse metadata from additional_message if formatted as JSON
          let meta: any = {};
          try {
            if (dbReq.additional_message && dbReq.additional_message.startsWith("{")) {
              meta = JSON.parse(dbReq.additional_message);
            }
          } catch {
            // ignore
          }

          reqData.component = meta.component || "Packed Red Blood Cells";
          reqData.hospital_name =
            meta.hospital_name ||
            dbReq.hospital_profiles?.hospital_name ||
            "Hospital Facility";
          reqData.hospital_address =
            meta.hospital_address || dbReq.hospital_profiles?.address || "";
          reqData.location = {
            lat: meta.hospital_lat ?? 0,
            lng: meta.hospital_lng ?? 0,
          };
          reqData.deadline_minutes = meta.deadline_minutes || 120;
        }
      } catch (err) {
        console.warn("Supabase fetch failed for request:", id, err);
      }
    }

    // 3. If request was not found, return 404 (allow legitimate demo-req-1)
    if (!reqData) {
      if (id === "demo-req-1") {
        const demo = getOrCreateDemoScenarioPlan();
        reqData = demo.request;
        plan = demo.plan;
      } else {
        return NextResponse.json(
          { error: `Emergency request with id '${id}' not found` },
          { status: 404 }
        );
      }
    }

    // 4. Generate plan if missing
    if (!plan) {
      plan = buildResponsePlanForRequest({
        requestId: id,
        bloodGroup: reqData.blood_group || "O-",
        component: reqData.component || "Platelets",
        unitsRequired: reqData.units_required || 4,
        urgency: reqData.urgency || "CRITICAL",
        hospitalLocation: reqData.location || CITYCARE_HOSPITAL.location,
        hospitalName: reqData.hospital_name || CITYCARE_HOSPITAL.name,
        deadlineMinutes: reqData.deadline_minutes || 90,
      });
    }

    // Map plan items to backward-compatible `matches` array
    const matches = plan.items.map((item) => ({
      _id: item.id,
      candidateId: item.sourceId,
      candidateName: item.name,
      candidateType: item.sourceType,
      bloodGroup: item.bloodGroup,
      distanceKm: item.distanceKm,
      compatTier: "EXACT",
      totalScore: item.totalScore,
      status: item.status === "PROPOSED" ? "NOTIFIED" : item.status,
      allocatedUnits: item.allocatedUnits,
      etaMinutes: item.etaMinutes,
      whyRecommended: item.whyRecommended,
    }));

    return NextResponse.json({
      request: reqData,
      plan,
      matches,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve request details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    // Update in-memory
    const stored = getStoredEmergencyRequest(id);
    if (stored) {
      stored.status = status;
      storeEmergencyRequest(stored);
    }

    // Update Supabase if possible
    try {
      const supabase = createAdminClient();
      await supabase
        .from("blood_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update status" },
      { status: 500 }
    );
  }
}
