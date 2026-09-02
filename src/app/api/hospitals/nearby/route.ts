import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") || "20.5937");
    const lng = parseFloat(searchParams.get("lng") || "78.9629");

    const DEFAULT_FACILITIES = [
      {
        id: "hosp-1",
        name: "City General Hospital & ICU",
        type: "HOSPITAL",
        distanceKm: 1.2,
        address: "Main Central Bypass Road",
        phone: "+91 9876543210",
        verified: true
      },
      {
        id: "bank-1",
        name: "Regional Blood Bank & Storage",
        type: "BLOOD_BANK",
        distanceKm: 2.5,
        address: "Medical College Gate 2",
        phone: "+91 9876543211",
        verified: true
      },
      {
        id: "hosp-2",
        name: "Apex Emergency Trauma Care",
        type: "HOSPITAL",
        distanceKm: 4.1,
        address: "Station Road Ward 4",
        phone: "+91 9876543212",
        verified: true
      }
    ];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes("xyzcompany")) {
      return NextResponse.json({ facilities: DEFAULT_FACILITIES }, { status: 200 });
    }

    const supabase = await createClient();
    const { data: hosps } = await supabase.from("hospital_profiles").select("*");
    const { data: banks } = await supabase.from("blood_bank_profiles").select("*");

    if ((!hosps || hosps.length === 0) && (!banks || banks.length === 0)) {
      return NextResponse.json({ facilities: DEFAULT_FACILITIES }, { status: 200 });
    }

    const facilities: any[] = [];
    (hosps || []).forEach(h => {
      facilities.push({
        id: h.id,
        name: h.hospital_name,
        type: "HOSPITAL",
        distanceKm: 1.5,
        address: h.address || "City Hospital Ward",
        phone: h.phone || "+91 9876543210",
        verified: h.verified ?? true
      });
    });

    (banks || []).forEach(b => {
      facilities.push({
        id: b.id,
        name: b.blood_bank_name,
        type: "BLOOD_BANK",
        distanceKm: 2.8,
        address: b.address || "Medical College Storage",
        phone: b.phone || "+91 9876543211",
        verified: b.verified ?? true
      });
    });

    return NextResponse.json({ facilities }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ facilities: [] }, { status: 200 });
  }
}
