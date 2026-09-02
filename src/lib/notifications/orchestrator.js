import { createAdminClient } from "@/lib/supabase/server";

export async function dispatchNotification({ userId, type, title, message }) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes("xyzcompany")) {
      console.log(`[NOTIFICATION MOCK] [${type}] ${title}: ${message}`);
      return { success: true, mock: true };
    }

    const supabase = createAdminClient();
    await supabase.from("notifications").insert({
      user_id: userId,
      type,
      title,
      message,
      read: false,
      created_at: new Date().toISOString()
    });

    return { success: true };
  } catch (err) {
    console.error("Notification dispatch error:", err);
    return { success: false };
  }
}
