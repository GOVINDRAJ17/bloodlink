"""
Emergency Blood Ranking Engine
==============================
Implements the multi-criteria ranking formulation:
    FinalScore = W_c * S_compat + W_d * S_dist + W_e * S_eta + W_r * S_rel + W_f * S_fresh

Supports:
- Component-level compatibility matching
- Transparent step-by-step audit logging of all sub-scores
- Configurable weight profiles (Balanced, Critical, Rural, Quality-First, Distance-Only)
- Dynamic weight sensitivity analysis
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict

from .config import (
    WEIGHT_PROFILES,
    DEFAULT_MAX_RADIUS_KM,
    DEFAULT_LAMBDA
)
from .compatibility import evaluate_compatibility
from .normalization import (
    calculate_haversine_distance,
    normalize_distance_linear,
    calculate_eta,
    normalize_eta,
    calculate_reliability,
    calculate_freshness
)

@dataclass
class CandidateSource:
    id: str
    name: str
    source_type: str  # 'BLOOD_BANK' or 'DONOR'
    blood_group: str
    lat: float
    lon: float
    available_units: int
    data_age_hours: float
    verified: bool = True
    historical_fulfillment_rate: float = 0.90
    response_consistency: float = 0.85
    donor_repeat_count: int = 1
    notes: str = ""

@dataclass
class EmergencyRequest:
    request_id: str
    patient_group: str
    component: str  # 'PRBC', 'WHOLE_BLOOD', 'PLASMA', 'PLATELETS', 'CRYOPRECIPITATE'
    units_needed: int
    lat: float
    lon: float
    urgency: str = "NORMAL"  # 'NORMAL', 'URGENT', 'CRITICAL'
    max_radius_km: float = DEFAULT_MAX_RADIUS_KM
    # Task 5: Explicit Shortage Risk Input from ML / Predictive Shortage Analytics
    shortage_risk: str = "LOW"  # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    shortage_risk_score: float = 0.0  # 0.0 to 100.0

@dataclass
class ScoredCandidate:
    candidate_id: str
    name: str
    source_type: str
    blood_group: str
    distance_km: float
    total_eta_min: float
    transit_min: float
    prep_min: float
    compat_tier: str
    freshness_label: str
    
    # Sub-scores [0.0 - 1.0]
    s_compat: float
    s_dist: float
    s_eta: float
    s_rel: float
    s_fresh: float
    
    # Weights used
    weights: Dict[str, float]
    
    # Final composite score [0.0 - 1.0] and scaled [0 - 100]
    final_score_normalized: float
    final_score_100: float
    
    s_stock: float = 1.0
    s_shortage: float = 0.0
    rank: int = 0
    why_recommended: List[str] = field(default_factory=list)
    available_units: int = 0

class RankingEngine:
    def __init__(
        self,
        weight_profile: str = "BALANCED",
        custom_weights: Optional[Dict[str, float]] = None,
        decay_lambda: float = DEFAULT_LAMBDA,
        max_radius_km: float = DEFAULT_MAX_RADIUS_KM
    ):
        self.decay_lambda = decay_lambda
        self.max_radius_km = max_radius_km
        
        if custom_weights:
            self.weights = self._normalize_weights(custom_weights)
            self.profile_name = "CUSTOM"
        else:
            profile = WEIGHT_PROFILES.get(weight_profile, WEIGHT_PROFILES["BALANCED"])
            self.weights = self._normalize_weights(profile)
            self.profile_name = weight_profile

    @staticmethod
    def _normalize_weights(w: Dict[str, float]) -> Dict[str, float]:
        """Ensures weights sum exactly to 1.0."""
        total = sum(w.values())
        if total <= 0:
            raise ValueError("Sum of weights must be strictly positive.")
        return {k: round(v / total, 6) for k, v in w.items()}

    def score_candidate(
        self,
        candidate: CandidateSource,
        request: EmergencyRequest,
        apply_stock_penalty: bool = False,
        apply_shortage_preservation_policy: bool = False
    ) -> ScoredCandidate:
        # 1. Compatibility
        s_compat, tier, compat_rationale = evaluate_compatibility(
            recipient_group=request.patient_group,
            donor_group=candidate.blood_group,
            component=request.component
        )
        
        # 2. Distance
        distance_km = calculate_haversine_distance(
            request.lat, request.lon,
            candidate.lat, candidate.lon
        )
        s_dist = normalize_distance_linear(distance_km, request.max_radius_km)
        
        # 3. ETA
        total_eta_min, transit_min, prep_min = calculate_eta(
            distance_km=distance_km,
            source_type=candidate.source_type,
            urgency=request.urgency
        )
        s_eta = normalize_eta(total_eta_min)
        
        # 4. Reliability
        s_rel = calculate_reliability(
            source_type=candidate.source_type,
            verified=candidate.verified,
            historical_fulfillment_rate=candidate.historical_fulfillment_rate,
            response_consistency=candidate.response_consistency,
            donor_repeat_count=candidate.donor_repeat_count
        )
        
        # 5. Freshness
        s_fresh, fresh_label = calculate_freshness(
            age_hours=candidate.data_age_hours,
            decay_lambda=self.decay_lambda
        )
        
        # 6. Stock Adequacy
        s_stock = round(min(1.0, candidate.available_units / max(1, request.units_needed)), 4)

        # Composite Calculation
        w = self.weights
        if s_compat <= 0.0:
            # Medically incompatible sources are disqualified
            final_normalized = 0.0
        else:
            final_normalized = (
                w["W_compatibility"] * s_compat +
                w["W_distance"]      * s_dist +
                w["W_eta"]           * s_eta +
                w["W_reliability"]   * s_rel +
                w["W_freshness"]     * s_fresh
            )
            if apply_stock_penalty:
                # Proportional stock adequacy penalty (0 units -> 50% penalty, 1/4 units -> 37.5% penalty)
                stock_multiplier = 0.5 + 0.5 * s_stock
                final_normalized = final_normalized * stock_multiplier

        # 7. Shortage Risk Analysis (Task 5: Explicit ML input wiring)
        shortage_level_map = {"LOW": 0.1, "MEDIUM": 0.4, "HIGH": 0.75, "CRITICAL": 1.0}
        s_shortage = round(shortage_level_map.get(request.shortage_risk.upper(), request.shortage_risk_score / 100.0 if request.shortage_risk_score else 0.0), 3)

        if apply_shortage_preservation_policy and s_compat > 0.0:
            # During elevated regional shortage, mobilize live voluntary donors to preserve hospital inventory
            if candidate.source_type == "DONOR":
                donor_boost = 1.0 + (0.15 * s_shortage)
                final_normalized = min(1.0, final_normalized * donor_boost)

        final_normalized = round(max(0.0, min(1.0, final_normalized)), 4)
        final_100 = round(final_normalized * 100.0, 2)
        
        # Generate auditable reasoning
        why = []
        if tier == "EXACT":
            why.append(f"Exact match ({candidate.blood_group}) for {request.component}")
        elif tier == "COMPATIBLE_SUBSTITUTE":
            why.append(f"Clinically approved secondary match ({candidate.blood_group})")
        else:
            why.append(f"Incompatible group ({candidate.blood_group})")
            
        why.append(f"{distance_km:.1f} km away (~{total_eta_min:.0f}m ETA incl. {prep_min:.0f}m prep)")
        
        if candidate.source_type == "BLOOD_BANK":
            why.append(f"{candidate.available_units} units in inventory ({fresh_label})")
        else:
            why.append(f"Voluntary donor ({candidate.historical_fulfillment_rate*100:.0f}% fulfillment)")

        # Shortage transparency rationale
        if request.shortage_risk.upper() in ("HIGH", "CRITICAL"):
            if candidate.source_type == "DONOR":
                why.append(f"Shortage Mitigation: Live donor prioritized to preserve depleted hospital reserves ({request.shortage_risk} shortage risk)")
            else:
                why.append(f"Regional Shortage Context: {request.shortage_risk} risk for group {request.patient_group}")
            
        return ScoredCandidate(
            candidate_id=candidate.id,
            name=candidate.name,
            source_type=candidate.source_type,
            blood_group=candidate.blood_group,
            distance_km=distance_km,
            total_eta_min=total_eta_min,
            transit_min=transit_min,
            prep_min=prep_min,
            compat_tier=tier,
            freshness_label=fresh_label,
            s_compat=s_compat,
            s_dist=s_dist,
            s_eta=s_eta,
            s_rel=s_rel,
            s_fresh=s_fresh,
            s_stock=s_stock,
            s_shortage=s_shortage,
            weights=w,
            final_score_normalized=final_normalized,
            final_score_100=final_100,
            why_recommended=why,
            available_units=candidate.available_units
        )

    def rank_sources(
        self,
        candidates: List[CandidateSource],
        request: EmergencyRequest,
        filter_incompatible: bool = False,
        apply_stock_penalty: bool = False,
        apply_shortage_preservation_policy: bool = False
    ) -> List[ScoredCandidate]:
        scored = [
            self.score_candidate(
                c,
                request,
                apply_stock_penalty=apply_stock_penalty,
                apply_shortage_preservation_policy=apply_shortage_preservation_policy
            )
            for c in candidates
        ]
        
        if filter_incompatible:
            scored = [s for s in scored if s.s_compat > 0.0]
            
        # Sort descending: higher score first; tie breaker: closer distance
        scored.sort(key=lambda x: (x.final_score_normalized, -x.distance_km), reverse=True)
        
        for idx, item in enumerate(scored, start=1):
            item.rank = idx
            
        return scored

    @classmethod
    def run_sensitivity_analysis(
        cls,
        candidates: List[CandidateSource],
        request: EmergencyRequest,
        profiles: Optional[List[str]] = None
    ) -> Dict[str, List[ScoredCandidate]]:
        """Evaluates rankings of identical candidates under multiple weight configurations."""
        active_profiles = profiles or list(WEIGHT_PROFILES.keys())
        results = {}
        for p in active_profiles:
            engine = cls(weight_profile=p)
            ranked = engine.rank_sources(candidates, request, filter_incompatible=False)
            results[p] = ranked
        return results
