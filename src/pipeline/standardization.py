"""
Data Standardization Module
===========================
Standardizes raw hospital, blood bank, and inventory inputs:
1. Blood group string canonicalization
2. Facility name cleanup & title-casing
3. Address, city, and state normalizations
4. Phone number parsing to E.164 / standard Indian 10-digit format
5. Email lowercasing and sanitization
6. Latitude / Longitude type conversion
7. Preserves original raw fields for regulatory auditability
"""

import re
from typing import Dict, Any, List, Optional, Tuple

CANONICAL_BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Oh+", "Oh-"}

def standardize_blood_group(raw_group: Any) -> Optional[str]:
    """Standardizes variations like 'A +ve', 'B POSITIVE', 'o-ve', 'AB NEG' into canonical formats."""
    if raw_group is None:
        return None
    s = str(raw_group).strip().upper()
    s = re.sub(r"[\s_]", "", s)
    s = s.replace("+VE", "+").replace("-VE", "-")
    s = s.replace("POSITIVE", "+").replace("NEGATIVE", "-")
    s = s.replace("POS", "+").replace("NEG", "-")
    
    if s.startswith("OH"):
        return "Oh-" if s.endswith("-") else "Oh+"
        
    if s in CANONICAL_BLOOD_GROUPS:
        return s
    return None

def standardize_facility_name(raw_name: Any) -> str:
    """Normalizes whitespace, removes trailing commas, applies Title Case."""
    if not raw_name or not isinstance(raw_name, str):
        return "Unnamed Blood Centre"
    clean = re.sub(r"[\s\t\n]+", " ", raw_name).strip()
    clean = re.sub(r"^[,.\s]+|[,.\s]+$", "", clean)
    # Title Case conversion while keeping abbreviations like KEM, AIIMS, Parel
    words = clean.split()
    standardized_words = []
    for w in words:
        if w.upper() in {"KEM", "AIIMS", "NABH", "NIIH", "MC", "MMC", "PHC", "SDH", "DH"}:
            standardized_words.append(w.upper())
        else:
            standardized_words.append(w.capitalize())
    return " ".join(standardized_words)

def standardize_phone(raw_phone: Any) -> Tuple[Optional[str], str]:
    """
    Standardizes Indian phone numbers into clean formatted strings.
    Returns: (standardized_phone, phone_type: 'MOBILE'|'LANDLINE'|'INVALID'|'MISSING')
    """
    if not raw_phone or not str(raw_phone).strip():
        return None, "MISSING"
        
    digits = re.sub(r"\D", "", str(raw_phone))
    
    # Check dummy/placeholder sequences
    if digits in {"0000000000", "9999999999", "1234567890", "1111111111"}:
        return None, "INVALID"
        
    # Strip leading country code 91 or 0
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
        
    if len(digits) == 10:
        if digits[0] in "6789":
            return f"+91-{digits[:5]}-{digits[5:]}", "MOBILE"
        else:
            return f"0{digits[:2]}-{digits[2:]}", "LANDLINE"
    elif 8 <= len(digits) <= 11:
        return digits, "LANDLINE"
        
    return None, "INVALID"

def standardize_email(raw_email: Any) -> Optional[str]:
    """Sanitizes email string."""
    if not raw_email or not isinstance(raw_email, str):
        return None
    email_clean = raw_email.strip().lower()
    if re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email_clean):
        return email_clean
    return None

def standardize_record(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transforms a single raw blood bank record into standardized form,
    preserving raw inputs for provenance tracking.
    """
    std_name = standardize_facility_name(raw.get("hospital_name"))
    std_phone, phone_type = standardize_phone(raw.get("phone"))
    std_email = standardize_email(raw.get("email"))
    
    # Blood groups array normalization
    raw_groups = raw.get("blood_groups_available", [])
    std_groups = []
    if isinstance(raw_groups, list):
        for g in raw_groups:
            norm_g = standardize_blood_group(g)
            if norm_g and norm_g not in std_groups:
                std_groups.append(norm_g)
                
    # Coordinate parsing
    raw_lat = raw.get("latitude")
    raw_lon = raw.get("longitude")
    try:
        lat = float(raw_lat) if raw_lat is not None else None
    except (ValueError, TypeError):
        lat = None
    try:
        lon = float(raw_lon) if raw_lon is not None else None
    except (ValueError, TypeError):
        lon = None
        
    return {
        # Standardized Fields
        "id": raw.get("raw_id"),
        "name": std_name,
        "state_code": str(raw.get("state_code", "")).strip(),
        "state_name": str(raw.get("state_name", "")).strip().title(),
        "district_name": str(raw.get("district_name", "")).strip().title(),
        "address": str(raw.get("address", "")).strip(),
        "latitude": lat,
        "longitude": lon,
        "phone": std_phone,
        "phone_type": phone_type,
        "email": std_email,
        "hospital_type": raw.get("hospital_type", "Government"),
        "blood_groups": std_groups,
        "available_units": int(raw.get("available_units", 0)),
        "verified": bool(raw.get("verified", False)),
        "last_updated_at": raw.get("last_updated_at"),
        
        # Provenance Audit Fields
        "_provenance": {
            "raw_id": raw.get("raw_id"),
            "raw_name": raw.get("hospital_name"),
            "raw_phone": raw.get("phone"),
            "raw_email": raw.get("email"),
            "raw_coords": (raw_lat, raw_lon)
        }
    }
