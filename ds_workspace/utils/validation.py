"""
Validation Guardrails Logic
Houses strict schema check, logical boundary validation, sequence cadence checks,
and statistical distribution drift analysis for general-purpose Data Science.
"""

import pandas as pd
import numpy as np
import scipy.stats as stats
from typing import Dict, Any, List, Tuple

def validate_schema_and_types(
    df: pd.DataFrame, 
    expected_schema: Dict[str, str],
    unique_key_cols: List[str]
) -> Dict[str, Any]:
    """
    Checks if columns match expected datatypes (int, float, datetime, category, string).
    Also flags missing columns and identifies duplicates on unique key columns.
    """
    errors: List[str] = []
    warnings: List[str] = []
    type_compliance = {}
    type_mismatch_count = 0
    total_elements_checked = 0
    
    # Check columns
    for col, expected_type in expected_schema.items():
        if col not in df.columns:
            errors.append(f"Missing Column: Column '{col}' of expected type '{expected_type}' is missing from the dataset.")
            continue
            
        col_series = df[col]
        total_elements_checked += len(col_series)
        
        if expected_type == "datetime":
            try:
                parsed = pd.to_datetime(col_series, errors='coerce')
                failures = parsed.isna().sum() - col_series.isna().sum()
                if failures > 0:
                    type_mismatch_count += failures
                    warnings.append(f"Type Mismatch: Column '{col}' contains {failures} values that cannot be parsed as datetime.")
                type_compliance[col] = "Pass" if failures == 0 else "Warn"
            except Exception as e:
                errors.append(f"Column '{col}' datetime parsing failed: {str(e)}")
                type_compliance[col] = "Fail"
                
        elif expected_type in ["float", "int"]:
            try:
                parsed = pd.to_numeric(col_series, errors='coerce')
                failures = parsed.isna().sum() - col_series.isna().sum()
                if failures > 0:
                    type_mismatch_count += failures
                    warnings.append(f"Type Mismatch: Column '{col}' is listed as numeric, but contains {failures} non-numeric/empty values.")
                
                # Check for floating values in integer column
                if expected_type == "int" and failures == 0:
                    is_all_int = parsed.dropna().apply(lambda x: float(x).is_integer()).all()
                    if not is_all_int:
                        warnings.append(f"Precision Warning: Column '{col}' is specified as integer, but contains decimal values.")
                        
                type_compliance[col] = "Pass" if failures == 0 else "Warn"
            except Exception as e:
                errors.append(f"Column '{col}' numeric parsing failed: {str(e)}")
                type_compliance[col] = "Fail"
        else:
            # Categorical / string checks
            type_compliance[col] = "Pass"

    # Identify duplicate unique keys
    duplicate_count = 0
    if unique_key_cols:
        existing_keys = [c for c in unique_key_cols if c in df.columns]
        if existing_keys:
            duplicates = df.duplicated(subset=existing_keys, keep=False)
            duplicate_count = duplicates.sum()
            if duplicate_count > 0:
                warnings.append(f"Constraint Violation: Found {duplicate_count} records with duplicate keys on {existing_keys}.")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "type_compliance": type_compliance,
        "type_mismatch_count": int(type_mismatch_count),
        "duplicate_count": int(duplicate_count),
        "total_elements_checked": total_elements_checked
    }

def validate_timestamp_cadence(
    df: pd.DataFrame, 
    timestamp_col: str, 
    expected_freq_hours: float = 1.0
) -> Dict[str, Any]:
    """
    Validates chronological sequence of records if a datetime column is highlighted.
    """
    if timestamp_col not in df.columns:
        return {"error": f"Timestamp column '{timestamp_col}' not found"}
        
    try:
        ts_series = pd.to_datetime(df[timestamp_col], errors='coerce').dropna()
        if ts_series.empty:
            return {"error": "Datetime/timestamp column contains no valid elements."}
            
        sorted_ts = ts_series.sort_values().unique()
        time_deltas = pd.Series(sorted_ts).diff().dropna()
        delta_hours = time_deltas.dt.total_seconds() / 3600.0
        
        gaps_count = (delta_hours > expected_freq_hours).sum()
        short_sampling_count = (delta_hours < expected_freq_hours).sum()
        
        is_chronological = ts_series.is_monotonic_increasing
        
        timeline_start = sorted_ts[0].strftime("%Y-%m-%d %H:%M:%S")
        timeline_end = sorted_ts[-1].strftime("%Y-%m-%d %H:%M:%S")
        
        warnings = []
        if not is_chronological:
            warnings.append("Chronological Out-of-Order: Timestamps are not naturally ordered ascending.")
        if gaps_count > 0:
            warnings.append(f"Sequence Gaps: Detected {gaps_count} places where spacing exceeds {expected_freq_hours} hours.")
        if short_sampling_count > 0:
            warnings.append(f"Uneven Interval: Detected {short_sampling_count} places where intervals are closer than {expected_freq_hours} hours.")
            
        return {
            "is_chronological": bool(is_chronological),
            "timeline_start": timeline_start,
            "timeline_end": timeline_end,
            "gaps_count": int(gaps_count),
            "noise_frequency_count": int(short_sampling_count),
            "warnings": warnings,
            "median_delta_hours": float(delta_hours.median()) if not delta_hours.empty else expected_freq_hours
        }
    except Exception as e:
        return {"error": f"Failed evaluating timeframe cadence: {str(e)}"}

