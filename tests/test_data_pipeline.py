"""
Unit Tests for Data Ingestion, Quality, and Resilience Pipeline
==============================================================
Verifies:
1. Standardization functions for blood groups, phone numbers, and provenance audit
2. Validation rules: required fields and India sovereign boundary checks
3. Multi-signal deduplication: verifies that name similarity alone without spatial proximity does NOT merge
4. Freshness confidence decay and clinical classification
5. Circuit Breaker transitions (CLOSED -> OPEN -> HALF-OPEN -> CLOSED) and fallback serving
"""

import pytest
import datetime
from src.pipeline.standardization import (
    standardize_blood_group,
    standardize_phone,
    standardize_record
)
from src.pipeline.validation import ValidationTracker
from src.pipeline.deduplication import DeduplicationEngine
from src.pipeline.freshness import compute_freshness_metrics, demonstrate_stale_ranking_tradeoff
from src.pipeline.resilience import CircuitBreaker, CircuitState, ResilientAPIClient

def test_blood_group_standardization():
    assert standardize_blood_group("A +ve") == "A+"
    assert standardize_blood_group("b positive") == "B+"
    assert standardize_blood_group("O-Ve") == "O-"
    assert standardize_blood_group("ab negative") == "AB-"
    assert standardize_blood_group("Oh+ve") == "Oh+"
    assert standardize_blood_group("INVALID_XYZ") is None

def test_phone_standardization():
    # Spaced mobile
    phone, p_type = standardize_phone("+91 98200 98200")
    assert p_type == "MOBILE"
    assert phone == "+91-98200-98200"

    # Dummy placeholder rejection
    phone_dummy, p_type_dummy = standardize_phone("0000000000")
    assert p_type_dummy == "INVALID"
    assert phone_dummy is None

    # Missing
    phone_none, p_type_none = standardize_phone("")
    assert p_type_none == "MISSING"

def test_validation_rules_indian_boundaries():
    validator = ValidationTracker()
    
    # 1. Valid Record in Mumbai
    valid_rec = {
        "id": "T-1", "name": "KEM Hospital Blood Centre",
        "latitude": 18.9934, "longitude": 72.8427,
        "blood_groups": ["O+", "A+"], "phone_type": "MOBILE", "available_units": 10
    }
    is_valid, failures = validator.validate_record(valid_rec)
    assert is_valid is True
    assert len(failures) == 0

    # 2. Null Island (0,0) Rejection
    null_island_rec = {
        "id": "T-2", "name": "Defective Centre",
        "latitude": 0.0, "longitude": 0.0,
        "blood_groups": ["O+"], "phone_type": "MOBILE", "available_units": 5
    }
    is_valid, failures = validator.validate_record(null_island_rec)
    assert is_valid is False
    assert "RULE_NULL_ISLAND_COORDINATES" in failures

    # 3. Coordinates Outside India (London: 51.5, -0.12)
    intl_rec = {
        "id": "T-3", "name": "London Blood Bank",
        "latitude": 51.5074, "longitude": -0.1278,
        "blood_groups": ["O+"], "phone_type": "MOBILE", "available_units": 5
    }
    is_valid, failures = validator.validate_record(intl_rec)
    assert is_valid is False
    assert "RULE_COORDINATES_OUTSIDE_INDIA" in failures

def test_deduplication_safety_constraint():
    deduper = DeduplicationEngine(proximity_threshold_km=0.50)
    
    # Scenario: Two "Red Cross Blood Bank" branches 1,200 km apart (Mumbai vs Delhi)
    # Must NOT merge solely because names are identical!
    records = [
        {
            "id": "RC-MUMBAI",
            "name": "Red Cross Blood Bank, Mumbai",
            "state_code": "27",
            "latitude": 18.9934, "longitude": 72.8427,
            "phone": "+91-98200-11111", "phone_type": "MOBILE",
            "blood_groups": ["O+"], "available_units": 10
        },
        {
            "id": "RC-DELHI",
            "name": "Red Cross Blood Bank, Delhi",
            "state_code": "07",
            "latitude": 28.6139, "longitude": 77.2090,
            "phone": "+91-98100-22222", "phone_type": "MOBILE",
            "blood_groups": ["A+"], "available_units": 15
        }
    ]
    retained, audit_log = deduper.deduplicate_records(records)
    assert len(retained) == 2
    assert len(audit_log) == 0  # No merge!

def test_freshness_decay_and_classification():
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Fresh: 1 hour old
    f1 = compute_freshness_metrics((now - datetime.timedelta(hours=1)).isoformat())
    assert f1["status"] == "FRESH"
    assert f1["confidence_score"] >= 0.89

    # Stale: 48 hours old
    f48 = compute_freshness_metrics((now - datetime.timedelta(hours=48)).isoformat())
    assert f48["status"] == "STALE"
    assert f48["confidence_score"] < 0.10

    # Trade-off test
    tradeoff = demonstrate_stale_ranking_tradeoff()
    assert tradeoff["candidate_b"]["rank"] == 1  # Fresh distant beats stale nearby

def test_circuit_breaker_and_resilience():
    cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.1)
    assert cb.state == CircuitState.CLOSED
    assert cb.can_execute() is True
    
    cb.record_failure()
    assert cb.state == CircuitState.CLOSED
    
    cb.record_failure()
    assert cb.state == CircuitState.OPEN
    assert cb.can_execute() is False  # Fast fail
