import { createAdminClient } from "@/lib/supabase/server";

export async function logAuditEvent({ userId, action, tableName, recordId, oldData, newData }) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes("xyzcompany")) {
      console.log(`[AUDIT MOCK] ${action} on ${tableName}`);
      return { success: true, mock: true };
    }

    const supabase = createAdminClient();
    await supabase.from("audit_logs").insert({
      user_id: userId || null,
      action,
      table_name: tableName || null,
      record_id: recordId || null,
      old_data: oldData || null,
      new_data: newData || null,
      created_at: new Date().toISOString()
    });

    return { success: true };
  } catch (err) {
    console.error("Audit log creation error:", err);
    return { success: false };
  }
}