def validate_logical_bounds(
    df: pd.DataFrame, 
    logical_thresholds: Dict[str, Tuple[float, float]]
) -> Dict[str, Any]:
    """
    Checks if numeric values lie within logical boundaries (e.g. positive pricing, age limits, percentages).
    """
    violations = {}
    total_violations_count = 0
    detailed_warnings = []
    
    for col, bounds in logical_thresholds.items():
        if col not in df.columns:
            continue
            
        min_bound, max_bound = bounds
        col_series = pd.to_numeric(df[col], errors='coerce')
        
        below_min = col_series < min_bound
        above_max = col_series > max_bound
        
        below_count = below_min.sum()
        above_count = above_max.sum()
        col_tot = below_count + above_count
        
        if col_tot > 0:
            total_violations_count += col_tot
            violations[col] = {
                "below_min_count": int(below_count),
                "above_max_count": int(above_count),
                "total_violations": int(col_tot),
                "min_observed": float(col_series.min()) if not col_series.dropna().empty else 0.0,
                "max_observed": float(col_series.max()) if not col_series.dropna().empty else 0.0
            }
            detailed_warnings.append(
                f"Logical Bounds Violation: Column '{col}' exceeds user constraints [{min_bound}, {max_bound}]. "
                f"Found {col_tot} incidents (Min: {col_series.min()}, Max: {col_series.max()})."
            )
            
    return {
        "violations_detected": total_violations_count > 0,
        "violations_by_column": violations,
        "total_violations_count": int(total_violations_count),
        "warnings": detailed_warnings
    }

def analyze_distribution_shift(
    df_before: pd.DataFrame,
    df_after: pd.DataFrame,
    numerical_columns: List[str],
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Performs Kolmogorov-Smirnov continuous distribution tests to ensure engineering edits (e.g. imputation/scaling)
    do not mathematically warp data representation and characteristics.
    """
    shift_results = {}
    altered_cols_count = 0
    warnings = []
    
    for col in numerical_columns:
        if col not in df_before.columns or col not in df_after.columns:
            continue
            
        vals_before = pd.to_numeric(df_before[col], errors='coerce').dropna()
        vals_after = pd.to_numeric(df_after[col], errors='coerce').dropna()
        
        if vals_before.empty or vals_after.empty:
            continue
            
        ks_stat, p_value = stats.ks_2samp(vals_before, vals_after)
        
        mean_delta_pct = abs((vals_after.mean() - vals_before.mean()) / vals_before.mean()) * 100.0 if vals_before.mean() != 0 else 0.0
        std_delta_pct = abs((vals_after.std() - vals_before.std()) / vals_before.std()) * 100.0 if vals_before.std() != 0 else 0.0
        
        is_statistically_different = p_value < alpha
        is_variance_distorted = std_delta_pct > 25.0
        
        column_alert = is_statistically_different or is_variance_distorted
        if column_alert:
            altered_cols_count += 1
            reason = []
            if is_statistically_different:
                reason.append(f"Statistically divergent (p-value: {p_value:.4f} < alpha:{alpha})")
            if is_variance_distorted:
                reason.append(f"Variance shift ({std_delta_pct:.1f}% deviation)")
                
            warnings.append(
                f"Statistical Bias Alert: Column '{col}' distribution severely adjusted post-treatment. "
                f"Cause: {', '.join(reason)}."
            )
            
        shift_results[col] = {
            "ks_statistic": round(float(ks_stat), 4),
            "p_value": round(float(p_value), 4),
            "baseline_mean": round(float(vals_before.mean()), 3),
            "engineered_mean": round(float(vals_after.mean()), 3),
            "mean_shift_percent": round(mean_delta_pct, 1),
            "baseline_std": round(float(vals_before.std()), 3),
            "engineered_std": round(float(vals_after.std()), 3),
            "std_shift_percent": round(std_delta_pct, 1),
            "distorted": bool(column_alert)
        }
        
    drift_score = altered_cols_count / len(numerical_columns) if numerical_columns else 0.0
    
    return {
        "drift_score_ratio": round(drift_score, 2),
        "drift_detected": drift_score > 0.3,
        "column_drift_report": shift_results,
        "warnings": warnings
    }
