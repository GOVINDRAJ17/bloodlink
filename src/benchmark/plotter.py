"""
Matplotlib Visualizations for Geospatial Search Benchmark
=========================================================
Generates 4 publication-quality figures:
1. Dataset Size vs Median Search Time (ms, log-log or semi-log)
2. Dataset Size vs p95 Search Time (ms)
3. Dataset Size vs Candidate Count Evaluated
4. Index Build Time vs Dataset Size (seconds)

Saves all figures to benchmark_plots/
"""

import os
import pandas as pd
import matplotlib.pyplot as plt

def generate_benchmark_plots(csv_path: str = "benchmark_results.csv", output_dir: str = "benchmark_plots"):
    os.makedirs(output_dir, exist_ok=True)
    df = pd.read_csv(csv_path)
    
    # Standardize algorithm labels for presentation
    algo_labels = {
        "BruteForce_Haversine": "A. Brute-Force Haversine",
        "ExpandingRing_Codebase": "B1. Codebase Expanding Ring",
        "ExpandingRing_Spatial": "B2. Genuine Spatial Ring",
        "KDTree_3D": "C. 3D Spherical k-d Tree",
        "RTree_SQLite": "D. R*Tree Spatial Index"
    }
    
    unique_algos = df["algorithm"].unique()
    markers = ["o", "s", "^", "D", "v"]
    
    # -------------------------------------------------------------------------
    # Figure 1: Dataset Size vs Median Search Time
    # -------------------------------------------------------------------------
    plt.figure(figsize=(9, 5.5))
    for idx, algo in enumerate(unique_algos):
        sub = df[df["algorithm"] == algo].sort_values("dataset_size")
        label = algo_labels.get(algo, algo)
        marker = markers[idx % len(markers)]
        plt.plot(sub["dataset_size"], sub["latency_median_ms"], marker=marker, linewidth=2, label=label)
        
    plt.xscale("log")
    plt.yscale("log")
    plt.title("Dataset Size vs. Median Search Time (Log-Log Scale)", fontsize=13, fontweight="bold")
    plt.xlabel("Dataset Size (Number of Spatial Points N)", fontsize=11)
    plt.ylabel("Median Search Latency (ms)", fontsize=11)
    plt.grid(True, which="both", linestyle="--", alpha=0.5)
    plt.legend(frameon=True, fontsize=10)
    plt.tight_layout()
    fig1_path = os.path.join(output_dir, "fig1_dataset_vs_median_search_time.png")
    plt.savefig(fig1_path, dpi=300)
    plt.close()
    print(f"[SAVED] {fig1_path}")
    
    # -------------------------------------------------------------------------
    # Figure 2: Dataset Size vs p95 Search Time
    # -------------------------------------------------------------------------
    plt.figure(figsize=(9, 5.5))
    for idx, algo in enumerate(unique_algos):
        sub = df[df["algorithm"] == algo].sort_values("dataset_size")
        label = algo_labels.get(algo, algo)
        marker = markers[idx % len(markers)]
        plt.plot(sub["dataset_size"], sub["latency_p95_ms"], marker=marker, linewidth=2, label=label)
        
    plt.xscale("log")
    plt.yscale("log")
    plt.title("Dataset Size vs. p95 Search Time (Tail Latency)", fontsize=13, fontweight="bold")
    plt.xlabel("Dataset Size (Number of Spatial Points N)", fontsize=11)
    plt.ylabel("p95 Search Latency (ms)", fontsize=11)
    plt.grid(True, which="both", linestyle="--", alpha=0.5)
    plt.legend(frameon=True, fontsize=10)
    plt.tight_layout()
    fig2_path = os.path.join(output_dir, "fig2_dataset_vs_p95_search_time.png")
    plt.savefig(fig2_path, dpi=300)
    plt.close()
    print(f"[SAVED] {fig2_path}")

    # -------------------------------------------------------------------------
    # Figure 3: Dataset Size vs Candidate Count Evaluated
    # -------------------------------------------------------------------------
    plt.figure(figsize=(9, 5.5))
    for idx, algo in enumerate(unique_algos):
        sub = df[df["algorithm"] == algo].sort_values("dataset_size")
        label = algo_labels.get(algo, algo)
        marker = markers[idx % len(markers)]
        plt.plot(sub["dataset_size"], sub["candidates_median"], marker=marker, linewidth=2, label=label)
        
    plt.xscale("log")
    plt.yscale("log")
    plt.title("Dataset Size vs. Candidate Points Evaluated (Pruning Efficiency)", fontsize=13, fontweight="bold")
    plt.xlabel("Dataset Size (Number of Spatial Points N)", fontsize=11)
    plt.ylabel("Candidate Points Evaluated", fontsize=11)
    plt.grid(True, which="both", linestyle="--", alpha=0.5)
    plt.legend(frameon=True, fontsize=10)
    plt.tight_layout()
    fig3_path = os.path.join(output_dir, "fig3_dataset_vs_candidate_count.png")
    plt.savefig(fig3_path, dpi=300)
    plt.close()
    print(f"[SAVED] {fig3_path}")

    # -------------------------------------------------------------------------
    # Figure 4: Index Build Time vs Dataset Size
    # -------------------------------------------------------------------------
    plt.figure(figsize=(9, 5.5))
    # Exclude non-indexed algorithms from build time comparison
    indexed_algos = ["ExpandingRing_Spatial", "KDTree_3D", "RTree_SQLite"]
    for idx, algo in enumerate(indexed_algos):
        sub = df[df["algorithm"] == algo].sort_values("dataset_size")
        label = algo_labels.get(algo, algo)
        marker = markers[idx % len(markers)]
        plt.plot(sub["dataset_size"], sub["build_time_sec"], marker=marker, linewidth=2, label=label)
        
    plt.xscale("log")
    plt.yscale("log")
    plt.title("Dataset Size vs. Index Construction Time", fontsize=13, fontweight="bold")
    plt.xlabel("Dataset Size (Number of Spatial Points N)", fontsize=11)
    plt.ylabel("Index Build Time (seconds)", fontsize=11)
    plt.grid(True, which="both", linestyle="--", alpha=0.5)
    plt.legend(frameon=True, fontsize=10)
    plt.tight_layout()
    fig4_path = os.path.join(output_dir, "fig4_index_build_time_vs_dataset_size.png")
    plt.savefig(fig4_path, dpi=300)
    plt.close()
    print(f"[SAVED] {fig4_path}")

if __name__ == "__main__":
    generate_benchmark_plots()
