import { NextResponse } from "next/server";
import { resetCandidatePool, getOrCreateDemoScenarioPlan, getActiveCandidates } from "@/lib/emergency/emergencyStore";
import { createAdminClient } from "@/lib/supabase/server";
import { CITYCARE_HOSPITAL, DEMO_BLOOD_BANKS, DEMO_DONORS } from "@/lib/emergency/demoSeedData";

export async function POST() {
  try {
    // 1. Reset in-memory cache
    resetCandidatePool();
    const demo = getOrCreateDemoScenarioPlan();

    // 2. Attempt to seed to Supabase if credentials are valid
    let supabaseSuccess = false;
    let supabaseError = null;

    try {
      const supabase = createAdminClient();

      // Check if CityCare hospital exists, or insert
      const { data: existingHosp } = await supabase
        .from("hospital_profiles")
        .select("id")
        .eq("hospital_name", CITYCARE_HOSPITAL.name)
        .limit(1);

      let hospitalId = existingHosp?.[0]?.id;

      if (!hospitalId) {
        const { data: newHosp } = await supabase
          .from("hospital_profiles")
          .insert({
            hospital_name: CITYCARE_HOSPITAL.name,
            phone: CITYCARE_HOSPITAL.phone,
            address: CITYCARE_HOSPITAL.address,
            verified: true,
          })
          .select("id")
          .single();
        hospitalId = newHosp?.id;
      }

      // Check if demo request exists in Supabase, or insert
      const { data: existingReq } = await supabase
        .from("blood_requests")
        .select("id")
        .eq("id", demo.request.id)
        .limit(1);

      if (!existingReq || existingReq.length === 0) {
        await supabase.from("blood_requests").insert({
          id: demo.request.id,
          hospital_id: hospitalId || null,
          blood_group: "O-",
          units_required: 4,
          units_fulfilled: 0,
          urgency: "CRITICAL",
          status: "SEARCHING",
          additional_message: JSON.stringify({
            component: "Platelets",
            deadline_minutes: 90,
            hospital_name: CITYCARE_HOSPITAL.name,
            hospital_address: CITYCARE_HOSPITAL.address,
            hospital_lat: CITYCARE_HOSPITAL.location.lat,
            hospital_lng: CITYCARE_HOSPITAL.location.lng,
            note: demo.request.additional_message,
          }),
        });
      }

      supabaseSuccess = true;
    } catch (sbErr: any) {
      supabaseError = sbErr?.message || "Supabase seed bypassed";
    }

    const active = getActiveCandidates();

    return NextResponse.json({
      success: true,
      message: "Emergency demo dataset initialized successfully.",
      supabaseSynced: supabaseSuccess,
      supabaseError,
      demoRequestId: demo.request.id,
      bloodBanksCount: active.filter((c) => c.sourceType === "BLOOD_BANK").length,
      donorsCount: active.filter((c) => c.sourceType === "DONOR").length,
      demoPlanSummary: {
        unitsRequired: demo.plan.totalUnitsRequired,
        unitsPlanned: demo.plan.totalUnitsPlanned,
        searchRadiusKm: demo.plan.searchRadiusKm,
        estimatedMinutes: demo.plan.estimatedResponseMinutes,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to seed demo data" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
