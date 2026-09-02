/**
 * Emergency Request Creation Rate Limiter
 * Prevents fake emergency spam and denial-of-service alerts.
 */

const rateLimitStore = new Map();

export function checkRateLimit(key = "anonymous", limit = 5, windowMs = 3600000) {
  const now = Date.now();
  const userRecord = rateLimitStore.get(key) || { timestamps: [] };

  // Filter timestamps within window
  const activeTimestamps = userRecord.timestamps.filter(ts => now - ts < windowMs);

  if (activeTimestamps.length >= limit) {
    const oldest = activeTimestamps[0];
    const resetInMs = windowMs - (now - oldest);
    return {
      allowed: false,
      current: activeTimestamps.length,
      limit,
      resetInMs,
      error: `Rate limit exceeded. Maximum ${limit} emergency requests allowed per hour.`
    };
  }

  activeTimestamps.push(now);
  rateLimitStore.set(key, { timestamps: activeTimestamps });

  return {
    allowed: true,
    current: activeTimestamps.length,
    remaining: limit - activeTimestamps.length
  };
}
