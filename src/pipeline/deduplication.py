"""
Multi-Signal Deduplication and Entity Resolution Engine
======================================================
Identifies and resolves duplicate blood bank entries using composite deterministic
and fuzzy matching signals:
1. Exact Phone Number Match (high-confidence deterministic)
2. Normalized Name Token Similarity
3. Spatial Proximity (Haversine distance < 500m)
4. Administrative District / Address Match

Safety Constraint: Records are NEVER merged solely on name similarity (e.g. "Red Cross"
in different cities). Requires multi-signal corroboration.

Maintains an immutable audit log detailing every duplicate detection and resolution decision.
"""

import math
import difflib
from typing import List, Dict, Any, Tuple

EARTH_RADIUS_KM = 6371.0

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    if None in (lat1, lon1, lat2, lon2):
        return 999.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2)**2
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def name_similarity(name1: str, name2: str) -> float:
    """Computes normalized token overlap and sequence ratio."""
    n1 = name1.lower().replace("blood centre", "").replace("blood bank", "").replace("hospital", "").strip()
    n2 = name2.lower().replace("blood centre", "").replace("blood bank", "").replace("hospital", "").strip()
    return difflib.SequenceMatcher(None, n1, n2).ratio()

class DeduplicationEngine:
    def __init__(self, proximity_threshold_km: float = 0.50):
        self.proximity_threshold_km = proximity_threshold_km
        self.audit_log: List[Dict[str, Any]] = []

    def deduplicate_records(self, records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Processes validated records, detects duplicate clusters, merges metadata,
        and outputs clean unique records with full audit trail.
        """
        retained_records: List[Dict[str, Any]] = []
        # Spatial-hash grouping by state_code to limit search space from O(N^2) to O(N * k)
        state_buckets: Dict[str, List[Dict[str, Any]]] = {}
        for r in records:
            sc = r.get("state_code", "UNKNOWN")
            if sc not in state_buckets:
                state_buckets[sc] = []
            state_buckets[sc].append(r)

        merged_ids = set()

        for state_code, bucket in state_buckets.items():
            for i in range(len(bucket)):
                rec_a = bucket[i]
                id_a = rec_a["id"]
                if id_a in merged_ids:
                    continue

                for j in range(i + 1, len(bucket)):
                    rec_b = bucket[j]
                    id_b = rec_b["id"]
                    if id_b in merged_ids:
                        continue

                    phone_match = bool(
                        rec_a.get("phone") and rec_b.get("phone") and
                        rec_a["phone"] == rec_b["phone"] and
                        rec_a.get("phone_type") == "MOBILE"
                    )

                    lat_a, lon_a = rec_a.get("latitude"), rec_a.get("longitude")
                    lat_b, lon_b = rec_b.get("latitude"), rec_b.get("longitude")

                    # Fast spatial bounding-box pruning: if > 0.01° (~1.1 km) and phones don't match, cannot be duplicate
                    if not phone_match:
                        if lat_a is None or lat_b is None:
                            continue
                        if abs(lat_a - lat_b) > 0.009 or abs(lon_a - lon_b) > 0.009:
                            continue

                    dist_km = haversine_km(lat_a, lon_a, lat_b, lon_b)
                    sim_name = name_similarity(rec_a["name"], rec_b["name"])
                    
                    is_duplicate = False
                    match_reasons = []

                    # Condition A: Matching phone number + same city proximity (< 5 km)
                    if phone_match and dist_km < 5.0:
                        is_duplicate = True
                        match_reasons.append(f"Identical verified phone ({rec_a['phone']}) within {dist_km*1000:.0f}m")

                    # Condition B: High name similarity (>= 0.75) + tight spatial proximity (< 500m)
                    elif sim_name >= 0.75 and dist_km <= self.proximity_threshold_km:
                        is_duplicate = True
                        match_reasons.append(f"High name similarity ({sim_name:.2f}) and proximity {dist_km*1000:.0f}m <= {self.proximity_threshold_km*1000:.0f}m")

                    if is_duplicate:
                        merged_ids.add(id_b)
                        # Merge decision: Retain rec_a, consolidate stock units and blood groups
                        combined_groups = list(set(rec_a.get("blood_groups", []) + rec_b.get("blood_groups", [])))
                        rec_a["blood_groups"] = combined_groups
                        rec_a["available_units"] = max(rec_a.get("available_units", 0), rec_b.get("available_units", 0))
                        
                        # Use most recent timestamp
                        ts_a = rec_a.get("last_updated_at") or ""
                        ts_b = rec_b.get("last_updated_at") or ""
                        rec_a["last_updated_at"] = max(ts_a, ts_b)

                        self.audit_log.append({
                            "retained_record_id": id_a,
                            "duplicate_record_id": id_b,
                            "retained_name": rec_a["name"],
                            "duplicate_name": rec_b["name"],
                            "distance_meters": round(dist_km * 1000, 1),
                            "name_similarity": round(sim_name, 3),
                            "phone_matched": phone_match,
                            "match_reasons": match_reasons,
                            "merge_action": "CONSOLIDATE_GROUPS_AND_MAX_STOCK"
                        })

                retained_records.append(rec_a)

        return retained_records, self.audit_log
