import test from "node:test";
import assert from "node:assert/strict";
import {
  CircuitBreaker,
  FallbackCache,
  ResilientClient,
} from "../src/lib/resilience.ts";

test("Resilience - Circuit Breaker State Transitions", () => {
  const cb = new CircuitBreaker(3, 100); // 3 failures, 100ms cooldown

  assert.equal(cb.getState(), "CLOSED");
  assert.equal(cb.canExecute(), true);

  // Failure 1 & 2: still closed
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.getState(), "CLOSED");
  assert.equal(cb.canExecute(), true);

  // Failure 3: trips to OPEN
  cb.recordFailure();
  assert.equal(cb.getState(), "OPEN");
  assert.equal(cb.canExecute(), false);

  // Success resets state
  cb.recordSuccess();
  assert.equal(cb.getState(), "CLOSED");
  assert.equal(cb.canExecute(), true);
});

test("Resilience - Fallback Cache TTL and Key Matching", () => {
  const cache = new FallbackCache(500); // 500ms TTL

  cache.set("geo_19.85_75.30_50_27", [{ name: "Civil Hospital" }]);
  const entry = cache.get("geo_19.85_75.30_50_27");

  assert.ok(entry);
  assert.equal(entry.data[0].name, "Civil Hospital");
  assert.equal(entry.isStale, false);

  // Test nearest geographic fallback lookup
  const nearest = cache.findNearest(19.851, 75.302);
  assert.ok(nearest);
  assert.equal(nearest.data[0].name, "Civil Hospital");
});

test("Resilience - Timeout and Retry Execution", async () => {
  const client = new ResilientClient({
    timeoutMs: 50,
    maxRetries: 2,
    baseBackoffMs: 10,
    failureThreshold: 2,
    circuitCooldownMs: 500,
  });

  let attempts = 0;
  const result = await client.execute(
    "timeout_test",
    async (signal) => {
      attempts++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ ok: true }), 200);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    },
    { staticFallback: { fallback: true } }
  );

  // Initial attempt + 2 retries = 3 attempts
  assert.equal(attempts, 3, "Should retry twice for a total of 3 attempts on timeout");
  assert.equal(result.success, false);
  assert.equal(result.stale, true);
  assert.equal(result.isFallback, true);
  assert.equal(result.errorCategory, "TIMEOUT_ERROR");
  assert.deepEqual(result.data, { fallback: true });
});

test("Resilience - 5xx Retry and Circuit Breaker Trip", async () => {
  const client = new ResilientClient({
    timeoutMs: 200,
    maxRetries: 1,
    baseBackoffMs: 10,
    failureThreshold: 1, // Trips after 1 exhausted failure
    circuitCooldownMs: 1000,
  });

  // Pre-seed cache
  client.cache.set("server_err_key", [{ id: "cached-bank" }]);

  let callCount = 0;
  const result = await client.execute("server_err_key", async () => {
    callCount++;
    const err = new Error("Gateway Error");
    err.status = 503;
    throw err;
  });

  // 1 initial + 1 retry = 2 calls
  assert.equal(callCount, 2);
  assert.equal(result.success, false);
  assert.equal(result.stale, true);
  assert.equal(result.isFallback, true);
  assert.equal(result.errorCategory, "SERVER_5XX_ERROR");
  assert.deepEqual(result.data, [{ id: "cached-bank" }]);

  // Subsequent call should fast-fail because circuit is now OPEN
  assert.equal(client.circuitBreaker.getState(), "OPEN");
  const fastFailResult = await client.execute("server_err_key", async () => {
    throw new Error("Should not be called");
  });
  assert.equal(fastFailResult.errorCategory, "CIRCUIT_OPEN_FAST_FAIL");
  assert.equal(fastFailResult.isFallback, true);
});

test("Resilience - Non-5xx (4xx) Client Error Does Not Retry", async () => {
  const client = new ResilientClient({
    timeoutMs: 200,
    maxRetries: 2,
    baseBackoffMs: 10,
  });

  let callCount = 0;
  const result = await client.execute("bad_req_key", async () => {
    callCount++;
    const err = new Error("Bad Request");
    err.status = 400;
    throw err;
  });

  // Should only run 1 time (no retry on 4xx)
  assert.equal(callCount, 1);
  assert.equal(result.success, false);
});
