import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || supabaseUrl.includes("xyzcompany")) {
      return NextResponse.json({
        logs: [
          { id: "notif-1", type: "EMERGENCY_REQUEST", title: "🚨 O- Emergency Dispatch", message: "Trauma ICU requires 3 units", created_at: new Date().toISOString() },
          { id: "notif-2", type: "DONOR_MATCH", title: "👤 Donor Matched", message: "Donor accepted dispatch", created_at: new Date(Date.now() - 1800000).toISOString() }
        ]
      }, { status: 200 });
    }

    const supabase = await createClient();
    const { data: logs } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);

    return NextResponse.json({ logs: logs || [] }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ logs: [] }, { status: 200 });
  }
}
