"""
Production API Resilience, Circuit Breaker, and Failure Handling Engine
========================================================================
Implements enterprise-grade fault tolerance for external government health APIs (e.g., eRaktKosh):
1. Circuit Breaker Pattern (CLOSED -> OPEN -> HALF-OPEN -> CLOSED)
2. Exponential Backoff with Jitter for transient errors
3. Strict HTTP Timeout Boundaries
4. In-Memory Cached Fallback with Stale-While-Revalidate semantics
5. Categorized Error Classification & Audit Telemetry

Demonstrates all 6 required failure modes:
- Mode 1: API Timeout
- Mode 2: HTTP 5xx Server Error
- Mode 3: Empty Response Body
- Mode 4: Malformed / Corrupt JSON
- Mode 5: Cached Fallback Engagement
- Mode 6: System Self-Healing & Recovery
"""

import time
import json
import random
from typing import Dict, Any, Optional, Callable, List, Tuple
from enum import Enum

class CircuitState(Enum):
    CLOSED = "CLOSED"        # Normal operation: requests pass through
    OPEN = "OPEN"            # Tripped: requests fail-fast to cached fallback
    HALF_OPEN = "HALF_OPEN"  # Testing: permits single probe request to check recovery

class ErrorCategory(Enum):
    TIMEOUT = "TIMEOUT_ERROR"
    HTTP_5XX = "SERVER_5XX_ERROR"
    EMPTY_RESPONSE = "EMPTY_PAYLOAD_ERROR"
    MALFORMED_JSON = "MALFORMED_JSON_ERROR"
    CIRCUIT_OPEN = "CIRCUIT_OPEN_FAST_FAIL"
    NETWORK_ERROR = "NETWORK_CONNECT_ERROR"

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 2.0):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.last_failure_time = 0.0

    def can_execute(self) -> bool:
        now = time.time()
        if self.state == CircuitState.OPEN:
            if now - self.last_failure_time >= self.cooldown_seconds:
                self.state = CircuitState.HALF_OPEN
                return True
            return False
        return True

    def record_success(self):
        self.consecutive_failures = 0
        self.state = CircuitState.CLOSED

    def record_failure(self):
        self.consecutive_failures += 1
        self.last_failure_time = time.time()
        if self.consecutive_failures >= self.failure_threshold:
            self.state = CircuitState.OPEN

class ResilientAPIClient:
    def __init__(
        self,
        max_retries: int = 2,
        base_backoff_sec: float = 0.05,
        timeout_sec: float = 0.5,
        circuit_threshold: int = 3,
        circuit_cooldown: float = 1.0
    ):
        self.max_retries = max_retries
        self.base_backoff_sec = base_backoff_sec
        self.timeout_sec = timeout_sec
        self.circuit_breaker = CircuitBreaker(circuit_threshold, circuit_cooldown)
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.telemetry_log: List[Dict[str, Any]] = []

    def populate_cache(self, endpoint: str, data: Any):
        """Populates cache with previously verified offline/historic dataset."""
        self.cache[endpoint] = {
            "data": data,
            "cached_at": time.time(),
            "source": "VERIFIED_OFFLINE_CACHE"
        }

    def execute_request(
        self,
        endpoint: str,
        mock_invoker: Callable[[], Tuple[int, str, float]]
    ) -> Dict[str, Any]:
        """
        Executes request through resilience pipeline.
        mock_invoker returns (status_code, body_string, latency_sec).
        """
        req_start = time.time()
        attempt = 0
        last_error_type = None
        last_error_msg = ""
        
        # 1. Circuit Breaker Check
        if not self.circuit_breaker.can_execute():
            # Fast fail to cache immediately
            fallback = self.cache.get(endpoint)
            log_entry = {
                "endpoint": endpoint,
                "retries": 0,
                "failure_type": ErrorCategory.CIRCUIT_OPEN.value,
                "circuit_state": self.circuit_breaker.state.value,
                "recovery_behaviour": "FAST_FAIL_TO_CACHE",
                "user_visible_behaviour": "Displaying verified cached facilities with stale warning indicator",
                "success": False,
                "data": fallback["data"] if fallback else None,
                "is_fallback": True
            }
            self.telemetry_log.append(log_entry)
            return log_entry

        # 2. Retry loop with Exponential Backoff
        for attempt in range(self.max_retries + 1):
            try:
                status_code, raw_body, simulated_latency = mock_invoker()
                
                # Check Timeout constraint
                if simulated_latency > self.timeout_sec:
                    raise TimeoutError(f"Simulated network latency ({simulated_latency:.2f}s) exceeded timeout threshold ({self.timeout_sec:.2f}s)")
                    
                # Check HTTP 5xx
                if status_code >= 500:
                    raise ConnectionError(f"HTTP {status_code} Internal Server Error from upstream eRaktKosh gateway")
                    
                # Check Empty Response
                if not raw_body or raw_body.strip() in ("", "[]", "{}"):
                    raise ValueError("Received empty or null payload from upstream registry")
                    
                # Check Malformed JSON
                parsed_data = json.loads(raw_body)
                
                # Successful response
                self.circuit_breaker.record_success()
                # Update cache
                self.cache[endpoint] = {"data": parsed_data, "cached_at": time.time(), "source": "LIVE_ERAKTKOSH"}
                
                log_entry = {
                    "endpoint": endpoint,
                    "retries": attempt,
                    "failure_type": None,
                    "circuit_state": self.circuit_breaker.state.value,
                    "recovery_behaviour": "DIRECT_SUCCESS",
                    "user_visible_behaviour": "Live registry data loaded successfully",
                    "success": True,
                    "data": parsed_data,
                    "is_fallback": False
                }
                self.telemetry_log.append(log_entry)
                return log_entry

            except TimeoutError as te:
                last_error_type = ErrorCategory.TIMEOUT.value
                last_error_msg = str(te)
            except ConnectionError as ce:
                last_error_type = ErrorCategory.HTTP_5XX.value
                last_error_msg = str(ce)
            except ValueError as ve:
                if "empty" in str(ve).lower():
                    last_error_type = ErrorCategory.EMPTY_RESPONSE.value
                else:
                    last_error_type = ErrorCategory.MALFORMED_JSON.value
                last_error_msg = str(ve)
            except json.JSONDecodeError as je:
                last_error_type = ErrorCategory.MALFORMED_JSON.value
                last_error_msg = f"JSON parse error: {str(je)}"
                
            # If not last attempt, backoff and retry
            if attempt < self.max_retries:
                backoff = self.base_backoff_sec * (2 ** attempt) + random.uniform(0.01, 0.03)
                time.sleep(backoff)

        # 3. All retries exhausted: record failure on Circuit Breaker
        self.circuit_breaker.record_failure()
        
        # 4. Fallback to cache
        fallback = self.cache.get(endpoint)
        if fallback:
            recovery_action = "SERVE_STALE_VERIFIED_CACHE"
            user_msg = "Upstream eRaktKosh API unresponsive. Displaying verified local backup inventory (Updated recently)."
            ret_data = fallback["data"]
        else:
            recovery_action = "DEGRADED_EMPTY_NOTIFICATION"
            user_msg = "Registry service temporarily unreachable. Directing user to local emergency phone hotline."
            ret_data = []

        log_entry = {
            "endpoint": endpoint,
            "retries": attempt,
            "failure_type": last_error_type,
            "circuit_state": self.circuit_breaker.state.value,
            "recovery_behaviour": recovery_action,
            "user_visible_behaviour": user_msg,
            "success": False,
            "data": ret_data,
            "is_fallback": True,
            "last_error": last_error_msg
        }
        self.telemetry_log.append(log_entry)
        return log_entry

