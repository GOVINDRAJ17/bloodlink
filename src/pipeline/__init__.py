"""
BloodLink Ingestion, Quality, and Resilience Pipeline Package
"""

from .raw_dataset_generator import generate_raw_national_dataset
from .standardization import standardize_record, standardize_blood_group, standardize_phone
from .validation import ValidationTracker
from .deduplication import DeduplicationEngine
from .freshness import compute_freshness_metrics, demonstrate_stale_ranking_tradeoff
from .quality_reporter import generate_quality_report
from .resilience import CircuitBreaker, ResilientAPIClient, run_resilience_simulation_suite
from .additional_datasets import ADDITIONAL_DATASETS_CATALOG

__all__ = [
    "generate_raw_national_dataset",
    "standardize_record",
    "standardize_blood_group",
    "standardize_phone",
    "ValidationTracker",
    "DeduplicationEngine",
    "compute_freshness_metrics",
    "demonstrate_stale_ranking_tradeoff",
    "generate_quality_report",
    "CircuitBreaker",
    "ResilientAPIClient",
    "run_resilience_simulation_suite",
    "ADDITIONAL_DATASETS_CATALOG"
]
