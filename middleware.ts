import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isKnownDeadSupabaseUrl(url?: string | null): boolean {
  if (!url) return true;
  if (url.includes("xyzcompany") || url.includes("uicbarmqcefxujzehwfm")) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isKnownDeadSupabaseUrl(supabaseUrl) || !supabaseAnonKey) {
    // If Supabase keys are default/unconfigured or dead host, proceed cleanly without blocking
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey, {
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

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/auth/login");
  const isCallbackRoute = pathname.startsWith("/auth/callback");
  const isProfileSetupRoute = pathname.startsWith("/profile/setup");
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/chronic-care") ||
    pathname.startsWith("/map") ||
    pathname.startsWith("/requests") ||
    pathname.startsWith("/api") ||
    isAuthRoute ||
    isCallbackRoute;

  // 1. Refresh Supabase session with strict 1.2s timeout race
  let user: any = null;
  try {
    const userResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { user: null } }), 1200)
      ),
    ]);
    user = userResult?.data?.user ?? null;
  } catch {
    user = null;
  }

  // 2. Unauthenticated user accessing private protected dashboard routes
  if (!user && !isPublicRoute) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated user profile setup verification
  if (user && !isCallbackRoute && !isPublicRoute) {
    try {
      const profilePromise = supabase
        .from("profiles")
        .select("is_profile_complete, role")
        .eq("id", user.id)
        .single();

      const profileResult = await Promise.race([
        profilePromise,
        new Promise<any>((resolve) => setTimeout(() => resolve({ data: null }), 1200)),
      ]);

      const profile = profileResult?.data;
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
    } catch {
      // Continue gracefully on database timeout
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