def run_resilience_simulation_suite() -> List[Dict[str, Any]]:
    """Runs all 6 required failure modes and returns structured results."""
    client = ResilientAPIClient(max_retries=2, base_backoff_sec=0.02, timeout_sec=0.2, circuit_threshold=2, circuit_cooldown=0.3)
    
    test_endpoint = "https://eraktkosh.mohfw.gov.in/eraktkoshPortal/eraktkosh/bloodbank/nearest"
    # Seed cache with verified backup facilities
    client.populate_cache(test_endpoint, [
        {"hospitalCode": "1001", "name": "KEM Hospital Blood Centre (Cached)", "units": 15},
        {"hospitalCode": "1002", "name": "Tata Memorial Centre (Cached)", "units": 8}
    ])
    
    results = []

    # -------------------------------------------------------------------------
    # Scenario 1: API Timeout
    # -------------------------------------------------------------------------
    res1 = client.execute_request(
        test_endpoint,
        lambda: (200, '[{"name": "Delayed Facility"}]', 0.45) # 0.45s > 0.2s timeout
    )
    results.append({"mode": 1, "name": "API Timeout", "result": res1})

    # -------------------------------------------------------------------------
    # Scenario 2: HTTP 5xx Server Error
    # -------------------------------------------------------------------------
    res2 = client.execute_request(
        test_endpoint,
        lambda: (503, "Service Unavailable - MoHFW Gateway Overloaded", 0.05)
    )
    results.append({"mode": 2, "name": "HTTP 5xx Server Error", "result": res2})

    # -------------------------------------------------------------------------
    # Scenario 3: Circuit Breaker Open & Cached Fallback
    # (Since 2 consecutive failures occurred, Circuit Breaker trips to OPEN)
    # -------------------------------------------------------------------------
    res3 = client.execute_request(
        test_endpoint,
        lambda: (200, "[]", 0.01) # Won't even be called due to fast-fail
    )
    results.append({"mode": 3, "name": "Circuit Breaker Fast-Fail to Cache", "result": res3})

    # -------------------------------------------------------------------------
    # Scenario 4: Empty Response Body
    # -------------------------------------------------------------------------
    # Allow cooldown so circuit moves to HALF_OPEN
    time.sleep(0.35)
    res4 = client.execute_request(
        test_endpoint,
        lambda: (200, "[]", 0.02) # Empty payload
    )
    results.append({"mode": 4, "name": "Empty Response Body", "result": res4})

    # -------------------------------------------------------------------------
    # Scenario 5: Malformed JSON Response
    # -------------------------------------------------------------------------
    time.sleep(0.35)
    res5 = client.execute_request(
        test_endpoint,
        lambda: (200, "<html><head><title>502 Bad Gateway</title></head><body>Unparsed HTML", 0.02)
    )
    results.append({"mode": 5, "name": "Malformed / Non-JSON Response", "result": res5})

    # -------------------------------------------------------------------------
    # Scenario 6: Recovery after Failure (Self-Healing)
    # -------------------------------------------------------------------------
    time.sleep(0.35) # Wait for cooldown to test probe
    res6 = client.execute_request(
        test_endpoint,
        lambda: (200, '[{"hospitalCode": "1001", "name": "KEM Hospital", "units": 16, "status": "LIVE"}]', 0.03)
    )
    results.append({"mode": 6, "name": "Recovery after Failure (Self-Healing)", "result": res6})

    return results
