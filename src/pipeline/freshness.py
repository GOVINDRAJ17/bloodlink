"""
Freshness Management and Ranking Decay Service
=============================================
Manages stock data currency and operational trust:
1. Calculates elapsed age from last_updated_at timestamp
2. Maps inventory age into 4 clinical operational statuses:
   - FRESH:   <= 2 hours    (S_fresh >= 0.89)  -> Safe for immediate dispatch
   - AGING:   2 to 12 hours (0.50 <= S_fresh < 0.89) -> Telephone verification recommended
   - STALE:   > 12 hours    (S_fresh < 0.50)   -> Unverified inventory; heavily penalized
   - UNKNOWN: Missing/invalid timestamp        -> Assigned baseline penalty (S_fresh = 0.40)
3. Configurable exponential decay: S_fresh = exp(-lambda * delta_t_hours)
4. Provides a transparent ranking demonstration proving how a nearby stale source
   is correctly downranked below a slightly farther, recently verified source.
"""

import math
import datetime
from typing import Dict, Any, Tuple, Optional

DEFAULT_HALF_LIFE_HOURS = 12.0
DEFAULT_LAMBDA = math.log(2) / DEFAULT_HALF_LIFE_HOURS  # ~0.057762

def compute_freshness_metrics(
    updated_at_iso: Optional[str],
    reference_time: Optional[datetime.datetime] = None,
    decay_lambda: float = DEFAULT_LAMBDA
) -> Dict[str, Any]:
    """
    Computes elapsed time, freshness confidence score, and clinical status.
    """
    if not updated_at_iso:
        return {
            "elapsed_hours": None,
            "confidence_score": 0.40,
            "status": "UNKNOWN",
            "is_stale": True,
            "human_readable": "Timestamp missing"
        }
        
    try:
        updated_dt = datetime.datetime.fromisoformat(updated_at_iso)
        if updated_dt.tzinfo is None:
            updated_dt = updated_dt.replace(tzinfo=datetime.timezone.utc)
    except Exception:
        return {
            "elapsed_hours": None,
            "confidence_score": 0.40,
            "status": "UNKNOWN",
            "is_stale": True,
            "human_readable": "Timestamp malformed"
        }
        
    ref_dt = reference_time or datetime.datetime.now(datetime.timezone.utc)
    diff_sec = max(0.0, (ref_dt - updated_dt).total_seconds())
    elapsed_hours = round(diff_sec / 3600.0, 2)
    
    # Exponential decay formula
    confidence = math.exp(-decay_lambda * elapsed_hours)
    confidence = round(max(0.0, min(1.0, confidence)), 4)
    
    if elapsed_hours <= 2.0:
        status = "FRESH"
        is_stale = False
    elif elapsed_hours <= 12.0:
        status = "AGING"
        is_stale = False
    else:
        status = "STALE"
        is_stale = True
        
    if elapsed_hours < 1.0:
        human = f"{int(diff_sec // 60)}m ago"
    elif elapsed_hours < 24.0:
        human = f"{elapsed_hours:.1f}h ago"
    else:
        human = f"{elapsed_hours / 24.0:.1f}d ago"
        
    return {
        "elapsed_hours": elapsed_hours,
        "confidence_score": confidence,
        "status": status,
        "is_stale": is_stale,
        "human_readable": human
    }

def demonstrate_stale_ranking_tradeoff() -> Dict[str, Any]:
    """
    Demonstrates transparent ranking shift between:
    - Candidate A: Extremely close (0.8 km) but 48 hours stale (unverified ghost stock)
    - Candidate B: Moderately farther (4.5 km) but verified 45 minutes ago (Fresh)
    Uses the multi-criteria RankingEngine from src.ranking.engine.
    """
    from src.ranking.engine import RankingEngine, CandidateSource, EmergencyRequest
    
    engine = RankingEngine(weight_profile="BALANCED")
    
    # Request: A+ PRBC at KEM Mumbai (18.9934, 72.8427)
    req = EmergencyRequest(
        request_id="REQ-FRESHNESS-DEMO",
        patient_group="A+",
        component="PRBC",
        units_needed=2,
        lat=18.9934,
        lon=72.8427,
        urgency="NORMAL",
        max_radius_km=30.0
    )
    
    cand_a = CandidateSource(
        id="CAND-STALE-NEAR",
        name="Local Dispensary Depot",
        source_type="BLOOD_BANK",
        blood_group="A+",
        lat=19.0006, lon=72.8427, # ~0.8 km
        available_units=6,
        data_age_hours=48.0,
        verified=False,
        historical_fulfillment_rate=0.70
    )
    
    cand_b = CandidateSource(
        id="CAND-FRESH-MID",
        name="District General Hospital Blood Bank",
        source_type="BLOOD_BANK",
        blood_group="A+",
        lat=19.0339, lon=72.8427, # ~4.5 km
        available_units=12,
        data_age_hours=0.75,
        verified=True,
        historical_fulfillment_rate=0.98
    )
    
    ranked = engine.rank_sources([cand_a, cand_b], req)
    res_a = next(r for r in ranked if r.candidate_id == "CAND-STALE-NEAR")
    res_b = next(r for r in ranked if r.candidate_id == "CAND-FRESH-MID")
    
    return {
        "candidate_a": {
            "name": res_a.name,
            "distance_km": res_a.distance_km,
            "age_hours": cand_a.data_age_hours,
            "status": "STALE",
            "s_compat": res_a.s_compat,
            "s_dist": res_a.s_dist,
            "s_eta": res_a.s_eta,
            "s_rel": res_a.s_rel,
            "s_fresh": res_a.s_fresh,
            "composite_score": res_a.final_score_100,
            "rank": res_a.rank
        },
        "candidate_b": {
            "name": res_b.name,
            "distance_km": res_b.distance_km,
            "age_hours": cand_b.data_age_hours,
            "status": "FRESH",
            "s_compat": res_b.s_compat,
            "s_dist": res_b.s_dist,
            "s_eta": res_b.s_eta,
            "s_rel": res_b.s_rel,
            "s_fresh": res_b.s_fresh,
            "composite_score": res_b.final_score_100,
            "rank": res_b.rank
        },
        "weights_used": engine.weights,
        "conclusion": f"Under the BALANCED profile, {res_b.name} (Rank #{res_b.rank}, Score {res_b.final_score_100:.2f}) outranks {res_a.name} (Rank #{res_a.rank}, Score {res_a.final_score_100:.2f}) because 48-hour unverified data decays freshness to {res_a.s_fresh:.4f}."
    }
