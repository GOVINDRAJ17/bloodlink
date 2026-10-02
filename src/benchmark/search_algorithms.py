"""
Geospatial Search Algorithms Benchmark Implementations
======================================================
Implements:
1. Algorithm A: Brute-Force Haversine Baseline
2. Algorithm B1: Existing Codebase Expanding Ring (Repeated linear scan)
3. Algorithm B2: Genuine Spatial Ring Search (Annular Grid-Indexed Shells)
4. Algorithm C: 3D Spherical k-d Tree (cKDTree with ECEF chord distance)
5. Algorithm D: R-Tree Spatial Index (SQLite R*Tree with MBR bounding-box filtering)
"""

import math
import time
import sqlite3
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from scipy.spatial import cKDTree

EARTH_RADIUS_KM = 6371.0

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance in km between two lat/lon points."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

def haversine_vectorized(lat_q: float, lon_q: float, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """Vectorized Haversine distance calculation using NumPy."""
    phi1 = math.radians(lat_q)
    phi2 = np.radians(lats)
    dphi = np.radians(lats - lat_q)
    dlam = np.radians(lons - lon_q)
    a = np.sin(dphi / 2.0)**2 + math.cos(phi1) * np.cos(phi2) * np.sin(dlam / 2.0)**2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

# =============================================================================
# Algorithm A: Brute-Force Haversine
# =============================================================================
class BruteForceHaversine:
    def __init__(self, df: pd.DataFrame):
        self.ids = df["id"].values
        self.lats = df["latitude"].values.astype(np.float64)
        self.lons = df["longitude"].values.astype(np.float64)
        self.n_points = len(self.lats)
        self.build_time_sec = 0.0  # No index

    def query(self, lat_q: float, lon_q: float, radius_km: float, limit: int = 10) -> Tuple[List[str], int]:
        """
        Calculates distance to every point in the dataset.
        Candidates evaluated: Exactly N.
        """
        distances = haversine_vectorized(lat_q, lon_q, self.lats, self.lons)
        candidates_evaluated = self.n_points
        
        mask = distances <= radius_km
        matching_indices = np.where(mask)[0]
        
        if len(matching_indices) == 0:
            return [], candidates_evaluated
            
        sorted_order = np.argsort(distances[matching_indices])
        top_k = matching_indices[sorted_order[:limit]]
        return [self.ids[i] for i in top_k], candidates_evaluated

# =============================================================================
# Algorithm B1: Existing Codebase Expanding Ring (Repeated Linear Filter)
# =============================================================================
class CodebaseExpandingRingSearch:
    """
    Replicates the exact logic found in src/lib/emergency/dynamicRadiusService.ts:
    1. Precomputes Haversine distance for ALL candidates.
    2. Sequentially filters for radius_1, radius_2, ... until quota is satisfied.
    """
    def __init__(self, df: pd.DataFrame):
        self.ids = df["id"].values
        self.lats = df["latitude"].values.astype(np.float64)
        self.lons = df["longitude"].values.astype(np.float64)
        self.n_points = len(self.lats)
        self.build_time_sec = 0.0

    def query(
        self,
        lat_q: float,
        lon_q: float,
        radii: Any = 30.0,
        limit: int = 10
    ) -> Tuple[List[str], int]:
        if isinstance(radii, (int, float)):
            radii_steps = [float(radii)] if radii <= 10.0 else [5.0, 15.0, float(radii)]
        else:
            radii_steps = list(radii)

        # Step 1: Computes distance for all N candidates
        distances = haversine_vectorized(lat_q, lon_q, self.lats, self.lons)
        candidates_evaluated = self.n_points
        
        selected_ids = []
        for r in radii_steps:
            # Step 2: Linear filter over all distances
            mask = distances <= r
            matching = np.where(mask)[0]
            if len(matching) >= limit:
                sorted_idx = np.argsort(distances[matching])[:limit]
                selected_ids = [self.ids[i] for i in matching[sorted_idx]]
                break
                
        if not selected_ids and len(matching) > 0:
            sorted_idx = np.argsort(distances[matching])[:limit]
            selected_ids = [self.ids[i] for i in matching[sorted_idx]]
            
        return selected_ids, candidates_evaluated

# =============================================================================
# Algorithm B2: Genuine Spatial Ring Search (Annular Grid-Indexed Shells)
# =============================================================================
class SpatialRingSearch:
    """
    Genuine Spatial Annular Ring Search:
    Partitions space into a 2D spatial grid (e.g. 0.25° grid buckets).
    Expands concentric ring shells outward, only evaluating candidate points
    located in grid cells intersecting the active shell.
    """
    def __init__(self, df: pd.DataFrame, cell_size_deg: float = 0.25):
        t0 = time.perf_counter()
        self.cell_size = cell_size_deg
        self.grid: Dict[Tuple[int, int], List[int]] = {}
        self.ids = df["id"].values
        self.lats = df["latitude"].values.astype(np.float64)
        self.lons = df["longitude"].values.astype(np.float64)
        
        for idx in range(len(self.lats)):
            cx = int(self.lats[idx] // self.cell_size)
            cy = int(self.lons[idx] // self.cell_size)
            key = (cx, cy)
            if key not in self.grid:
                self.grid[key] = []
            self.grid[key].append(idx)
        self.build_time_sec = time.perf_counter() - t0

    def query(
        self,
        lat_q: float,
        lon_q: float,
        radii: Any = 30.0,
        limit: int = 10,
        radii_steps: Any = None
    ) -> Tuple[List[str], int]:
        target_radii = radii_steps if radii_steps is not None else radii
        if isinstance(target_radii, (int, float)):
            steps = [float(target_radii)] if target_radii <= 10.0 else [5.0, 15.0, float(target_radii)]
        else:
            steps = list(target_radii)

        evaluated_distances: Dict[int, float] = {}
        searched_cells = set()
        matched_results: List[Tuple[float, str]] = []

        cos_lat = max(0.1, math.cos(math.radians(lat_q)))

        for current_r in steps:
            # Degree offsets for current radius with safety margin
            delta_lat = current_r / 111.0
            delta_lon = current_r / (111.0 * cos_lat)

            min_cx = int((lat_q - delta_lat) // self.cell_size) - 1
            max_cx = int((lat_q + delta_lat) // self.cell_size) + 1
            min_cy = int((lon_q - delta_lon) // self.cell_size) - 1
            max_cy = int((lon_q + delta_lon) // self.cell_size) + 1

            for cx in range(min_cx, max_cx + 1):
                for cy in range(min_cy, max_cy + 1):
                    if (cx, cy) in searched_cells:
                        continue
                    searched_cells.add((cx, cy))
                    for idx in self.grid.get((cx, cy), []):
                        if idx not in evaluated_distances:
                            dist = haversine_distance(lat_q, lon_q, self.lats[idx], self.lons[idx])
                            evaluated_distances[idx] = dist

            # Check matches strictly within current_r
            current_matches = [
                (d, self.ids[idx]) for idx, d in evaluated_distances.items() if d <= current_r
            ]
            if len(current_matches) >= limit:
                current_matches.sort(key=lambda x: x[0])
                matched_results = current_matches[:limit]
                break

        if not matched_results and evaluated_distances:
            all_valid = [(d, self.ids[idx]) for idx, d in evaluated_distances.items() if d <= steps[-1]]
            all_valid.sort(key=lambda x: x[0])
            matched_results = all_valid[:limit]

        return [item[1] for item in matched_results], len(evaluated_distances)

# =============================================================================
# Algorithm C: 3D Spherical k-d Tree (cKDTree with ECEF Coordinates)
# =============================================================================
class KDTreeSpatialSearch:
    """
    3D Earth-Centered Earth-Fixed (ECEF) k-d Tree:
    Projects spherical coordinates into 3D Cartesian coordinates:
      X = R * cos(lat) * cos(lon)
      Y = R * cos(lat) * sin(lon)
      Z = R * sin(lat)
    
    Great-circle distance r maps exactly to straight-line 3D Euclidean chord length:
      d_chord = 2 * R * sin(r / (2 * R))
    
    Provides O(log N) query time with 100% spherical accuracy without polar distortion.
    """
    def __init__(self, df: pd.DataFrame):
        t0 = time.perf_counter()
        self.ids = df["id"].values
        lats = np.radians(df["latitude"].values)
        lons = np.radians(df["longitude"].values)
        
        # 3D Cartesian projection on Earth sphere
        x = EARTH_RADIUS_KM * np.cos(lats) * np.cos(lons)
        y = EARTH_RADIUS_KM * np.cos(lats) * np.sin(lons)
        z = EARTH_RADIUS_KM * np.sin(lats)
        self.coords_3d = np.column_stack((x, y, z))
        
        self.tree = cKDTree(self.coords_3d)
        self.build_time_sec = time.perf_counter() - t0

    def query(self, lat_q: float, lon_q: float, radius_km: float, limit: int = 10) -> Tuple[List[str], int]:
        # Compute query 3D coordinates
        lat_rad = math.radians(lat_q)
        lon_rad = math.radians(lon_q)
        qx = EARTH_RADIUS_KM * math.cos(lat_rad) * math.cos(lon_rad)
        qy = EARTH_RADIUS_KM * math.cos(lat_rad) * math.sin(lon_rad)
        qz = EARTH_RADIUS_KM * math.sin(lat_rad)
        query_pt = np.array([qx, qy, qz])
        
        # Exact 3D chord distance corresponding to spherical surface radius_km
        chord_dist = 2.0 * EARTH_RADIUS_KM * math.sin(radius_km / (2.0 * EARTH_RADIUS_KM))
        
        # Query k-d tree
        indices = self.tree.query_ball_point(query_pt, r=chord_dist)
        candidates_evaluated = len(indices)
        
        if len(indices) == 0:
            return [], candidates_evaluated
            
        # Compute exact distances to sort top K
        sub_pts = self.coords_3d[indices]
        chord_dists = np.linalg.norm(sub_pts - query_pt, axis=1)
        # Convert chord distance back to arc distance for exact ordering
        arc_dists = 2.0 * EARTH_RADIUS_KM * np.arcsin(np.clip(chord_dists / (2.0 * EARTH_RADIUS_KM), 0.0, 1.0))
        
        sorted_idx = np.argsort(arc_dists)[:limit]
        top_k_indices = [indices[i] for i in sorted_idx]
        return [self.ids[i] for i in top_k_indices], candidates_evaluated

# =============================================================================
# Algorithm D: R-Tree Spatial Index (SQLite R*Tree Virtual Table)
# =============================================================================
class RTreeSpatialSearch:
    """
    R*Tree Spatial Bounding-Box Index:
    Uses SQLite's compiled C-level R*Tree module.
    Queries minimum bounding rectangles (MBR) in O(log N) then filters by exact Haversine.
    """
    def __init__(self, df: pd.DataFrame):
        t0 = time.perf_counter()
        self.conn = sqlite3.connect(":memory:")
        self.cursor = self.conn.cursor()
        
        # Create virtual R*Tree table
        self.cursor.execute("""
            CREATE VIRTUAL TABLE spatial_rtree USING rtree(
                id INTEGER PRIMARY KEY,
                minLat, maxLat,
                minLon, maxLon
            )
        """)
        
        self.ids = df["id"].values
        self.lats = df["latitude"].values
        self.lons = df["longitude"].values
        
        # Insert records (id is 1-indexed for sqlite rtree)
        records = [
            (i + 1, self.lats[i], self.lats[i], self.lons[i], self.lons[i])
            for i in range(len(self.lats))
        ]
        self.cursor.executemany(
            "INSERT INTO spatial_rtree VALUES (?, ?, ?, ?, ?)",
            records
        )
        self.conn.commit()
        self.build_time_sec = time.perf_counter() - t0

    def query(self, lat_q: float, lon_q: float, radius_km: float, limit: int = 10) -> Tuple[List[str], int]:
        # Compute latitude and longitude bounding box offsets
        delta_lat = radius_km / 111.0
        cos_lat = max(0.1, math.cos(math.radians(lat_q)))
        delta_lon = radius_km / (111.0 * cos_lat)
        
        min_lat = lat_q - delta_lat
        max_lat = lat_q + delta_lat
        min_lon = lon_q - delta_lon
        max_lon = lon_q + delta_lon
        
        # Query R*Tree index for candidate IDs inside MBR
        self.cursor.execute("""
            SELECT id FROM spatial_rtree
            WHERE maxLat >= ? AND minLat <= ?
              AND maxLon >= ? AND minLon <= ?
        """, (min_lat, max_lat, min_lon, max_lon))
        
        candidate_rows = self.cursor.fetchall()
        candidates_evaluated = len(candidate_rows)
        
        if candidates_evaluated == 0:
            return [], candidates_evaluated
            
        candidate_indices = [row[0] - 1 for row in candidate_rows]
        
        # Exact Haversine distance verification on MBR candidates
        c_lats = self.lats[candidate_indices]
        c_lons = self.lons[candidate_indices]
        distances = haversine_vectorized(lat_q, lon_q, c_lats, c_lons)
        
        mask = distances <= radius_km
        valid_indices = np.where(mask)[0]
        
        if len(valid_indices) == 0:
            return [], candidates_evaluated
            
        sorted_order = np.argsort(distances[valid_indices])[:limit]
        final_ids = [self.ids[candidate_indices[valid_indices[i]]] for i in sorted_order]
        return final_ids, candidates_evaluated

    def __del__(self):
        try:
            self.conn.close()
        except Exception:
            pass
