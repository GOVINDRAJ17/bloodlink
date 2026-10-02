"""
BloodLink Emergency Blood Ranking Engine - Centralized Configuration
===================================================================
Defines all weights, normalization boundaries, decay constants, component compatibility matrices,
and urgency profiles. Designed for research reproducibility and sensitivity tuning.
"""

from typing import Dict, Any, List
import math

# Default Half-Life for Blood Bank Inventory Freshness (hours)
# t_half = 12.0 hours -> lambda = ln(2) / 12.0 ~= 0.057762
DEFAULT_FRESHNESS_HALF_LIFE_HOURS = 12.0
DEFAULT_LAMBDA = math.log(2) / DEFAULT_FRESHNESS_HALF_LIFE_HOURS

# Road transit winding coefficient for urban Indian road grids (empirical detour index)
DEFAULT_ROAD_CIRCUITOUS_FACTOR = 1.28

# Search boundaries (kilometers)
DEFAULT_MAX_RADIUS_KM = 50.0
MIN_RADIUS_KM = 1.0

# Transit speeds (km/h) by urgency level
URGENCY_SPEED_KMH = {
    "NORMAL": 28.0,     # Normal city traffic
    "URGENT": 36.0,     # Priority route
    "CRITICAL": 45.0    # Green corridor / emergency siren transit
}

# Operational dispatch handling buffer (minutes)
PREPARATION_BUFFER_MINUTES = {
    "BLOOD_BANK": {
        "NORMAL": 20.0,
        "URGENT": 12.0,
        "CRITICAL": 5.0
    },
    "DONOR": {
        "NORMAL": 30.0,
        "URGENT": 20.0,
        "CRITICAL": 10.0
    }
}

# Multi-Criteria Weight Profiles (Must sum to 1.0)
WEIGHT_PROFILES: Dict[str, Dict[str, float]] = {
    "BALANCED": {
        "W_compatibility": 0.35,
        "W_distance": 0.20,
        "W_eta": 0.20,
        "W_reliability": 0.15,
        "W_freshness": 0.10
    },
    "CRITICAL_EMERGENCY": {
        "W_compatibility": 0.25,
        "W_distance": 0.15,
        "W_eta": 0.40,
        "W_reliability": 0.05,
        "W_freshness": 0.15
    },
    "RURAL_SPARSE": {
        "W_compatibility": 0.35,
        "W_distance": 0.10,
        "W_eta": 0.20,
        "W_reliability": 0.20,
        "W_freshness": 0.15
    },
    "QUALITY_FIRST": {
        "W_compatibility": 0.45,
        "W_distance": 0.15,
        "W_eta": 0.15,
        "W_reliability": 0.15,
        "W_freshness": 0.10
    },
    "DISTANCE_ONLY_BASELINE": {
        "W_compatibility": 0.00,
        "W_distance": 1.00,
        "W_eta": 0.00,
        "W_reliability": 0.00,
        "W_freshness": 0.00
    }
}

# Component Compatibility Scores
COMPATIBILITY_SCORES = {
    "EXACT_MATCH": 1.0,
    "COMPATIBLE_SUBSTITUTE_HIGH": 0.85,
    "COMPATIBLE_SUBSTITUTE_MED": 0.75,
    "INCOMPATIBLE": 0.0
}

