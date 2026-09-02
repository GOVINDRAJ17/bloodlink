import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch user profile to check completeness & role
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_profile_complete, role")
          .eq("id", user.id)
          .single();

        if (!profile || !profile.is_profile_complete) {
          return NextResponse.redirect(`${origin}/profile/setup`);
        }

        const role = (profile.role || "DONOR").toLowerCase();
        const rolePath = role === "blood_bank" ? "blood-bank" : role;
        return NextResponse.redirect(`${origin}/dashboard/${rolePath}`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=oauth_exchange_failed`);
}
