"""
BloodLink Ingestion, Quality Audit, Freshness, and Resilience CLI Pipeline
==========================================================================
Executes the complete end-to-end data pipeline:
RAW INGESTION -> STANDARDIZATION -> VALIDATION -> DEDUPLICATION -> QUALITY CHECK -> FRESHNESS MANAGEMENT -> APPLICATION RESILIENCE

Provenance Note:
If --input-csv is supplied, loads real eRaktKosh / data.gov.in export.
Otherwise, generates SYNTHETIC national dataset for reproducibility.

Outputs:
- pipeline_data_quality_report.json
- deduplication_audit_log.csv
- api_resilience_simulation_results.json
"""

import sys
import os
import json
import csv
import argparse
import pandas as pd
from typing import Dict, Any, Optional

from .raw_dataset_generator import generate_raw_national_dataset
from .standardization import standardize_record
from .validation import ValidationTracker
from .deduplication import DeduplicationEngine
from .freshness import compute_freshness_metrics, demonstrate_stale_ranking_tradeoff
from .quality_reporter import generate_quality_report, print_quality_report_summary
from .resilience import run_resilience_simulation_suite
from .additional_datasets import ADDITIONAL_DATASETS_CATALOG

def load_real_or_synthetic_dataset(
    input_csv: Optional[str] = None,
    n_records: int = 4487,
    seed: int = 42
) -> tuple[pd.DataFrame, str, bool]:
    """
    Loads real CSV if path provided; otherwise generates controlled synthetic dataset.
    """
    if input_csv and os.path.exists(input_csv):
        print(f"\n[PROVENANCE] Loading REAL export CSV from: {input_csv}")
        df = pd.read_csv(input_csv)
        # Column name canonicalization for standard data.gov.in exports
        col_map = {
            "sr_no": "id",
            "hospitalCode": "id",
            "blood_bank_name": "name",
            "hospitalname": "name",
            "state_name": "state",
            "stateName": "state",
            "district_name": "district",
            "districtName": "district",
            "contact_no": "phone",
            "hospitalcontact": "phone",
            "mobile": "phone",
            "email_id": "email",
            "address": "address",
            "hospitaladd": "address",
            "lat": "latitude",
            "lon": "longitude",
            "long": "longitude"
        }
        df = df.rename(columns={c: col_map[c] for c in df.columns if c in col_map})
        
        # Ensure mandatory columns exist
        if "id" not in df.columns:
            df["id"] = [f"REAL-BB-{i+1:05d}" for i in range(len(df))]
        if "available_units" not in df.columns:
            df["available_units"] = 10
        if "blood_groups" not in df.columns:
            df["blood_groups"] = "A+, B+, O+, AB+"
        if "last_updated_at" not in df.columns:
            import datetime
            df["last_updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
        provenance = f"REAL_DATA_GOV_IN_EXPORT_{os.path.basename(input_csv)}"
        is_synthetic = False
    else:
        if input_csv:
            print(f"\n[WARNING] Specified --input-csv '{input_csv}' not found. Falling back to SYNTHETIC generator.")
        print("\n****************************************************************************************************")
        print("[PROVENANCE: SYNTHETIC] Using simulated national eRaktKosh dataset (N=4,487).")
        print("To supply real eRaktKosh / data.gov.in data, run with: --input-csv <path-to-export.csv>")
        print("****************************************************************************************************")
        df = generate_raw_national_dataset(n_total=n_records, seed=seed)
        provenance = "SYNTHETIC_SIMULATED_NATIONAL_ERAKTKOSH_DATASET_N4487"
        is_synthetic = True
        
    return df, provenance, is_synthetic

def run_full_pipeline(
    input_csv: Optional[str] = None,
    n_records: int = 4487,
    seed: int = 42,
    output_report_json: str = "pipeline_data_quality_report.json",
    output_audit_csv: str = "deduplication_audit_log.csv",
    output_resilience_json: str = "api_resilience_simulation_results.json"
):
    print("=" * 100)
    print(f"RUNNING BLOODLINK DATA PIPELINE")
    print("=" * 100)
    
    # 1. RAW INGESTION
    print("\n[STAGE 1/6] Ingesting National eRaktKosh Dataset...")
    raw_df, provenance, is_synthetic = load_real_or_synthetic_dataset(input_csv, n_records=n_records, seed=seed)
    print(f"  -> Ingested {len(raw_df):,} raw records. Data Provenance: {provenance} (Synthetic: {is_synthetic})")
    
    # 2. STANDARDIZATION
    print("\n[STAGE 2/6] Standardizing Blood Groups, Phones, Names & Coordinates...")
    raw_dicts = raw_df.to_dict(orient="records")
    standardized = [standardize_record(r) for r in raw_dicts]
    print(f"  -> Standardized {len(standardized):,} records. Preserved raw inputs for provenance.")
    
    # 3. VALIDATION
    print("\n[STAGE 3/6] Running Validation Rules & Indian Bounding-Box Checks...")
    validator = ValidationTracker()
    validated = []
    for r in standardized:
        is_valid, _ = validator.validate_record(r)
        if is_valid:
            validated.append(r)
    val_summary = validator.get_summary()
    print(f"  -> Validated {len(validated):,} valid records.")
    print(f"  -> Quarantined {val_summary['total_invalid_records']:,} defective records (fatal coordinate errors).")
    print(f"  -> Flagged {val_summary['failures_by_rule'].get('RULE_INVALID_PHONE', 0):,} invalid-phone records (retained for spatial dispatch with no_sms_alert=True).")
    
    # 4. DEDUPLICATION
    print("\n[STAGE 4/6] Executing Multi-Signal Deduplication & Entity Resolution...")
    deduper = DeduplicationEngine(proximity_threshold_km=0.50)
    final_records, audit_log = deduper.deduplicate_records(validated)
    print(f"  -> Detected and resolved {len(audit_log):,} duplicate candidate clusters.")
    print(f"  -> Final Retained High-Integrity Records: {len(final_records):,}")
    
    # Export Deduplication Audit Log
    if audit_log:
        with open(output_audit_csv, mode="w", newline="", encoding="utf-8") as f:
            fieldnames = [
                "data_provenance", "retained_record_id", "duplicate_record_id",
                "retained_name", "duplicate_name", "distance_meters",
                "name_similarity", "phone_matched", "match_reasons", "merge_action"
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in audit_log:
                out_row = dict(row)
                out_row["data_provenance"] = provenance
                out_row["match_reasons"] = " | ".join(row["match_reasons"])
                writer.writerow(out_row)
        print(f"  -> Exported Deduplication Audit Log [Provenance: {provenance}] to: {output_audit_csv}")
        
    # 5. FRESHNESS MANAGEMENT & TRADE-OFF DEMO
    print("\n[STAGE 5/6] Auditing Data Freshness Distribution & Stale Ranking Penalty...")
    freshness_counts = {"FRESH": 0, "AGING": 0, "STALE": 0, "UNKNOWN": 0}
    for r in final_records:
        metrics = compute_freshness_metrics(r.get("last_updated_at"))
        freshness_counts[metrics["status"]] += 1
        r["freshness_metrics"] = metrics
        
    print(f"  -> Freshness Distribution: {freshness_counts}")
    tradeoff_demo = demonstrate_stale_ranking_tradeoff()
    print("\n  [STALE INVENTORY RANKING TRADE-OFF DEMONSTRATION (via src/ranking/engine.py)]")
    print(f"  * Candidate A: {tradeoff_demo['candidate_a']['name']} ({tradeoff_demo['candidate_a']['distance_km']}km away, {tradeoff_demo['candidate_a']['age_hours']}h old, Status: {tradeoff_demo['candidate_a']['status']}) -> Score: {tradeoff_demo['candidate_a']['composite_score']} (Rank #{tradeoff_demo['candidate_a']['rank']})")
    print(f"  * Candidate B: {tradeoff_demo['candidate_b']['name']} ({tradeoff_demo['candidate_b']['distance_km']}km away, {tradeoff_demo['candidate_b']['age_hours']}h old, Status: {tradeoff_demo['candidate_b']['status']}) -> Score: {tradeoff_demo['candidate_b']['composite_score']} (Rank #{tradeoff_demo['candidate_b']['rank']})")
    print(f"  * Clinical Consequence: {tradeoff_demo['conclusion']}")
    
    # 6. QUALITY REPORT
    print("\n[STAGE 6/6] Generating Data Quality Report...")
    report = generate_quality_report(
        raw_df=raw_df,
        standardized_records=standardized,
        validated_records=validated,
        deduplicated_records=final_records,
        validation_failures=val_summary["failures_by_rule"],
        duplicate_audit_log=audit_log,
        data_provenance=provenance
    )
    print_quality_report_summary(report)
    
    with open(output_report_json, mode="w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"[SUCCESS] Quality Report [Provenance: {provenance}] saved to: {output_report_json}")
    
    # 7. RESILIENCE SUITE DEMONSTRATION
    print("\n" + "=" * 100)
    print("EXECUTING API RESILIENCE & CIRCUIT BREAKER FAILURE SIMULATION SUITE")
    print("=" * 100)
    resilience_results = run_resilience_simulation_suite()
    
    fmt_res = "{:<6} {:<36} {:<10} {:<24} {:<28}"
    print(fmt_res.format("Mode", "Failure Scenario", "Retries", "Failure Classification", "Recovery Action"))
    print("-" * 105)
    for sim in resilience_results:
        res = sim["result"]
        print(fmt_res.format(
            f"#{sim['mode']}",
            sim["name"],
            f"{res['retries']} retries",
            str(res["failure_type"] or "NONE"),
            res["recovery_behaviour"]
        ))
        print(f"       -> User Visible: \"{res['user_visible_behaviour']}\"")
        
    with open(output_resilience_json, mode="w", encoding="utf-8") as f:
        json.dump(resilience_results, f, indent=2)
    print(f"\n[SUCCESS] Resilience Simulation Results saved to: {output_resilience_json}")
    
    return report, resilience_results

def main():
    parser = argparse.ArgumentParser(description="BloodLink Ingestion & Data Quality Pipeline")
    parser.add_argument("--input-csv", type=str, default=None, help="Path to real eRaktKosh / data.gov.in CSV export")
    parser.add_argument("--n-records", type=int, default=4487, help="Number of records to generate if synthetic (default: 4487)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    args = parser.parse_args()
    
    run_full_pipeline(input_csv=args.input_csv, n_records=args.n_records, seed=args.seed)

if __name__ == "__main__":
    main()
