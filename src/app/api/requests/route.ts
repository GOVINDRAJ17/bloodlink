import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { processEmergencyMatching } from "@/services/matching";
import {
  buildResponsePlanForRequest,
  storeEmergencyRequest,
  getOrCreateDemoScenarioPlan,
} from "@/lib/emergency/emergencyStore";
import { CITYCARE_HOSPITAL } from "@/lib/emergency/demoSeedData";

const createRequestSchema = z.object({
  blood_group: z.string().min(1, "Blood group is required"),
  component: z.string().optional().default("Packed Red Blood Cells"),
  units_required: z.coerce.number().int().positive("Units required must be greater than 0"),
  urgency: z.enum(["NORMAL", "URGENT", "CRITICAL"]).optional().default("NORMAL"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  hospital_name: z.string().min(1, "Hospital name is required"),
  hospital_address: z.string().optional().default(""),
  deadline_minutes: z.coerce.number().optional().default(90),
  additional_message: z.string().optional().default("Emergency blood dispatch requested"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = createRequestSchema.parse(body);
    const locationWkt = `POINT(${validatedData.lng} ${validatedData.lat})`;
    const requestId = `req-${Date.now()}`;

    // Construct enriched request object
    const emergencyReqObj = {
      id: requestId,
      hospital_name: validatedData.hospital_name,
      hospital_address: validatedData.hospital_address || "",
      blood_group: validatedData.blood_group,
      component: validatedData.component,
      units_required: validatedData.units_required,
      units_fulfilled: 0,
      urgency: validatedData.urgency,
      deadline_minutes: validatedData.deadline_minutes,
      status: "SEARCHING",
      location: { lat: validatedData.lat, lng: validatedData.lng },
      additional_message: validatedData.additional_message,
      created_at: new Date().toISOString(),
    };

    // Store in memory cache
    storeEmergencyRequest(emergencyReqObj);

    // Run the Emergency Blood Response Engine to generate the response plan immediately
    const emergencyPlan = buildResponsePlanForRequest({
      requestId,
      bloodGroup: validatedData.blood_group,
      component: validatedData.component,
      unitsRequired: validatedData.units_required,
      urgency: validatedData.urgency,
      hospitalLocation: { lat: validatedData.lat, lng: validatedData.lng },
      hospitalName: validatedData.hospital_name,
      deadlineMinutes: validatedData.deadline_minutes,
    });

    // Best-effort insert into Supabase database
    try {
      const adminClient = createAdminClient();
      await adminClient.from("blood_requests").insert({
        id: requestId,
        blood_group: validatedData.blood_group,
        units_required: validatedData.units_required,
        units_fulfilled: 0,
        urgency: validatedData.urgency,
        location: locationWkt,
        status: "SEARCHING",
        additional_message: JSON.stringify({
          component: validatedData.component,
          hospital_name: validatedData.hospital_name,
          hospital_address: validatedData.hospital_address,
          deadline_minutes: validatedData.deadline_minutes,
          hospital_lat: validatedData.lat,
          hospital_lng: validatedData.lng,
          note: validatedData.additional_message,
        }),
        created_at: emergencyReqObj.created_at,
      });

      // Also trigger legacy matching background task if possible
      processEmergencyMatching(requestId, validatedData.blood_group, locationWkt).catch(() => {});
    } catch (sbErr) {
      console.warn("Supabase persistence bypassed for request:", sbErr);
    }

    return NextResponse.json(
      {
        message: "Emergency blood request created and response plan generated successfully",
        request: emergencyReqObj,
        plan: emergencyPlan,
        matching: {
          success: true,
          alertedDonors: emergencyPlan.items.filter((i) => i.sourceType === "DONOR").length,
          radiusKm: emergencyPlan.searchRadiusKm,
          timestamp: emergencyPlan.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Create request route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status");
    const filterUrgency = searchParams.get("urgency");

    const demo = getOrCreateDemoScenarioPlan();
    const resultList: any[] = [];

    // Add demo request first
    resultList.push({
      id: demo.request.id,
      blood_group: demo.request.blood_group,
      component: demo.request.component,
      units_required: demo.request.units_required,
      units_fulfilled: demo.request.units_fulfilled,
      urgency: demo.request.urgency,
      status: demo.request.status,
      additional_message: demo.request.additional_message,
      created_at: demo.request.created_at,
      hospital_profiles: {
        hospital_name: demo.request.hospital_name,
        address: demo.request.hospital_address,
        phone: CITYCARE_HOSPITAL.phone,
      },
    });

    // Query Supabase for any other requests
    try {
      const supabase = await createClient();
      let query = supabase
        .from("blood_requests")
        .select(
          "id, hospital_id, blood_group, units_required, units_fulfilled, urgency, status, additional_message, created_at, hospital_profiles(hospital_name, address, phone)"
        )
        .order("created_at", { ascending: false });

      if (filterStatus) {
        query = query.eq("status", filterStatus.toUpperCase());
      }
      if (filterUrgency) {
        query = query.eq("urgency", filterUrgency.toUpperCase());
      }

      const { data: dbRequests } = await query;
      if (dbRequests && Array.isArray(dbRequests)) {
        for (const req of dbRequests) {
          if (req.id !== demo.request.id) {
            resultList.push(req);
          }
        }
      }
    } catch {
      // Supabase query fallback
    }

    // Apply client filters on the final list if set
    let filtered = resultList;
    if (filterStatus) {
      filtered = filtered.filter(
        (r) => (r.status || "").toUpperCase() === filterStatus.toUpperCase()
      );
    }
    if (filterUrgency) {
      filtered = filtered.filter(
        (r) => (r.urgency || "").toUpperCase() === filterUrgency.toUpperCase()
      );
    }

    return NextResponse.json({ requests: filtered }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ requests: [] }, { status: 200 });
  }
}
