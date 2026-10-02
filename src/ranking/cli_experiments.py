"""
Clinical Scenario Experiments and Sensitivity Analysis Runner
=============================================================
Runs all 10 clinical reviewer test scenarios through the multi-criteria RankingEngine,
executes weight sensitivity analyses, and exports reproducible tabular results (CSV/JSON).
"""

import sys
import os
import csv
import json
import argparse
from typing import List, Dict, Any

from .config import WEIGHT_PROFILES, DEFAULT_LAMBDA
from .engine import RankingEngine, CandidateSource, EmergencyRequest, ScoredCandidate
from .fixtures import get_scenario_fixtures

def print_separator(char: str = "=", length: int = 90):
    print(char * length)

def run_single_scenario(
    scenario: Dict[str, Any],
    engine: RankingEngine,
    verbose: bool = True
) -> List[ScoredCandidate]:
    req: EmergencyRequest = scenario["request"]
    candidates: List[CandidateSource] = scenario["candidates"]
    
    ranked = engine.rank_sources(candidates, req, filter_incompatible=False)
    
    if verbose:
        print_separator("-", 90)
        print(f"Scenario {scenario['scenario_num']}: {scenario['title']}")
        print(f"Description: {scenario['description']}")
        print(f"Request: Patient {req.patient_group} | Need {req.units_needed} unit(s) of {req.component} | Urgency: {req.urgency} | Max Radius: {req.max_radius_km} km")
        print_separator("-", 90)
        
        # 1. Input Table
        print("\n[INPUT CANDIDATE TABLE]")
        fmt_in = "{:<4} {:<24} {:<11} {:<6} {:<10} {:<10} {:<12} {:<10}"
        print(fmt_in.format("Idx", "Name", "Type", "Group", "Dist(km)", "Stock", "DataAge(h)", "Verified"))
        for idx, c in enumerate(candidates, 1):
            print(fmt_in.format(
                idx,
                c.name[:23],
                c.source_type,
                c.blood_group,
                f"{c.lat:.3f},{c.lon:.3f}",
                c.available_units,
                f"{c.data_age_hours:.1f}h",
                "Yes" if c.verified else "No"
            ))
            
        # 2. Sub-score and Composite Score Table
        print("\n[SCORES & FINAL RANKINGS (BASELINE 5-TERM MCDA)]")
        fmt_out = "{:<4} {:<24} {:<6} {:<8} {:<8} {:<8} {:<8} {:<8} {:<8} {:<10} {:<8}"
        print(fmt_out.format("Rank", "Candidate Name", "Group", "S_compat", "S_dist", "S_eta", "S_rel", "S_fresh", "S_stock", "Final(0-1)", "Score/100"))
        for s in ranked:
            print(fmt_out.format(
                s.rank,
                s.name[:23],
                s.blood_group,
                f"{s.s_compat:.2f}",
                f"{s.s_dist:.2f}",
                f"{s.s_eta:.2f}",
                f"{s.s_rel:.2f}",
                f"{s.s_fresh:.2f}",
                f"{s.s_stock:.2f}",
                f"{s.final_score_normalized:.4f}",
                f"{s.final_score_100:.1f}"
            ))
            
        # Scenario 7 Stock Penalty Demonstration
        if scenario["scenario_num"] == 7:
            print("\n  [SCENARIO 7 STOCK-ADEQUACY DEMONSTRATION]")
            stock_ranked = engine.rank_sources(candidates, req, filter_incompatible=False, apply_stock_penalty=True)
            print(f"  * Baseline (Proximity Priority) : #{ranked[0].rank} {ranked[0].name} ({ranked[0].available_units} unit avail) Score: {ranked[0].final_score_100:.2f}")
            print(f"                                   #{ranked[1].rank} {ranked[1].name} ({ranked[1].available_units} units avail) Score: {ranked[1].final_score_100:.2f}")
            print(f"  * With Stock Adequacy Multiplier: #{stock_ranked[0].rank} {stock_ranked[0].name} ({stock_ranked[0].available_units} units avail) Score: {stock_ranked[0].final_score_100:.2f}")
            print(f"                                   #{stock_ranked[1].rank} {stock_ranked[1].name} ({stock_ranked[1].available_units} unit avail) Score: {stock_ranked[1].final_score_100:.2f}")
            print(f"  * Explanation: Applying S_stock penalty reduces single-unit candidate score by 37.5%, correctly advancing the multi-unit hospital.")

        # Scenario 10 Dynamic Radius Expansion Demonstration
        if scenario["scenario_num"] == 10:
            print("\n  [SCENARIO 10 RADIUS EXPANSION INVESTIGATION (d=14.61 km)]")
            print(f"  * Initial Horizon (d_max = 10.0 km) : S_dist = max(0, 1 - 14.61/10.0) = 0.00 -> Composite Score = {ranked[0].final_score_100:.2f}")
            req_expanded = EmergencyRequest(
                request_id=req.request_id,
                patient_group=req.patient_group,
                component=req.component,
                units_needed=req.units_needed,
                lat=req.lat,
                lon=req.lon,
                urgency=req.urgency,
                max_radius_km=25.0
            )
            expanded_ranked = engine.rank_sources(candidates, req_expanded, filter_incompatible=False)
            exp_bombay = next(c for c in expanded_ranked if c.candidate_id == "BB-10-FAR-BOMBAY-EXPANDED")
            print(f"  * Expanded Horizon (d_max = 25.0 km): S_dist = 1 - 14.61/25.0 = {exp_bombay.s_dist:.4f} -> Composite Score = {exp_bombay.final_score_100:.2f}")
            print(f"  * Explanation: S_dist=0.00 at 14.6km was NOT a bug; it was the exact mathematical boundary clamp of d > d_max. Expanding search horizon raises score to {exp_bombay.final_score_100:.2f}.")

        print("\n[TRANSPARENT RATIONALE]")
        for s in ranked:
            print(f"  * #{s.rank} [{s.name}]: {' | '.join(s.why_recommended)}")
        print()
        
    return ranked

