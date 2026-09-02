import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || supabaseUrl.includes("xyzcompany")) {
      // Mock Map Layers Payload
      return NextResponse.json({
        layers: [
          { id: "hospitals", name: "Nearby Hospitals", count: 12, enabled: true },
          { id: "blood_banks", name: "Blood Banks & Storage", count: 6, enabled: true },
          { id: "active_requests", name: "Emergency Dispatches", count: 4, enabled: true }
        ]
      }, { status: 200 });
    }

    const supabase = await createClient();

    const [hospRes, bankRes, reqRes] = await Promise.all([
      supabase.from("hospital_profiles").select("id", { count: "exact" }),
      supabase.from("blood_bank_profiles").select("id", { count: "exact" }),
      supabase.from("blood_requests").select("id", { count: "exact" }).eq("status", "SEARCHING")
    ]);

    return NextResponse.json({
      layers: [
        { id: "hospitals", name: "Nearby Hospitals", count: hospRes.count || 12, enabled: true },
        { id: "blood_banks", name: "Blood Banks & Storage", count: bankRes.count || 6, enabled: true },
        { id: "active_requests", name: "Emergency Dispatches", count: reqRes.count || 4, enabled: true }
      ]
    }, { status: 200 });

  } catch (err) {
    return NextResponse.json({
      layers: [
        { id: "hospitals", name: "Nearby Hospitals", count: 12, enabled: true },
        { id: "blood_banks", name: "Blood Banks & Storage", count: 6, enabled: true },
        { id: "active_requests", name: "Emergency Dispatches", count: 4, enabled: true }
      ]
    }, { status: 200 });
  }
}
