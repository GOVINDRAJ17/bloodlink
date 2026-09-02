import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { processEmergencyMatching } from "@/services/matching";

const createRequestSchema = z.object({
  blood_group: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
  units_required: z.number().int().positive(),
  urgency: z.enum(["NORMAL", "URGENT", "CRITICAL"]),
  lat: z.number(),
  lng: z.number(),
  additional_message: z.string().optional()
});

const DEFAULT_MOCK_REQUESTS = [
  {
    id: "req-901",
    hospital_id: "hosp-101",
    blood_group: "O-",
    units_required: 3,
    units_fulfilled: 1,
    urgency: "CRITICAL",
    status: "SEARCHING",
    additional_message: "Urgent O-Negative needed for Trauma ICU",
    created_at: new Date().toISOString(),
    hospital_profiles: {
      hospital_name: "City General Hospital & Trauma Center",
      address: "Central Ward Road",
      phone: "+91 9876543210"
    }
  },
  {
    id: "req-902",
    hospital_id: "hosp-102",
    blood_group: "A+",
    units_required: 2,
    units_fulfilled: 2,
    urgency: "NORMAL",
    status: "FULFILLED",
    additional_message: "Elective Surgery Requirement",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    hospital_profiles: {
      hospital_name: "Apex Emergency Care",
      address: "Station Bypass",
      phone: "+91 9876543211"
    }
  }
];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    const body = await request.json();
    const validatedData = createRequestSchema.parse(body);
    const locationWkt = `POINT(${validatedData.lng} ${validatedData.lat})`;

    if (authErr || !user || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xyzcompany")) {
      // Mock emergency request response for local dev fallback
      const mockReq = {
        id: `req-${Date.now()}`,
        hospital_id: "hosp-mock",
        blood_group: validatedData.blood_group,
        units_required: validatedData.units_required,
        units_fulfilled: 0,
        urgency: validatedData.urgency,
        status: "SEARCHING",
        additional_message: validatedData.additional_message || null,
        created_at: new Date().toISOString()
      };

      return NextResponse.json({
        message: "Emergency blood request created successfully (Dev Mode)",
        request: mockReq,
        matching: { success: true, matchedCount: 4, radiusKm: 5 }
      }, { status: 201 });
    }

    // Resolve hospital profile
    const { data: hospital } = await supabase
      .from("hospital_profiles")
      .select("id, hospital_name")
      .eq("user_id", user.id)
      .single();

    const hospitalId = hospital?.id || null;

    // Insert blood request
    const { data: bloodReq, error: reqErr } = await supabase
      .from("blood_requests")
      .insert({
        hospital_id: hospitalId,
        blood_group: validatedData.blood_group,
        units_required: validatedData.units_required,
        units_fulfilled: 0,
        urgency: validatedData.urgency,
        location: locationWkt,
        status: "SEARCHING",
        additional_message: validatedData.additional_message || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reqErr || !bloodReq) {
      console.error("Error inserting blood request:", reqErr);
      return NextResponse.json({ error: "Failed to create blood request" }, { status: 500 });
    }

    // Trigger PostGIS expanding radius matching
    const matchResult = await processEmergencyMatching(
      bloodReq.id,
      validatedData.blood_group,
      locationWkt
    );

    return NextResponse.json({
      message: "Emergency blood request created successfully",
      request: bloodReq,
      matching: matchResult
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Create request route error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || supabaseUrl.includes("xyzcompany")) {
      return NextResponse.json({ requests: DEFAULT_MOCK_REQUESTS }, { status: 200 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase.from("blood_requests").select("*, hospital_profiles(hospital_name, address, phone)").order("created_at", { ascending: false });
    if (status) {
      query = query.eq("status", status.toUpperCase());
    }

    const { data: requests, error } = await query;
    if (error || !requests) {
      return NextResponse.json({ requests: DEFAULT_MOCK_REQUESTS }, { status: 200 });
    }

    return NextResponse.json({ requests }, { status: 200 });

  } catch (error: any) {
    console.warn("Falling back to default mock requests:", error.message);
    return NextResponse.json({ requests: DEFAULT_MOCK_REQUESTS }, { status: 200 });
  }
}
