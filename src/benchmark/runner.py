"""
Geospatial Search Benchmarking Runner
=====================================
Executes rigorous performance, scalability, candidate pruning, and correctness benchmarks
across:
A. Brute-Force Haversine Baseline
B1. Codebase Expanding Ring (Repeated linear filter)
B2. Spatial Ring Search (Annular grid index)
C. 3D Spherical k-d Tree (cKDTree ECEF)
D. R-Tree Spatial Index (SQLite R*Tree)

Dataset Sizes: 1,000 / 4,487 (National Scale) / 5,000 / 10,000 / 50,000 / 100,000.
Generates results CSV and JSON with complete percentiles (mean, median, p95, p99, min, max).
"""

import sys
import os
import time
import json
import csv
import numpy as np
import pandas as pd
from typing import Dict, List, Any

from .data_generator import generate_spatial_dataset, BENCHMARK_SIZES
from .search_algorithms import (
    BruteForceHaversine,
    CodebaseExpandingRingSearch,
    SpatialRingSearch,
    KDTreeSpatialSearch,
    RTreeSpatialSearch
)

# Benchmark Query Anchor Coordinates across India
BENCHMARK_QUERY_LOCATIONS = [
    {"city": "Mumbai",    "lat": 18.9934, "lon": 72.8427},
    {"city": "Delhi",     "lat": 28.6139, "lon": 77.2090},
    {"city": "Bengaluru", "lat": 12.9716, "lon": 77.5946},
    {"city": "Kolkata",   "lat": 22.5726, "lon": 88.3639},
    {"city": "Nagpur",    "lat": 21.1458, "lon": 79.0882}
]

SEARCH_RADIUS_KM = 30.0
RESULT_LIMIT = 10
WARMUP_RUNS = 3
REPETITIONS_PER_LOCATION = 10  # 5 locations * 10 reps = 50 timed queries per algorithm

def run_benchmark(
    dataset_sizes: List[int] = BENCHMARK_SIZES,
    output_csv: str = "benchmark_results.csv",
    output_json: str = "benchmark_results.json",
    seed: int = 42
) -> List[Dict[str, Any]]:
    print("=" * 100)
    print("STARTING GEOSPATIAL SEARCH BENCHMARK")
    print(f"Dataset Sizes: {dataset_sizes}")
    print(f"Query Radius: {SEARCH_RADIUS_KM} km | Result Limit: {RESULT_LIMIT}")
    print(f"Queries: {len(BENCHMARK_QUERY_LOCATIONS)} locations x {REPETITIONS_PER_LOCATION} reps = {len(BENCHMARK_QUERY_LOCATIONS) * REPETITIONS_PER_LOCATION} queries per method")
    print("=" * 100)
    
    all_summary_results = []
    
    for size in dataset_sizes:
        print(f"\n---> Benchmarking Dataset Size: N = {size:,} points")
        df = generate_spatial_dataset(n_points=size, seed=seed)
        
        # Instantiate algorithms & measure index construction
        algos = {}
        
        # A. Brute Force
        t0 = time.perf_counter()
        algos["BruteForce_Haversine"] = BruteForceHaversine(df)
        
        # B1. Codebase Expanding Ring
        algos["ExpandingRing_Codebase"] = CodebaseExpandingRingSearch(df)
        
        # B2. Spatial Ring Search
        algos["ExpandingRing_Spatial"] = SpatialRingSearch(df, cell_size_deg=0.25)
        
        # C. k-d Tree
        algos["KDTree_3D"] = KDTreeSpatialSearch(df)
        
        # D. R-Tree
        algos["RTree_SQLite"] = RTreeSpatialSearch(df)
        
        # Perform Warmup Runs
        for name, algo in algos.items():
            for q in BENCHMARK_QUERY_LOCATIONS[:WARMUP_RUNS]:
                algo.query(q["lat"], q["lon"], SEARCH_RADIUS_KM, RESULT_LIMIT)
                
        # Execute Evaluation
        for algo_name, algo in algos.items():
            latencies_ms = []
            candidates_list = []
            recall_scores = []
            
            for q in BENCHMARK_QUERY_LOCATIONS:
                # Reference result from BruteForce
                ref_results, _ = algos["BruteForce_Haversine"].query(
                    q["lat"], q["lon"], SEARCH_RADIUS_KM, RESULT_LIMIT
                )
                ref_set = set(ref_results)
                
                for _ in range(REPETITIONS_PER_LOCATION):
                    t_start = time.perf_counter()
                    results, n_eval = algo.query(
                        q["lat"], q["lon"], SEARCH_RADIUS_KM, RESULT_LIMIT
                    )
                    t_elapsed_ms = (time.perf_counter() - t_start) * 1000.0
                    
                    latencies_ms.append(t_elapsed_ms)
                    candidates_list.append(n_eval)
                    
                    # Compute recall against brute-force reference
                    if len(ref_set) > 0:
                        matched = len(ref_set.intersection(set(results)))
                        recall_scores.append(matched / len(ref_set))
                    else:
                        recall_scores.append(1.0)
                        
            # Aggregate Metrics
            latencies_ms = np.array(latencies_ms)
            candidates_arr = np.array(candidates_list)
            recall_arr = np.array(recall_scores)
            
            record = {
                "dataset_size": size,
                "algorithm": algo_name,
                "build_time_sec": round(algo.build_time_sec, 6),
                "latency_median_ms": round(float(np.median(latencies_ms)), 4),
                "latency_mean_ms": round(float(np.mean(latencies_ms)), 4),
                "latency_p95_ms": round(float(np.percentile(latencies_ms, 95)), 4),
                "latency_p99_ms": round(float(np.percentile(latencies_ms, 99)), 4),
                "latency_min_ms": round(float(np.min(latencies_ms)), 4),
                "latency_max_ms": round(float(np.max(latencies_ms)), 4),
                "candidates_median": int(np.median(candidates_arr)),
                "candidates_mean": round(float(np.mean(candidates_arr)), 1),
                "candidates_min": int(np.min(candidates_arr)),
                "candidates_max": int(np.max(candidates_arr)),
                "recall": round(float(np.mean(recall_arr)), 4)
            }
            all_summary_results.append(record)
            
            print(f"  [{algo_name:<24}] Median: {record['latency_median_ms']:7.3f} ms | p95: {record['latency_p95_ms']:7.3f} ms | Candidates: {record['candidates_median']:6d} | Build: {record['build_time_sec']:7.4f}s | Recall: {record['recall']:.2f}")

    # Export CSV
    with open(output_csv, mode="w", newline="", encoding="utf-8") as f:
        fieldnames = list(all_summary_results[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_summary_results)
        
    # Export JSON
    with open(output_json, mode="w", encoding="utf-8") as f:
        json.dump(all_summary_results, f, indent=2)
        
    print("\n" + "=" * 100)
    print(f"[SUCCESS] Benchmark complete! Results saved to:")
    print(f"  * CSV:  {output_csv}")
    print(f"  * JSON: {output_json}")
    print("=" * 100)
    return all_summary_results

if __name__ == "__main__":
    run_benchmark()
