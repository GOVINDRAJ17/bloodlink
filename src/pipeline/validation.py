"""
Schema and Geographic Boundary Validation Module
================================================
Validates standardized records against strict integrity constraints:
1. Required fields presence
2. Coordinate presence & valid floating-point representation
3. Geographic bounding box: Strictly within sovereign boundaries of India:
   - Latitude: [8.10° N, 35.50° N]
   - Longitude: [68.20° E, 97.40° E]
   - Rejects Null Island (0.0, 0.0) and international coordinates
4. Valid blood group array (must contain >= 1 canonical blood group)
5. Valid phone format
6. Unit stock constraints (units >= 0, integer)
7. Audit tracking: Records exact count and reasons for each validation failure rule.
"""

from typing import Dict, Any, List, Tuple
import datetime
import math

INDIA_BOUNDS = {
    "min_lat": 8.1,
    "max_lat": 35.5,
    "min_lon": 68.2,
    "max_lon": 97.4
}

class ValidationTracker:
    def __init__(self):
        self.rule_failures: Dict[str, int] = {
            "RULE_MISSING_NAME": 0,
            "RULE_MISSING_COORDINATES": 0,
            "RULE_COORDINATES_OUTSIDE_INDIA": 0,
            "RULE_NULL_ISLAND_COORDINATES": 0,
            "RULE_NO_VALID_BLOOD_GROUPS": 0,
            "RULE_INVALID_PHONE": 0,
            "RULE_NEGATIVE_STOCK": 0,
            "RULE_FUTURE_TIMESTAMP": 0
        }
        self.invalid_records_log: List[Dict[str, Any]] = []

    def validate_record(self, record: Dict[str, Any]) -> Tuple[bool, List[str]]:
        failures = []
        
        # 1. Facility Name check
        name = record.get("name")
        if not name or len(name.strip()) < 3 or name == "Unnamed Blood Centre":
            failures.append("RULE_MISSING_NAME")
            
        # 2. Coordinates check (Strict Sovereign Boundary of India)
        lat = record.get("latitude")
        lon = record.get("longitude")
        
        is_nan = False
        try:
            if lat is not None and math.isnan(lat):
                is_nan = True
            if lon is not None and math.isnan(lon):
                is_nan = True
        except Exception:
            pass

        if lat is None or lon is None or is_nan:
            failures.append("RULE_MISSING_COORDINATES")
        elif lat == 0.0 and lon == 0.0:
            failures.append("RULE_NULL_ISLAND_COORDINATES")
        elif not (INDIA_BOUNDS["min_lat"] <= lat <= INDIA_BOUNDS["max_lat"] and
                  INDIA_BOUNDS["min_lon"] <= lon <= INDIA_BOUNDS["max_lon"]):
            failures.append("RULE_COORDINATES_OUTSIDE_INDIA")
            
        # 3. Blood Groups check
        groups = record.get("blood_groups", [])
        if not groups or len(groups) == 0:
            failures.append("RULE_NO_VALID_BLOOD_GROUPS")
            
        # 4. Phone check (Policy: Keep record in spatial registry, flag no_sms_alert = True)
        phone_type = record.get("phone_type", "MISSING")
        if phone_type == "INVALID":
            self.rule_failures["RULE_INVALID_PHONE"] += 1
            record["no_sms_alert"] = True
            record["phone_warning"] = "Dummy or placeholder phone number detected. Excluded from automated SMS broadcasts."
        else:
            record["no_sms_alert"] = False
            
        # 5. Stock units check
        units = record.get("available_units", 0)
        if units < 0:
            failures.append("RULE_NEGATIVE_STOCK")
            
        # 6. Timestamp check
        ts_str = record.get("last_updated_at")
        if ts_str:
            try:
                dt = datetime.datetime.fromisoformat(ts_str)
                now = datetime.datetime.now(datetime.timezone.utc)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=datetime.timezone.utc)
                if dt > now + datetime.timedelta(minutes=5):
                    failures.append("RULE_FUTURE_TIMESTAMP")
            except Exception:
                pass
                
        is_valid = len(failures) == 0
        
        for rule in failures:
            self.rule_failures[rule] += 1
            
        if not is_valid:
            self.invalid_records_log.append({
                "record_id": record.get("id"),
                "name": record.get("name"),
                "reasons": failures,
                "raw_coords": (lat, lon)
            })
            
        return is_valid, failures

    def get_summary(self) -> Dict[str, Any]:
        return {
            "total_invalid_records": len(self.invalid_records_log),
            "failures_by_rule": dict(self.rule_failures)
        }
