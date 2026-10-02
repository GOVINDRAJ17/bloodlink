"""
Unit Tests for BloodLink Emergency Blood Ranking Engine
======================================================
Verifies:
1. Blood component compatibility matrices (PRBC, Whole Blood, Plasma, Platelets, Bombay)
2. Mathematical properties of Distance, ETA, Reliability, and Freshness functions
3. Composite score calculations and weight constraints
4. Invariants across all 10 reviewer scenarios
"""

import pytest
import math
from src.ranking.config import (
    DEFAULT_LAMBDA,
    DEFAULT_FRESHNESS_HALF_LIFE_HOURS,
    WEIGHT_PROFILES
)
from src.ranking.compatibility import (
    evaluate_compatibility,
    normalize_blood_group
)
from src.ranking.normalization import (
    calculate_haversine_distance,
    normalize_distance_linear,
    normalize_distance_exponential,
    calculate_eta,
    normalize_eta,
    calculate_reliability,
    calculate_freshness
)
from src.ranking.engine import (
    RankingEngine,
    CandidateSource,
    EmergencyRequest
)
from src.ranking.fixtures import get_scenario_fixtures

# -----------------------------------------------------------------------------
# 1. Compatibility Tests
# -----------------------------------------------------------------------------
def test_blood_group_normalization():
    assert normalize_blood_group("A+Ve") == "A+"
    assert normalize_blood_group("o-ve") == "O-"
    assert normalize_blood_group("Oh+ve") == "Oh+"
    assert normalize_blood_group("AB POSITIVE") == "AB+"

def test_prbc_compatibility():
    # Exact match
    score, tier, _ = evaluate_compatibility("A+", "A+", "PRBC")
    assert score == 1.0
    assert tier == "EXACT"

    # Universal cellular donor O- to A+
    score, tier, _ = evaluate_compatibility("A+", "O-", "PRBC")
    assert score == 0.75 or score == 0.85
    assert tier == "COMPATIBLE_SUBSTITUTE"

    # Incompatible A+ to O-
    score, tier, _ = evaluate_compatibility("O-", "A+", "PRBC")
    assert score == 0.0
    assert tier == "INCOMPATIBLE"

def test_plasma_reverse_compatibility():
    # In plasma, AB is universal donor, O is universal recipient
    score_ab_to_o, tier_ab, _ = evaluate_compatibility("O-", "AB+", "PLASMA")
    assert score_ab_to_o >= 0.85
    assert tier_ab == "COMPATIBLE_SUBSTITUTE"

    # O plasma cannot be given to AB recipient
    score_o_to_ab, tier_o, _ = evaluate_compatibility("AB+", "O+", "PLASMA")
    assert score_o_to_ab == 0.0
    assert tier_o == "INCOMPATIBLE"

def test_platelet_compatibility():
    # Exact O- platelet match
    score, tier, _ = evaluate_compatibility("O-", "O-", "PLATELETS")
    assert score == 1.0
    assert tier == "EXACT"

    # Emergency A- platelet substitution for O-
    score_sub, tier_sub, _ = evaluate_compatibility("O-", "A-", "PLATELETS")
    assert score_sub >= 0.75
    assert tier_sub == "COMPATIBLE_SUBSTITUTE"

def test_bombay_phenotype_compatibility():
    # Standard O- is incompatible with Bombay Oh+ due to anti-H antibodies
    score, tier, _ = evaluate_compatibility("Oh+", "O-", "PRBC")
    assert score == 0.0
    assert tier == "INCOMPATIBLE"

    # Oh- to Oh+ is compatible
    score_oh, tier_oh, _ = evaluate_compatibility("Oh+", "Oh-", "PRBC")
    assert score_oh >= 0.85

# -----------------------------------------------------------------------------
# 2. Normalization Function Tests
# -----------------------------------------------------------------------------
def test_haversine_distance():
    # Mumbai KEM to Tata Memorial (~500m)
    d = calculate_haversine_distance(18.9934, 72.8427, 18.9975, 72.8432)
    assert 0.4 <= d <= 0.6

def test_linear_distance_normalization():
    assert normalize_distance_linear(0.0, 50.0) == 1.0
    assert normalize_distance_linear(25.0, 50.0) == 0.5
    assert normalize_distance_linear(50.0, 50.0) == 0.0
    assert normalize_distance_linear(60.0, 50.0) == 0.0  # Bounded at 0

def test_eta_calculation_and_normalization():
    # Under CRITICAL priority (45 km/h, 5m prep for blood bank)
    total_eta, transit, prep = calculate_eta(
        distance_km=10.0,
        source_type="BLOOD_BANK",
        urgency="CRITICAL"
    )
    assert prep == 5.0
    assert transit > 0.0
    assert total_eta == transit + prep

    # Bounded ETA normalization
    assert normalize_eta(5.0, min_eta_minutes=5.0, max_eta_minutes=120.0) == 1.0
    assert normalize_eta(120.0, min_eta_minutes=5.0, max_eta_minutes=120.0) == 0.0
    assert normalize_eta(150.0, min_eta_minutes=5.0, max_eta_minutes=120.0) == 0.0

