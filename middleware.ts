import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("xyzcompany")) {
    // If Supabase keys are default/unconfigured in local dev, allow request to proceed cleanly
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // 1. Refresh Supabase session
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/auth/login");
  const isCallbackRoute = pathname.startsWith("/auth/callback");
  const isProfileSetupRoute = pathname.startsWith("/profile/setup");
  const isPublicRoute = pathname === "/" || isAuthRoute || isCallbackRoute;

  // 2. Unauthenticated user accessing protected routes
  if (!user && !isPublicRoute) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated user profile setup verification
  if (user && !isCallbackRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_profile_complete, role")
      .eq("id", user.id)
      .single();

    const isProfileComplete = profile?.is_profile_complete ?? false;
    const role = (profile?.role || "DONOR").toLowerCase();

    // Redirect incomplete profile to /profile/setup
    if (!isProfileComplete && !isProfileSetupRoute) {
      return NextResponse.redirect(new URL("/profile/setup", request.url));
    }

    // Redirect authenticated user away from login page to dashboard
    if (user && isAuthRoute) {
      const dashboardPath = isProfileComplete
        ? `/dashboard/${role === "blood_bank" ? "blood-bank" : role}`
        : "/profile/setup";
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
