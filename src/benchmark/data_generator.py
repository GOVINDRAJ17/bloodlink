"""
Geospatial Synthetic Data Generator for India Blood Bank Network
================================================================
Generates reproducible coordinate distributions bounded within the territory of India:
- Latitude: 8.07° N to 35.50° N
- Longitude: 68.12° E to 97.42° E

Includes clustered density distribution mimicking urban health centres (tier-1 and tier-2 metros)
and rural primary health centres. Uses fixed random seeds for strict academic reproducibility.
"""

import numpy as np
import pandas as pd
from typing import Tuple, List, Dict
import os

INDIA_BOUNDS = {
    "min_lat": 8.1,
    "max_lat": 35.5,
    "min_lon": 68.2,
    "max_lon": 97.4
}

# Major urban hub clusters (representing real-world blood bank density concentrations)
METRO_CLUSTERS = [
    {"name": "Mumbai Metropolitan", "lat": 19.0760, "lon": 72.8777, "weight": 0.20, "std_dev": 0.45},
    {"name": "Delhi NCR",           "lat": 28.6139, "lon": 77.2090, "weight": 0.20, "std_dev": 0.50},
    {"name": "Bengaluru",           "lat": 12.9716, "lon": 77.5946, "weight": 0.15, "std_dev": 0.40},
    {"name": "Kolkata",             "lat": 22.5726, "lon": 88.3639, "weight": 0.12, "std_dev": 0.35},
    {"name": "Chennai",             "lat": 13.0827, "lon": 80.2707, "weight": 0.10, "std_dev": 0.35},
    {"name": "Hyderabad",           "lat": 17.3850, "lon": 78.4867, "weight": 0.10, "std_dev": 0.35},
    {"name": "Ahmedabad",           "lat": 23.0225, "lon": 72.5714, "weight": 0.08, "std_dev": 0.30},
    {"name": "Pune",                "lat": 18.5204, "lon": 73.8567, "weight": 0.05, "std_dev": 0.30}
]

def generate_spatial_dataset(
    n_points: int,
    seed: int = 42,
    cluster_ratio: float = 0.70
) -> pd.DataFrame:
    """
    Generates synthetic geospatial blood bank coordinates within India.
    
    Args:
        n_points: Number of spatial points to generate
        seed: Fixed random seed for exact reproducibility
        cluster_ratio: Fraction of points clustered around major population centers (vs uniform)
    
    Returns:
        DataFrame with columns: ['id', 'name', 'latitude', 'longitude', 'is_cluster']
    """
    rng = np.random.default_rng(seed)
    n_clustered = int(n_points * cluster_ratio)
    n_uniform = n_points - n_clustered
    
    lats = []
    lons = []
    is_cluster = []
    
    # 1. Clustered Points (representing urban healthcare clusters)
    weights = np.array([c["weight"] for c in METRO_CLUSTERS])
    weights /= weights.sum()
    chosen_clusters = rng.choice(len(METRO_CLUSTERS), size=n_clustered, p=weights)
    
    for cluster_idx in chosen_clusters:
        c = METRO_CLUSTERS[cluster_idx]
        lat = rng.normal(c["lat"], c["std_dev"])
        lon = rng.normal(c["lon"], c["std_dev"])
        # Clamp within Indian bounds
        lat = np.clip(lat, INDIA_BOUNDS["min_lat"], INDIA_BOUNDS["max_lat"])
        lon = np.clip(lon, INDIA_BOUNDS["min_lon"], INDIA_BOUNDS["max_lon"])
        lats.append(round(float(lat), 6))
        lons.append(round(float(lon), 6))
        is_cluster.append(True)
        
    # 2. Uniform Background Points (representing rural and district facilities)
    uniform_lats = rng.uniform(INDIA_BOUNDS["min_lat"], INDIA_BOUNDS["max_lat"], n_uniform)
    uniform_lons = rng.uniform(INDIA_BOUNDS["min_lon"], INDIA_BOUNDS["max_lon"], n_uniform)
    for lat, lon in zip(uniform_lats, uniform_lons):
        lats.append(round(float(lat), 6))
        lons.append(round(float(lon), 6))
        is_cluster.append(False)
        
    df = pd.DataFrame({
        "id": [f"BB-{i+1:06d}" for i in range(n_points)],
        "name": [f"Blood Centre {i+1}" for i in range(n_points)],
        "latitude": lats,
        "longitude": lons,
        "is_cluster": is_cluster
    })
    return df

BENCHMARK_SIZES = [1000, 4487, 5000, 10000, 50000, 100000]

def generate_all_benchmark_datasets(output_dir: str = "benchmark_data", seed: int = 42) -> Dict[int, str]:
    """Generates and saves CSV files for all benchmark sizes."""
    os.makedirs(output_dir, exist_ok=True)
    paths = {}
    for size in BENCHMARK_SIZES:
        df = generate_spatial_dataset(size, seed=seed)
        filename = f"spatial_dataset_{size}.csv"
        filepath = os.path.join(output_dir, filename)
        df.to_csv(filepath, index=False)
        paths[size] = filepath
    return paths
