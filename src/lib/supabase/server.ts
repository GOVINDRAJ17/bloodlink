import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkSupabaseReachability } from "./safeQuery";

// Trigger early asynchronous reachability check once at startup
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  checkSupabaseReachability().catch(() => {});
}

/**
 * Creates a resilient fetch wrapper with a hard 1.5s timeout.
 */
function createTimeoutFetch(timeoutMs = 1500) {
  return (url: RequestInfo | URL, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    }).finally(() => clearTimeout(timer));
  };
}

/**
 * Creates a Supabase client for use in Server Components, Server Actions, and API Route Handlers.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Can be ignored if called from Server Component
          }
        },
      },
      global: {
        fetch: createTimeoutFetch(1500),
      },
    }
  );
}

/**
 * Creates a privileged server-only Supabase admin client using SUPABASE_SERVICE_ROLE_KEY.
 * WARNING: NEVER use this in client components or export to browser.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    serviceRoleKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
      global: {
        fetch: createTimeoutFetch(1500),
      },
    }
  );
}
