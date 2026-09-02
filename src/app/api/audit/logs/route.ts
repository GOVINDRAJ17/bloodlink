import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || supabaseUrl.includes("xyzcompany")) {
      return NextResponse.json({
        logs: [
          { id: "audit-1", action: "ASSIGN_DONOR_MATCH", table_name: "donor_responses", created_at: new Date().toISOString() },
          { id: "audit-2", action: "UPDATE_INVENTORY", table_name: "blood_inventory", created_at: new Date(Date.now() - 3600000).toISOString() }
        ]
      }, { status: 200 });
    }

    const supabase = await createClient();
    const { data: logs } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20);

    return NextResponse.json({ logs: logs || [] }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ logs: [] }, { status: 200 });
  }
}
