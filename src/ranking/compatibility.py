"""
Component-Specific Blood Compatibility Module
=============================================
Evaluates biological and immunological compatibility across blood components:
- PRBC / Packed Red Blood Cells (Cellular: Recipient antibodies vs Donor antigens; O- is universal)
- Whole Blood (Cellular + Plasma antibodies: Exact match strictly preferred)
- Plasma / FFP (Humoral: Donor antibodies vs Recipient antigens; AB is universal)
- Platelets (Cellular + trace plasma: Identical preferred, ABO-compatible emergency alternative)
- Cryoprecipitate (Concentrated clotting proteins: broad tolerance)
- Bombay Blood Group (Oh phenotype: strictly requires Oh donor due to anti-H)

Medical Disclaimer:
Algorithmic compatibility is for emergency resource coordination and ranking only.
It does NOT substitute for mandatory laboratory pre-transfusion cross-matching (Coombs test).
"""

from typing import Dict, Any, Optional, Tuple
from .config import COMPONENT_COMPATIBILITY_RULES

MEDICAL_DISCLAIMER = (
    "Informational emergency coordination layer only. Mandatory laboratory cross-matching "
    "must precede clinical transfusion."
)

def normalize_blood_group(group_input: Optional[str]) -> str:
    """Standardizes string variants like 'A+Ve', 'O-', 'oh+ve', 'B POSITIVE'."""
    if not group_input:
        return "O+"
    s = str(group_input).strip()
    s = s.replace(" ", "").replace("_", "")
    s = s.replace("+Ve", "+").replace("-Ve", "-").replace("+ve", "+").replace("-ve", "-")
    s = s.replace("POSITIVE", "+").replace("NEGATIVE", "-")
    s = s.replace("POS", "+").replace("NEG", "-")
    
    if s.lower().startswith("oh"):
        return "Oh-" if s.endswith("-") else "Oh+"
    
    # Capitalize standard groups
    s_upper = s.upper()
    if s_upper in ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]:
        return s_upper
    return s_upper

def evaluate_compatibility(
    recipient_group: str,
    donor_group: str,
    component: str = "PRBC",
    custom_rules: Optional[Dict[str, Dict[str, Dict[str, float]]]] = None
) -> Tuple[float, str, str]:
    """
    Evaluates compatibility between a recipient and candidate donor.
    
    Returns:
        (score: float in [0.0, 1.0], tier: str, rationale: str)
        where tier in ['EXACT', 'COMPATIBLE_SUBSTITUTE', 'INCOMPATIBLE']
    """
    rules = custom_rules or COMPONENT_COMPATIBILITY_RULES
    comp_key = component.upper().strip()
    if comp_key not in rules:
        # Fallback to PRBC if unmapped
        comp_key = "PRBC"
        
    rec = normalize_blood_group(recipient_group)
    don = normalize_blood_group(donor_group)
    
    # Check exact group match first
    if rec == don:
        return (
            1.0,
            "EXACT",
            f"Exact {rec} match for {comp_key}"
        )
        
    # Check component compatibility matrix
    comp_matrix = rules.get(comp_key, {})
    recipient_matrix = comp_matrix.get(rec, {})
    
    if don in recipient_matrix:
        sub_score = recipient_matrix[don]
        return (
            sub_score,
            "COMPATIBLE_SUBSTITUTE",
            f"Clinically acceptable substitute: {don} donor for {rec} recipient ({comp_key})"
        )
        
    return (
        0.0,
        "INCOMPATIBLE",
        f"Incompatible group: {don} cannot be transfused to {rec} for {comp_key}"
    )