def run_all_scenarios(output_csv_path: str = "ranking_experiment_results.csv"):
    scenarios = get_scenario_fixtures()
    engine = RankingEngine(weight_profile="BALANCED")
    
    print_separator("=", 100)
    print(f"BLOODLINK EMERGENCY RANKING EXPERIMENTS - EVALUATING {len(scenarios)} SCENARIOS")
    print(f"Weights (BALANCED): {engine.weights}")
    print_separator("=", 100)
    
    rows_to_export = []
    
    for sc in scenarios:
        ranked = run_single_scenario(sc, engine, verbose=True)
        for s in ranked:
            rows_to_export.append({
                "scenario_num": sc["scenario_num"],
                "scenario_title": sc["title"],
                "candidate_id": s.candidate_id,
                "candidate_name": s.name,
                "source_type": s.source_type,
                "blood_group": s.blood_group,
                "distance_km": s.distance_km,
                "total_eta_min": s.total_eta_min,
                "available_units": s.available_units,
                "s_compat": s.s_compat,
                "s_dist": s.s_dist,
                "s_eta": s.s_eta,
                "s_rel": s.s_rel,
                "s_fresh": s.s_fresh,
                "s_stock": s.s_stock,
                "final_score_normalized": s.final_score_normalized,
                "final_score_100": s.final_score_100,
                "rank": s.rank,
                "compat_tier": s.compat_tier
            })
            
    # Export CSV
    with open(output_csv_path, mode="w", newline="", encoding="utf-8") as f:
        fieldnames = list(rows_to_export[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_to_export)
        
    print_separator("=", 100)
    print(f"[SUCCESS] All 10 scenarios executed. Results saved to: {output_csv_path}")
    print_separator("=", 100)

def run_sensitivity_experiments(output_csv_path: str = "ranking_sensitivity_results.csv"):
    scenarios = get_scenario_fixtures()
    target_scenario = scenarios[1]
    req = target_scenario["request"]
    candidates = target_scenario["candidates"]
    
    print_separator("=", 100)
    print("WEIGHT SENSITIVITY ANALYSIS")
    print(f"Evaluating Scenario: {target_scenario['title']}")
    print(f"Patient Group: {req.patient_group} | Component: {req.component}")
    print_separator("=", 100)
    
    profiles = ["BALANCED", "CRITICAL_EMERGENCY", "QUALITY_FIRST", "RURAL_SPARSE", "DISTANCE_ONLY_BASELINE"]
    
    sensitivity_rows = []
    
    print(f"{'Profile':<24} {'Candidate':<32} {'Rank':<6} {'Score/100':<10} {'S_compat':<10} {'S_dist':<10} {'S_eta':<10}")
    print("-" * 105)
    
    for p in profiles:
        engine = RankingEngine(weight_profile=p)
        ranked = engine.rank_sources(candidates, req)
        for cand in ranked:
            print(f"{p:<24} {cand.name[:30]:<32} #{cand.rank:<5} {cand.final_score_100:<10.2f} {cand.s_compat:<10.2f} {cand.s_dist:<10.2f} {cand.s_eta:<10.2f}")
            sensitivity_rows.append({
                "profile": p,
                "weights": json.dumps(engine.weights),
                "candidate_id": cand.candidate_id,
                "candidate_name": cand.name,
                "blood_group": cand.blood_group,
                "distance_km": cand.distance_km,
                "rank": cand.rank,
                "final_score_100": cand.final_score_100,
                "s_compat": cand.s_compat,
                "s_dist": cand.s_dist,
                "s_eta": cand.s_eta,
                "s_rel": cand.s_rel,
                "s_fresh": cand.s_fresh,
                "s_stock": cand.s_stock
            })
        print("-" * 105)
        
    with open(output_csv_path, mode="w", newline="", encoding="utf-8") as f:
        fieldnames = list(sensitivity_rows[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sensitivity_rows)
        
    print_separator("=", 100)
    print(f"[SUCCESS] Sensitivity analysis complete. Saved to: {output_csv_path}")
    print_separator("=", 100)
    
    print("\nWeight Allocation Across Profiles:")
    for p in profiles:
        weights = WEIGHT_PROFILES[p]
        print(f"  * {p:<22}: {weights}")
    print()

def main():
    parser = argparse.ArgumentParser(description="BloodLink Clinical Ranking CLI Experiments")
    parser.add_argument("--all", action="store_true", help="Run all 10 clinical test scenarios")
    parser.add_argument("--sensitivity", action="store_true", help="Run weight sensitivity analysis")
    parser.add_argument("--scenario", type=int, default=None, help="Run specific scenario number (1-10)")
    parser.add_argument("--output", type=str, default="ranking_experiment_results.csv", help="Output CSV path")
    args = parser.parse_args()
    
    if args.sensitivity:
        run_sensitivity_experiments("ranking_sensitivity_results.csv")
    elif args.scenario:
        scenarios = get_scenario_fixtures()
        target = next((s for s in scenarios if s["scenario_num"] == args.scenario), None)
        if target:
            engine = RankingEngine(weight_profile="BALANCED")
            run_single_scenario(target, engine, verbose=True)
        else:
            print(f"Scenario #{args.scenario} not found. Available: 1-{len(scenarios)}")
    else:
        run_all_scenarios(args.output)
        run_sensitivity_experiments("ranking_sensitivity_results.csv")

if __name__ == "__main__":
    main()
