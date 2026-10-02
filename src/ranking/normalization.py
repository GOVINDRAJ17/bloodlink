"""
Feature Normalization and Scoring Mathematics Module
====================================================
Implements:
1. Haversine great-circle distance
2. Bounded distance normalization and discussion alternatives (exponential, sigmoid)
3. ETA computation with road winding factor and operational preparation buffer
4. Bounded ETA normalization
5. Multi-factor source reliability formulation
6. Continuous exponential inventory freshness decay S_fresh = exp(-lambda * delta_t)
"""

import math
from typing import Tuple, Dict, Any, Optional
from .config import (
    DEFAULT_MAX_RADIUS_KM,
    DEFAULT_ROAD_CIRCUITOUS_FACTOR,
    URGENCY_SPEED_KMH,
    PREPARATION_BUFFER_MINUTES,
    DEFAULT_LAMBDA
)

EARTH_RADIUS_KM = 6371.0

def calculate_haversine_distance(
    lat1: float, lon1: float,
    lat2: float, lon2: float
) -> float:
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    if any(v is None for v in [lat1, lon1, lat2, lon2]):
        return 999.0
        
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    
    return round(EARTH_RADIUS_KM * c, 2)

def normalize_distance_linear(
    distance_km: float,
    max_radius_km: float = DEFAULT_MAX_RADIUS_KM
) -> float:
    """
    Linear Bounded Distance Normalization:
        S_dist = 1.0 - min(distance / max_radius, 1.0)
    
    Range: [0.0, 1.0]. A source at distance 0 gets 1.0; a source at max_radius gets 0.0.
    """
    if max_radius_km <= 0:
        return 0.0
    ratio = distance_km / max_radius_km
    return max(0.0, min(1.0, 1.0 - ratio))

def normalize_distance_exponential(
    distance_km: float,
    beta: float = 0.05
) -> float:
    """
    Alternative Exponential Distance Decay:
        S_dist = exp(-beta * distance_km)
    
    Decays smoothly without hard boundary cutoff.
    """
    return round(math.exp(-beta * max(0.0, distance_km)), 4)

def calculate_eta(
    distance_km: float,
    source_type: str = "BLOOD_BANK",
    urgency: str = "NORMAL",
    circuitous_factor: float = DEFAULT_ROAD_CIRCUITOUS_FACTOR,
    custom_speed_kmh: Optional[float] = None,
    custom_prep_minutes: Optional[float] = None
) -> Tuple[float, float, float]:
    """
    Calculates estimated time of arrival (ETA) incorporating:
    1. Road network winding factor (effective road km = haversine * 1.28)
    2. Urban transit speed conditioned on priority level
    3. Operational preparation buffer (laboratory crossmatch release vs donor mobilization)
    
    Returns:
        (total_eta_min, transit_min, prep_min)
    """
    speed_kmh = custom_speed_kmh or URGENCY_SPEED_KMH.get(urgency, 28.0)
    
    if custom_prep_minutes is not None:
        prep_min = custom_prep_minutes
    else:
        st_key = "DONOR" if source_type.upper() == "DONOR" else "BLOOD_BANK"
        prep_min = PREPARATION_BUFFER_MINUTES.get(st_key, {}).get(urgency, 15.0)
        
    road_km = distance_km * circuitous_factor
    transit_min = (road_km / max(1.0, speed_kmh)) * 60.0
    
    total_eta_min = transit_min + prep_min
    return round(total_eta_min, 1), round(transit_min, 1), round(prep_min, 1)

def normalize_eta(
    total_eta_minutes: float,
    min_eta_minutes: float = 5.0,
    max_eta_minutes: float = 120.0
) -> float:
    """
    Linear Bounded ETA Normalization:
    Score is 1.0 for arrival within min_eta_minutes (e.g. <= 5m).
    Score degrades linearly to 0.0 at max_eta_minutes (e.g. >= 120m).
    """
    if total_eta_minutes <= min_eta_minutes:
        return 1.0
    if total_eta_minutes >= max_eta_minutes:
        return 0.0
    score = 1.0 - ((total_eta_minutes - min_eta_minutes) / (max_eta_minutes - min_eta_minutes))
    return round(max(0.0, min(1.0, score)), 4)

def calculate_reliability(
    source_type: str,
    verified: bool = True,
    historical_fulfillment_rate: float = 0.90,
    response_consistency: float = 0.85,
    donor_repeat_count: int = 1
) -> float:
    """
    Computes source reliability score S_rel in [0.0, 1.0].
    
    For Blood Banks:
      S_rel = 0.50 * verification_tier + 0.30 * fulfillment_rate + 0.20 * consistency
    
    For Donors:
      S_rel = 0.40 * response_rate + 0.35 * fulfillment_rate + 0.25 * experience_factor
    """
    st = source_type.upper()
    if st == "BLOOD_BANK":
        ver_score = 1.0 if verified else 0.70
        s_rel = (0.50 * ver_score +
                 0.30 * min(1.0, max(0.0, historical_fulfillment_rate)) +
                 0.20 * min(1.0, max(0.0, response_consistency)))
    else:
        # Donor reliability
        ver_score = 1.0 if verified else 0.60
        exp_score = min(1.0, 0.5 + (donor_repeat_count * 0.1))
        s_rel = (0.40 * min(1.0, max(0.0, response_consistency)) +
                 0.35 * min(1.0, max(0.0, historical_fulfillment_rate)) +
                 0.25 * exp_score)
                 
    return round(max(0.0, min(1.0, s_rel)), 4)

def calculate_freshness(
    age_hours: float,
    decay_lambda: float = DEFAULT_LAMBDA
) -> Tuple[float, str]:
    """
    Exponential Inventory Freshness Decay:
        S_fresh = exp(-lambda * age_hours)
    
    With half-life t_half = 12h:
      0h:  S_fresh = 1.00  (Fresh)
      2h:  S_fresh = 0.89  (Fresh)
      6h:  S_fresh = 0.71  (Aging)
      12h: S_fresh = 0.50  (Aging/Stale boundary)
      24h: S_fresh = 0.25  (Stale)
      48h: S_fresh = 0.06  (Critically Stale)
      
    Returns:
        (score: float in [0.0, 1.0], label: str)
    """
    clamped_age = max(0.0, age_hours)
    score = math.exp(-decay_lambda * clamped_age)
    rounded_score = round(score, 4)
    
    if clamped_age <= 2.0:
        label = "Fresh (Recently Verified)"
    elif clamped_age <= 12.0:
        label = "Aging (Verification Advised)"
    else:
        label = "Stale (Unverified Inventory)"
        
    return rounded_score, label