# Component-specific compatibility rules
# Key: (Component, RecipientGroup) -> Dict of {DonorGroup: Score}
# Authoritative reference: DGHS (Directorate General of Health Services) & AABB Guidelines
COMPONENT_COMPATIBILITY_RULES: Dict[str, Dict[str, Dict[str, float]]] = {
    # 1. Packed Red Blood Cells (PRBC) & Whole Blood Cellular compatibility
    "PRBC": {
        "O-":  {"O-": 1.0},
        "O+":  {"O+": 1.0, "O-": 0.85},
        "A-":  {"A-": 1.0, "O-": 0.85},
        "A+":  {"A+": 1.0, "A-": 0.85, "O+": 0.80, "O-": 0.75},
        "B-":  {"B-": 1.0, "O-": 0.85},
        "B+":  {"B+": 1.0, "B-": 0.85, "O+": 0.80, "O-": 0.75},
        "AB-": {"AB-": 1.0, "A-": 0.85, "B-": 0.85, "O-": 0.75},
        "AB+": {"AB+": 1.0, "AB-": 0.90, "A+": 0.85, "A-": 0.80, "B+": 0.85, "B-": 0.80, "O+": 0.80, "O-": 0.75},
        "Oh-": {"Oh-": 1.0},
        "Oh+": {"Oh+": 1.0, "Oh-": 0.85}
    },
    "WHOLE_BLOOD": {
        "O-":  {"O-": 1.0},
        "O+":  {"O+": 1.0, "O-": 0.80},
        "A-":  {"A-": 1.0, "O-": 0.80},
        "A+":  {"A+": 1.0, "A-": 0.85, "O+": 0.75, "O-": 0.70},
        "B-":  {"B-": 1.0, "O-": 0.80},
        "B+":  {"B+": 1.0, "B-": 0.85, "O+": 0.75, "O-": 0.70},
        "AB-": {"AB-": 1.0, "A-": 0.80, "B-": 0.80, "O-": 0.70},
        "AB+": {"AB+": 1.0, "AB-": 0.85, "A+": 0.80, "A-": 0.75, "B+": 0.80, "B-": 0.75, "O+": 0.70, "O-": 0.65},
        "Oh-": {"Oh-": 1.0},
        "Oh+": {"Oh+": 1.0, "Oh-": 0.85}
    },
    # 2. Fresh Frozen Plasma (FFP) - AB is universal donor, O is universal recipient
    "PLASMA": {
        "O-":  {"O-": 1.0, "O+": 0.95, "A-": 0.85, "A+": 0.85, "B-": 0.85, "B+": 0.85, "AB-": 0.90, "AB+": 0.90},
        "O+":  {"O+": 1.0, "A+": 0.85, "B+": 0.85, "AB+": 0.90},
        "A-":  {"A-": 1.0, "A+": 0.95, "AB-": 0.90, "AB+": 0.90},
        "A+":  {"A+": 1.0, "AB+": 0.90},
        "B-":  {"B-": 1.0, "B+": 0.95, "AB-": 0.90, "AB+": 0.90},
        "B+":  {"B+": 1.0, "AB+": 0.90},
        "AB-": {"AB-": 1.0, "AB+": 0.95},
        "AB+": {"AB+": 1.0},
        "Oh-": {"Oh-": 1.0, "Oh+": 0.95, "AB-": 0.90, "AB+": 0.90},
        "Oh+": {"Oh+": 1.0, "AB+": 0.90}
    },
    # 3. Platelets (RDP / SDP) - Identical preferred; ABO-compatible secondary acceptable
    "PLATELETS": {
        "O-":  {"O-": 1.0, "A-": 0.80, "B-": 0.80, "AB-": 0.75},
        "O+":  {"O+": 1.0, "O-": 0.90, "A+": 0.80, "B+": 0.80, "AB+": 0.75},
        "A-":  {"A-": 1.0, "O-": 0.85, "AB-": 0.80},
        "A+":  {"A+": 1.0, "A-": 0.90, "O+": 0.85, "O-": 0.80, "AB+": 0.80},
        "B-":  {"B-": 1.0, "O-": 0.85, "AB-": 0.80},
        "B+":  {"B+": 1.0, "B-": 0.90, "O+": 0.85, "O-": 0.80, "AB+": 0.80},
        "AB-": {"AB-": 1.0, "A-": 0.85, "B-": 0.85, "O-": 0.80},
        "AB+": {"AB+": 1.0, "AB-": 0.90, "A+": 0.85, "B+": 0.85, "O+": 0.80},
        "Oh-": {"Oh-": 1.0},
        "Oh+": {"Oh+": 1.0, "Oh-": 0.85}
    },
    # 4. Cryoprecipitate - Fibrinogen / Factor VIII
    "CRYOPRECIPITATE": {
        "O-":  {"O-": 1.0, "O+": 0.95, "A-": 0.90, "A+": 0.90, "B-": 0.90, "B+": 0.90, "AB-": 0.90, "AB+": 0.90},
        "O+":  {"O+": 1.0, "O-": 0.95, "A+": 0.90, "B+": 0.90, "AB+": 0.90},
        "A-":  {"A-": 1.0, "A+": 0.95, "O-": 0.90, "AB-": 0.90},
        "A+":  {"A+": 1.0, "A-": 0.95, "O+": 0.90, "AB+": 0.90},
        "B-":  {"B-": 1.0, "B+": 0.95, "O-": 0.90, "AB-": 0.90},
        "B+":  {"B+": 1.0, "B-": 0.95, "O+": 0.90, "AB+": 0.90},
        "AB-": {"AB-": 1.0, "AB+": 0.95, "A-": 0.90, "B-": 0.90, "O-": 0.85},
        "AB+": {"AB+": 1.0, "AB-": 0.95, "A+": 0.90, "B+": 0.90, "O+": 0.85},
        "Oh-": {"Oh-": 1.0, "Oh+": 0.95},
        "Oh+": {"Oh+": 1.0, "Oh-": 0.95}
    }
}
