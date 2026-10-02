/**
 * Resilient Supabase Safe Query Execution
 * ========================================
 * Guarantees every Supabase query across the application fails fast
 * within a strict deadline (default 1500 ms) instead of hanging indefinitely
 * on unresolvable DNS or dropped socket connections.
 */

// Cache reachability check state for 60 seconds
let isHostReachableCached: boolean | null = null;
let lastReachabilityCheck = 0;
const REACHABILITY_TTL_MS = 60 * 1000;

export function isKnownDeadSupabaseUrl(url?: string | null): boolean {
  if (!url) return true;
  if (url.includes("xyzcompany") || url.includes("uicbarmqcefxujzehwfm")) {
    return true;
  }
  return false;
}

/**
 * Checks whether the configured Supabase host is alive and resolvable.
 * Logs a clear, actionable warning once when unreachable.
 */
export async function checkSupabaseReachability(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || isKnownDeadSupabaseUrl(url)) {
    if (isHostReachableCached !== false) {
      console.warn(
        `⚠️ [Supabase Warning] Configured host (${url || "undefined"}) is unreachable or unconfigured in local environment. Operating with resilient in-memory fallbacks.`
      );
      isHostReachableCached = false;
    }
    return false;
  }

  const now = Date.now();
  if (isHostReachableCached !== null && now - lastReachabilityCheck < REACHABILITY_TTL_MS) {
    return isHostReachableCached;
  }

  lastReachabilityCheck = now;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${url}/rest/v1/`, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
    });

    clearTimeout(timeoutId);
    isHostReachableCached = res.ok || res.status === 401; // 401 still means host is alive
  } catch (err: any) {
    if (isHostReachableCached !== false) {
      console.warn(
        `⚠️ [Supabase Warning] Host ${url} failed reachability check (${err?.message || "ENOTFOUND"}). All queries will fail fast to in-memory fallback.`
      );
    }
    isHostReachableCached = false;
  }

  return isHostReachableCached ?? false;
}

/**
 * Wraps any Supabase database call with a hard timeout race.
 * If the query exceeds timeoutMs (default 1500ms), it returns the fallbackValue.
 */
export async function safeSupabaseQuery<T>(
  queryFn: () => PromiseLike<T>,
  fallbackValue: T,
  timeoutMs = 1500
): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (isKnownDeadSupabaseUrl(url)) {
    return fallbackValue;
  }

  let timerId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Supabase query exceeded deadline of ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([queryFn(), timeoutPromise]);
    clearTimeout(timerId!);
    return result;
  } catch (err: any) {
    clearTimeout(timerId!);
    console.warn(`[Supabase SafeQuery] Bypassed or timed out after ${timeoutMs}ms:`, err?.message || err);
    return fallbackValue;
  }
}