def test_exponential_freshness_decay():
    # At t=0, freshness is 1.0
    s0, _ = calculate_freshness(0.0, DEFAULT_LAMBDA)
    assert s0 == 1.0

    # At t = t_half (12 hours), score must be exactly 0.50
    s12, _ = calculate_freshness(12.0, DEFAULT_LAMBDA)
    assert abs(s12 - 0.50) < 0.001

    # At t = 24 hours, score must be 0.25
    s24, _ = calculate_freshness(24.0, DEFAULT_LAMBDA)
    assert abs(s24 - 0.25) < 0.001

    # At t = 48 hours, score must be ~0.0625
    s48, label48 = calculate_freshness(48.0, DEFAULT_LAMBDA)
    assert s48 < 0.10
    assert "Stale" in label48

# -----------------------------------------------------------------------------
# 3. Engine & Scenario Integration Tests
# -----------------------------------------------------------------------------
def test_engine_weight_normalization():
    # Weights not summing to 1.0 should automatically normalize
    unnorm_weights = {
        "W_compatibility": 35,
        "W_distance": 20,
        "W_eta": 20,
        "W_reliability": 15,
        "W_freshness": 10
    }
    engine = RankingEngine(custom_weights=unnorm_weights)
    assert abs(sum(engine.weights.values()) - 1.0) < 1e-5
    assert abs(engine.weights["W_compatibility"] - 0.35) < 1e-4

def test_incompatible_source_receives_zero_score():
    engine = RankingEngine(weight_profile="BALANCED")
    cand = CandidateSource(
        id="C-INCOMPAT",
        name="Incompatible Source",
        source_type="BLOOD_BANK",
        blood_group="B+",
        lat=18.9934, lon=72.8427,
        available_units=10,
        data_age_hours=0.5
    )
    req = EmergencyRequest(
        request_id="REQ-TEST",
        patient_group="O-",
        component="PRBC",
        units_needed=1,
        lat=18.9934, lon=72.8427
    )
    scored = engine.score_candidate(cand, req)
    assert scored.s_compat == 0.0
    assert scored.final_score_normalized == 0.0
    assert scored.final_score_100 == 0.0

def test_all_10_scenarios_execute():
    scenarios = get_scenario_fixtures()
    assert len(scenarios) == 10
    engine = RankingEngine(weight_profile="BALANCED")
    
    for sc in scenarios:
        ranked = engine.rank_sources(sc["candidates"], sc["request"], filter_incompatible=False)
        assert len(ranked) == len(sc["candidates"])
        # Verify ranks are ordered monotonically
        scores = [r.final_score_normalized for r in ranked]
        assert scores == sorted(scores, reverse=True)
        # Verify rank indices 1, 2, ...
        ranks = [r.rank for r in ranked]
        assert ranks == list(range(1, len(ranked) + 1))

def test_shortage_risk_wiring_and_mitigation():
    engine = RankingEngine(weight_profile="BALANCED")
    
    cand_bank = CandidateSource(
        id="C-BANK-LOW-STOCK",
        name="District Hospital Depot",
        source_type="BLOOD_BANK",
        blood_group="O-",
        lat=18.9934, lon=72.8427,
        available_units=1,
        data_age_hours=0.5
    )
    cand_donor = CandidateSource(
        id="C-VOLUNTARY-DONOR",
        name="Active Voluntary Donor",
        source_type="DONOR",
        blood_group="O-",
        lat=18.9950, lon=72.8440,
        available_units=1,
        data_age_hours=0.2,
        historical_fulfillment_rate=0.98
    )
    
    req_critical_shortage = EmergencyRequest(
        request_id="REQ-SHORTAGE-TEST",
        patient_group="O-",
        component="PRBC",
        units_needed=1,
        lat=18.9934, lon=72.8427,
        shortage_risk="CRITICAL",
        shortage_risk_score=95.0
    )
    
    scored_bank = engine.score_candidate(cand_bank, req_critical_shortage)
    scored_donor = engine.score_candidate(cand_donor, req_critical_shortage)
    
    # Verify shortage score wiring
    assert scored_bank.s_shortage == 1.0
    assert scored_donor.s_shortage == 1.0
    
    # Verify shortage transparency notes in reasoning
    assert any("CRITICAL" in note for note in scored_bank.why_recommended)
    assert any("donor prioritized to preserve" in note.lower() for note in scored_donor.why_recommended)
    
    # Test preservation policy execution
    ranked_normal = engine.rank_sources([cand_bank, cand_donor], req_critical_shortage, apply_shortage_preservation_policy=False)
    ranked_preservation = engine.rank_sources([cand_bank, cand_donor], req_critical_shortage, apply_shortage_preservation_policy=True)
    
    # Donor score is boosted under preservation policy
    donor_score_normal = next(r for r in ranked_normal if r.source_type == "DONOR").final_score_100
    donor_score_boosted = next(r for r in ranked_preservation if r.source_type == "DONOR").final_score_100
    assert donor_score_boosted >= donor_score_normal

