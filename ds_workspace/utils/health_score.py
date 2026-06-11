"""
Data Health Score Logic
Tracks and calculates Data Ingest Integrity, Cleansing Quality, and Overall Pipeline Health Scores.
"""

from typing import Dict, Any, List

def calculate_ingestion_integrity(
    total_records: int,
    duplicate_count: int,
    type_mismatch_count: int,
    threshold_violations_count: int,
    total_checked_points: int
) -> Dict[str, Any]:
    """
    Calculates Ingestion Integrity Score (0 - 100).
    Penalizes duplicate entries, typing mismatches, and severe physical threshold violations.
    """
    if total_records <= 0:
        return {
            "score": 0.0,
            "duplicate_penalty": 0.0,
            "type_mismatch_penalty": 0.0,
            "threshold_penalty": 0.0,
            "rating": "Invalid Data"
        }
    
    # Weight calculations
    # Duplicate records (high impact in time-series): 30% of penalty space
    # Type mismatches (completely corrupts columns): 40% of penalty space
    # Threshold violations (out of bounds sensor ranges): 30% of penalty space
    
    duplicate_ratio = duplicate_count / total_records if total_records else 0
    type_mismatch_ratio = type_mismatch_count / total_checked_points if total_checked_points else 0
    threshold_ratio = threshold_violations_count / total_checked_points if total_checked_points else 0
    
    # Cap penalties at their sub-allocations
    p_dup = min(30.0, duplicate_ratio * 150.0)  # Capped duplicate penalty
    p_typ = min(40.0, type_mismatch_ratio * 100.0) # Capped type mismatch severity
    p_thr = min(30.0, threshold_ratio * 100.0)     # Capped boundary out-of-bounds
    
    score = max(0.0, 100.0 - (p_dup + p_typ + p_thr))
    
    if score >= 90:
        rating = "Excellent"
    elif score >= 75:
        rating = "Good"
    elif score >= 50:
        rating = "Fair (Requires Review)"
    else:
        rating = "Poor (Critical Schema/Boundary Warnings)"
        
    return {
        "score": round(score, 1),
        "penalties": {
            "duplicates": round(p_dup, 1),
            "type_mismatches": round(p_typ, 1),
            "threshold_violations": round(p_thr, 1)
        },
        "metrics": {
            "num_records": total_records,
            "duplicate_count": duplicate_count,
            "type_mismatches_count": type_mismatch_count,
            "threshold_violations_count": threshold_violations_count
        },
        "rating": rating
    }

def calculate_engineering_health(
    null_percentage: float,
    outlier_ratio: float,
    drift_score: float # Percentage of columns showing statistical shift
) -> Dict[str, Any]:
    """
    Calculates Data Cleansing Completeness & Consistency Score (0 - 100).
    A high score means:
    1. Null values have been fully handled (imputed).
    2. Outliers have been identified/mitigated without heavy distortion.
    3. The scaled/imputed distribution hasn't heavily drifted from original context (low drift_score).
    """
    # Null penalty: Max 40 points (Remaining NaNs are catastrophic for ML)
    p_null = min(40.0, null_percentage * 1.5)
    
    # Outlier penalty: Max 25 points (Raw unaddressed extreme anomalies)
    p_out = min(25.0, outlier_ratio * 100.0)
    
    # Drift penalty: Max 35 points (Significant unintended structural shift in column density)
    p_drift = min(35.0, drift_score * 100.0)
    
    score = max(0.0, 100.0 - (p_null + p_out + p_drift))
    
    if score >= 90:
        rating = "Pragmatic (Ready for Modelling)"
    elif score >= 75:
        rating = "Restructured (Minor Distribution Shift)"
    elif score >= 50:
        rating = "Disrupted (Review Imputation/Scaling Logic)"
    else:
        rating = "Corrupted/Degraded (Severe Damage)"
        
    return {
        "score": round(score, 1),
        "penalties": {
            "missing_data": round(p_null, 1),
            "outliers_presence": round(p_out, 1),
            "distribution_drift": round(p_drift, 1)
        },
        "rating": rating
    }
