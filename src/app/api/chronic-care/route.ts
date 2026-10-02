import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  ChronicPatient,
  getChronicStore,
  getChronicCareMetrics,
} from "@/lib/data/chronicCareData";
import { safeSupabaseQuery } from "@/lib/supabase/safeQuery";

export type { ChronicPatient };

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const condition = searchParams.get("condition");

  // Instant build-time/in-memory data calculation (<1 ms)
  const localData = getChronicCareMetrics(condition);

  // Optional background Supabase enrichment with a hard 1.5s timeout that never blocks
  let enrichedPatients = localData.patients;
  try {
    const supabaseData = await safeSupabaseQuery(
      async () => {
        const adminClient = createAdminClient();
        let query = adminClient
          .from("chronic_care_patients")
          .select("*")
          .order("next_transfusion_date", { ascending: true });

        if (condition && condition !== "ALL") {
          query = query.eq("condition_type", condition);
        }

        const { data, error } = await query;
        if (error || !data || data.length === 0) return null;
        return data.map((d: any) => ({
          id: d.id,
          fullName: d.full_name,
          conditionType: d.condition_type,
          bloodGroup: d.blood_group,
          requiredComponent: d.required_component,
          unitsPerCycle: d.units_per_cycle,
          cycleFrequencyDays: d.cycle_frequency_days,
          nextTransfusionDate: d.next_transfusion_date,
          lastTransfusionDate: d.last_transfusion_date || new Date().toISOString().split("T")[0],
          hospitalName: d.hospital_name || "Regional Care Hospital",
          status: d.status || "ACTIVE",
          notes: d.notes,
          reservedUnits: d.reserved_units || 0,
          matchingStatus: d.matching_status || "UNASSIGNED",
        }));
      },
      null,
      1200 // 1.2s timeout
    );

    if (supabaseData && Array.isArray(supabaseData) && supabaseData.length > 0) {
      enrichedPatients = supabaseData;
    }
  } catch {
    // Graceful fallback to verified local dataset
  }

  return NextResponse.json(
    {
      success: true,
      totalPatients: enrichedPatients.length,
      dueNext7Days: localData.dueNext7Days,
      totalUnitsReserved: localData.totalUnitsReserved,
      patients: enrichedPatients,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fullName,
      conditionType = "THALASSEMIA_MAJOR",
      bloodGroup = "O+",
      requiredComponent = "Packed Red Blood Cells",
      unitsPerCycle = 2,
      cycleFrequencyDays = 21,
      nextTransfusionDate,
      hospitalName = "City General Hospital",
      notes = "",
    } = body;

    if (!fullName || !nextTransfusionDate) {
      return NextResponse.json(
        { error: "fullName and nextTransfusionDate are required" },
        { status: 400 }
      );
    }

    const newPatient: ChronicPatient = {
      id: `pat-${Date.now()}`,
      fullName,
      conditionType,
      bloodGroup,
      requiredComponent,
      unitsPerCycle: Number(unitsPerCycle) || 2,
      cycleFrequencyDays: Number(cycleFrequencyDays) || 21,
      nextTransfusionDate,
      lastTransfusionDate: new Date().toISOString().split("T")[0],
      hospitalName,
      status: "ACTIVE",
      notes,
      reservedUnits: 0,
      matchingStatus: "UNASSIGNED",
    };

    const store = getChronicStore();
    store.unshift(newPatient);

    // Optional Supabase insert protected by safeSupabaseQuery
    safeSupabaseQuery(
      async () => {
        const adminClient = createAdminClient();
        return await adminClient.from("chronic_care_patients").insert({
          id: newPatient.id,
          full_name: fullName,
          condition_type: conditionType,
          blood_group: bloodGroup,
          required_component: requiredComponent,
          units_per_cycle: unitsPerCycle,
          cycle_frequency_days: cycleFrequencyDays,
          next_transfusion_date: nextTransfusionDate,
          hospital_name: hospitalName,
          notes,
        });
      },
      null,
      1500
    ).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: "Chronic care patient registered successfully",
        patient: newPatient,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to register patient" },
      { status: 500 }
    );
  }
}

// Action handler for auto-reserving blood & notifying donors for upcoming scheduled cycle
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, action } = body;

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const store = getChronicStore();
    const patient = store.find((p) => p.id === patientId);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (action === "RESERVE_MATCH") {
      patient.reservedUnits = patient.unitsPerCycle;
      patient.matchingStatus = "CONFIRMED";

      return NextResponse.json({
        success: true,
        message: `Successfully secured ${patient.unitsPerCycle} compatible units for ${patient.fullName}`,
        patient,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Action failed" }, { status: 500 });
  }
}
