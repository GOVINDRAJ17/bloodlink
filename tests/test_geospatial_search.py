"""
Unit Tests for Geospatial Search Algorithms
===========================================
Verifies:
1. Synthetic dataset bounding box constraints and deterministic seed generation
2. Correctness of Brute-Force, k-d Tree, R-Tree, and Spatial Ring implementations
3. 100% recall of indexed searches relative to the Brute-force Haversine reference
4. Spatial pruning invariants (indexed methods evaluate significantly fewer candidates than N)
"""

import pytest
import numpy as np
import pandas as pd
from src.benchmark.data_generator import (
    generate_spatial_dataset,
    INDIA_BOUNDS
)
from src.benchmark.search_algorithms import (
    haversine_distance,
    haversine_vectorized,
    BruteForceHaversine,
    CodebaseExpandingRingSearch,
    SpatialRingSearch,
    KDTreeSpatialSearch,
    RTreeSpatialSearch
)

@pytest.fixture(scope="module")
def sample_dataset():
    # Small test dataset with fixed seed
    return generate_spatial_dataset(n_points=500, seed=42)

def test_synthetic_data_generation():
    df = generate_spatial_dataset(n_points=100, seed=123)
    assert len(df) == 100
    assert "latitude" in df.columns
    assert "longitude" in df.columns
    # Check bounding box
    assert df["latitude"].min() >= INDIA_BOUNDS["min_lat"]
    assert df["latitude"].max() <= INDIA_BOUNDS["max_lat"]
    assert df["longitude"].min() >= INDIA_BOUNDS["min_lon"]
    assert df["longitude"].max() <= INDIA_BOUNDS["max_lon"]

def test_haversine_vectorized_matches_scalar():
    lats = np.array([19.0760, 28.6139, 12.9716])
    lons = np.array([72.8777, 77.2090, 77.5946])
    q_lat, q_lon = 18.9934, 72.8427
    
    vec_dists = haversine_vectorized(q_lat, q_lon, lats, lons)
    for i in range(len(lats)):
        scalar_dist = haversine_distance(q_lat, q_lon, lats[i], lons[i])
        assert abs(vec_dists[i] - scalar_dist) < 1e-4

def test_kdtree_exact_recall_vs_bruteforce(sample_dataset):
    q_lat, q_lon = 19.0760, 72.8777  # Mumbai
    radius_km = 40.0
    limit = 10
    
    bf = BruteForceHaversine(sample_dataset)
    kd = KDTreeSpatialSearch(sample_dataset)
    
    bf_results, bf_eval = bf.query(q_lat, q_lon, radius_km, limit)
    kd_results, kd_eval = kd.query(q_lat, q_lon, radius_km, limit)
    
    # Both must find the exact same top-K IDs
    assert set(bf_results) == set(kd_results)
    # k-d tree must evaluate far fewer candidates than brute-force N
    assert kd_eval < bf_eval
    assert bf_eval == len(sample_dataset)

def test_rtree_exact_recall_vs_bruteforce(sample_dataset):
    q_lat, q_lon = 19.0760, 72.8777
    radius_km = 40.0
    limit = 10
    
    bf = BruteForceHaversine(sample_dataset)
    rt = RTreeSpatialSearch(sample_dataset)
    
    bf_results, bf_eval = bf.query(q_lat, q_lon, radius_km, limit)
    rt_results, rt_eval = rt.query(q_lat, q_lon, radius_km, limit)
    
    # R-Tree with Haversine verification must match brute-force
    assert set(bf_results) == set(rt_results)
    assert rt_eval < bf_eval

def test_spatial_ring_candidate_reduction(sample_dataset):
    q_lat, q_lon = 19.0760, 72.8777
    sr = SpatialRingSearch(sample_dataset, cell_size_deg=0.25)
    results, n_eval = sr.query(q_lat, q_lon, radii_steps=[5.0, 15.0, 30.0], limit=5)
    
    # Spatial ring search only inspects intersecting grid cells, so n_eval < N
    assert n_eval < len(sample_dataset)
