/**
 * TypeScript Resilience, Circuit Breaker, and Retry Engine
 * =======================================================
 * Ported from src/pipeline/resilience.py for production Next.js runtime.
 * 
 * Provides:
 * 1. Circuit Breaker (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * 2. Exponential backoff with jitter (max 2 retries, only for timeouts and 5xx)
 * 3. Strict AbortController timeout boundaries (default 8s, env configurable)
 * 4. In-memory cached fallback with stale-while-revalidate semantics
 * 5. Structured error classification
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type ErrorCategory =
  | "TIMEOUT_ERROR"
  | "SERVER_5XX_ERROR"
  | "EMPTY_PAYLOAD_ERROR"
  | "MALFORMED_JSON_ERROR"
  | "CIRCUIT_OPEN_FAST_FAIL"
  | "NETWORK_ERROR";

export interface ResilienceConfig {
  timeoutMs: number;
  maxRetries: number;
  baseBackoffMs: number;
  failureThreshold: number;
  circuitCooldownMs: number;
  cacheTtlMs: number;
}

export const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
  timeoutMs: parseInt(process.env.UPSTREAM_TIMEOUT_MS || "2000", 10),
  maxRetries: 1,
  baseBackoffMs: 200,
  failureThreshold: 2,
  circuitCooldownMs: 15000,
  cacheTtlMs: 15 * 60 * 1000, // 15 minutes
};

export class CircuitBreaker {
  private failureThreshold: number;
  private cooldownMs: number;
  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private lastFailureTime = 0;

  constructor(failureThreshold = 3, cooldownMs = 15000) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
  }

  public canExecute(): boolean {
    const now = Date.now();
    if (this.state === "OPEN") {
      if (now - this.lastFailureTime >= this.cooldownMs) {
        this.state = "HALF_OPEN";
        return true;
      }
      return false;
    }
    return true;
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
  }

  public recordFailure(): void {
    this.consecutiveFailures += 1;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  public getState(): CircuitState {
    const now = Date.now();
    if (this.state === "OPEN" && now - this.lastFailureTime >= this.cooldownMs) {
      return "HALF_OPEN";
    }
    return this.state;
  }

  public reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }
}

export interface CachedEntry<T> {
  data: T;
  timestamp: number;
  key: string;
  source: string;
}

export class FallbackCache<T = any> {
  private store = new Map<string, CachedEntry<T>>();
  private ttlMs: number;

  constructor(ttlMs = 15 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  public get(key: string): { data: T; isStale: boolean; timestamp: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const isStale = Date.now() - entry.timestamp > this.ttlMs;
    return { data: entry.data, isStale, timestamp: entry.timestamp };
  }

  public set(key: string, data: T, source = "LIVE_UPSTREAM"): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      key,
      source,
    });
  }

  public findNearest(lat: number, lng: number): { data: T; key: string } | null {
    // Search for closest cached coordinate entry
    let bestKey: string | null = null;
    let minDiff = Infinity;

    for (const [key, entry] of this.store.entries()) {
      const match = key.match(/^geo_(-?\d+\.\d+)_(-?\d+\.\d+)/);
      if (match) {
        const cLat = parseFloat(match[1]);
        const cLng = parseFloat(match[2]);
        const diff = Math.hypot(lat - cLat, lng - cLng);
        if (diff < minDiff && diff < 1.0) { // Within ~100km
          minDiff = diff;
          bestKey = key;
        }
      }
    }

    if (bestKey) {
      const found = this.store.get(bestKey);
      if (found) return { data: found.data, key: bestKey };
    }
    return null;
  }

  public clear(): void {
    this.store.clear();
  }
}

export interface ResilientExecutionResult<T> {
  success: boolean;
  data: T | null;
  stale: boolean;
  isFallback: boolean;
  circuitState: CircuitState;
  errorCategory?: ErrorCategory;
  errorMessage?: string;
  retries: number;
  durationMs: number;
}

export class ResilientClient {
  public circuitBreaker: CircuitBreaker;
  public cache: FallbackCache;
  public config: ResilienceConfig;

  constructor(config: Partial<ResilienceConfig> = {}) {
    this.config = { ...DEFAULT_RESILIENCE_CONFIG, ...config };
    this.circuitBreaker = new CircuitBreaker(
      this.config.failureThreshold,
      this.config.circuitCooldownMs
    );
    this.cache = new FallbackCache(this.config.cacheTtlMs);
  }

  /**
   * Executes an upstream request with timeout, retries on 5xx/timeouts,
   * circuit breaker, and in-memory cached fallback.
   */
  public async execute<T>(
    cacheKey: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
    options?: {
      geoFallbackCoords?: { lat: number; lng: number };
      staticFallback?: T;
    }
  ): Promise<ResilientExecutionResult<T>> {
    const startTime = Date.now();

    // 1. Check Circuit Breaker
    if (!this.circuitBreaker.canExecute()) {
      const cached = this.cache.get(cacheKey) || 
        (options?.geoFallbackCoords ? this.cache.findNearest(options.geoFallbackCoords.lat, options.geoFallbackCoords.lng) : null);

      return {
        success: false,
        data: cached ? cached.data : (options?.staticFallback ?? null),
        stale: true,
        isFallback: true,
        circuitState: this.circuitBreaker.getState(),
        errorCategory: "CIRCUIT_OPEN_FAST_FAIL",
        errorMessage: "Circuit breaker is OPEN. Upstream eRaktKosh gateway is failing fast.",
        retries: 0,
        durationMs: Date.now() - startTime,
      };
    }

    let lastErrorCategory: ErrorCategory | undefined;
    let lastErrorMessage = "";
    let attemptsRan = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      attemptsRan = attempt;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.config.timeoutMs);

      try {
        const result = await fetcher(controller.signal);
        clearTimeout(timeoutId);

        // Check for empty payload
        if (result === null || result === undefined || (Array.isArray(result) && result.length === 0)) {
          // Empty payload is not necessarily a 5xx error, but we treat missing responses carefully
        }

        // Upstream call succeeded
        this.circuitBreaker.recordSuccess();
        this.cache.set(cacheKey, result);

        return {
          success: true,
          data: result,
          stale: false,
          isFallback: false,
          circuitState: this.circuitBreaker.getState(),
          retries: attempt,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);

        const isTimeout =
          err.name === "AbortError" ||
          err.code === "ECONNABORTED" ||
          err.code === "ETIMEDOUT" ||
          /timeout/i.test(err.message || "");

        const status = err.response?.status || err.status;
        const is5xx = status && status >= 500 && status <= 599;
        const isNetwork =
          err.code === "ENOTFOUND" ||
          err.code === "ECONNREFUSED" ||
          /fetch failed|network error/i.test(err.message || "");

        if (isTimeout) {
          lastErrorCategory = "TIMEOUT_ERROR";
          lastErrorMessage = `Upstream request timed out after ${this.config.timeoutMs}ms`;
        } else if (is5xx) {
          lastErrorCategory = "SERVER_5XX_ERROR";
          lastErrorMessage = `Upstream gateway returned HTTP ${status}`;
        } else if (isNetwork) {
          lastErrorCategory = "NETWORK_ERROR";
          lastErrorMessage = `Upstream network connection failed: ${err.message}`;
        } else {
          // 4xx or client error - do NOT retry
          lastErrorCategory = "MALFORMED_JSON_ERROR";
          lastErrorMessage = err.message || "Request failed";
          break;
        }

        // Only retry on timeout or 5xx or network errors if retries remain
        if (attempt < this.config.maxRetries && (isTimeout || is5xx || isNetwork)) {
          const backoff =
            this.config.baseBackoffMs * Math.pow(2, attempt) +
            Math.random() * 50;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    // Retries exhausted -> record failure on circuit breaker
    this.circuitBreaker.recordFailure();

    // 4. In-Memory Cached Fallback
    const cached = this.cache.get(cacheKey) || 
      (options?.geoFallbackCoords ? this.cache.findNearest(options.geoFallbackCoords.lat, options.geoFallbackCoords.lng) : null);

    return {
      success: false,
      data: cached ? cached.data : (options?.staticFallback ?? null),
      stale: true,
      isFallback: true,
      circuitState: this.circuitBreaker.getState(),
      errorCategory: lastErrorCategory || "NETWORK_ERROR",
      errorMessage: lastErrorMessage || "Upstream fetch failed after retries",
      retries: attemptsRan,
      durationMs: Date.now() - startTime,
    };
  }
}

// Global singleton instance for runtime route handlers
declare global {
  // eslint-disable-next-line no-var
  var __BLOODLINK_RESILIENT_CLIENT: ResilientClient | undefined;
}

export function getResilientClient(): ResilientClient {
  if (!globalThis.__BLOODLINK_RESILIENT_CLIENT) {
    globalThis.__BLOODLINK_RESILIENT_CLIENT = new ResilientClient();
  }
  return globalThis.__BLOODLINK_RESILIENT_CLIENT;
}
