import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || supabaseUrl.includes("xyzcompany")) {
      return NextResponse.json({
        layers: [
          { id: "hospitals", name: "Nearby Hospitals", count: 0, enabled: true },
          { id: "blood_banks", name: "Blood Banks & Storage", count: 0, enabled: true },
          { id: "active_requests", name: "Emergency Dispatches", count: 0, enabled: true },
          { id: "donors", name: "Active Donors", count: 0, enabled: true }
        ],
        emergencies: [],
        bloodBanks: [],
        hospitals: [],
        donors: []
      }, { status: 200 });
    }

    const { safeSupabaseQuery } = await import("@/lib/supabase/safeQuery");
    const supabase = await createClient();

    const [hospRes, bankRes, reqRes, donorRes] = await safeSupabaseQuery(
      () => Promise.all([
        supabase.from("hospital_profiles").select("id, hospital_name, address, phone, verified"),
        supabase.from("blood_bank_profiles").select("id, blood_bank_name, address, phone, verified"),
        supabase.from("blood_requests").select("id, blood_group, units_required, urgency, status, location, additional_message").in("status", ["SEARCHING", "PENDING", "NOTIFIED"]),
        supabase.from("donor_profiles").select("id, blood_group, location, available").eq("available", true).limit(50)
      ]),
      [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] }
      ] as any,
      1500
    );

    const hospData = hospRes?.data || [];
    const bankData = bankRes?.data || [];
    const reqData = reqRes?.data || [];
    const donorData = donorRes?.data || [];

    // Parse coordinates from PostGIS or JSON metadata
    const parsedEmergencies = reqData.map(r => {
      let lat = 0;
      let lng = 0;
      if (r.additional_message && r.additional_message.startsWith("{")) {
        try {
          const meta = JSON.parse(r.additional_message);
          lat = meta.hospital_lat || 0;
          lng = meta.hospital_lng || 0;
        } catch {}
      }
      return {
        id: r.id,
        lat,
        lng,
        urgency: r.urgency,
        bloodGroup: r.blood_group,
        patientName: "Emergency Patient",
        hospitalName: "Hospital Request",
        unitsNeeded: r.units_required
      };
    }).filter(e => e.lat !== 0 && e.lng !== 0);

    const parsedBloodBanks = bankData.map(b => ({
      id: b.id,
      name: b.blood_bank_name,
      address: b.address || "",
      phone: b.phone || ""
    }));

    const parsedHospitals = hospData.map(h => ({
      id: h.id,
      name: h.hospital_name,
      address: h.address || "",
      phone: h.phone || ""
    }));

    const parsedDonors = donorData.map(d => ({
      id: d.id,
      bloodGroup: d.blood_group,
      available: d.available
    }));

    return NextResponse.json({
      layers: [
        { id: "hospitals", name: "Nearby Hospitals", count: hospData.length, enabled: true },
        { id: "blood_banks", name: "Blood Banks & Storage", count: bankData.length, enabled: true },
        { id: "active_requests", name: "Emergency Dispatches", count: reqData.length, enabled: true },
        { id: "donors", name: "Active Donors", count: donorData.length, enabled: true }
      ],
      emergencies: parsedEmergencies,
      bloodBanks: parsedBloodBanks,
      hospitals: parsedHospitals,
      donors: parsedDonors
    }, { status: 200 });

  } catch (err: any) {
    console.error("Error fetching map layers:", err);
    return NextResponse.json({
      layers: [
        { id: "hospitals", name: "Nearby Hospitals", count: 0, enabled: true },
        { id: "blood_banks", name: "Blood Banks & Storage", count: 0, enabled: true },
        { id: "active_requests", name: "Emergency Dispatches", count: 0, enabled: true },
        { id: "donors", name: "Active Donors", count: 0, enabled: true }
      ],
      emergencies: [],
      bloodBanks: [],
      hospitals: [],
      donors: []
    }, { status: 200 });
  }
}
