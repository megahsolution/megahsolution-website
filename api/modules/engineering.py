"""
Module 2: Data Engineering & Cleansing
The Sanitization module handles missing value imputation, sensor outlier flagging and clipping, 
and numerical standard scaling. Tracks statistical distortion to keep human operators safe.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
from ..utils.validation import analyze_distribution_shift
from ..utils.health_score import calculate_engineering_health

def detect_and_handle_outliers(
    df: pd.DataFrame,
    columns: List[str],
    method: str = "iqr",
    threshold: float = 1.5,
    action: str = "cap" # "cap", "remove", "nullify"
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Scans specified numeric columns for statistical outliers using IQR or Z-score bounds.
    """
    df_out = df.copy()
    outlier_counts = {}
    total_outliers = 0
    total_non_nulls = 0
    
    for col in columns:
        if col not in df_out.columns:
            continue
            
        series = pd.to_numeric(df_out[col], errors='coerce')
        valid_series = series.dropna()
        total_non_nulls += len(valid_series)
        
        if valid_series.empty:
            continue
            
        if method == "iqr":
            q1 = valid_series.quantile(0.25)
            q3 = valid_series.quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - (threshold * iqr)
            upper_bound = q3 + (threshold * iqr)
        else: # Z-Score method
            mean_val = valid_series.mean()
            std_val = valid_series.std()
            std_val = std_val if std_val > 0 else 1e-5
            lower_bound = mean_val - (threshold * std_val)
            upper_bound = mean_val + (threshold * std_val)
            
        outliers_mask = (series < lower_bound) | (series > upper_bound)
        count = outliers_mask.sum()
        outlier_counts[col] = int(count)
        total_outliers += count
        
        if action == "cap":
            df_out[col] = df_out[col].clip(lower=lower_bound, upper=upper_bound)
        elif action == "nullify":
            df_out.loc[outliers_mask, col] = np.nan
        elif action == "remove":
            df_out = df_out[~outliers_mask]
            
    outlier_ratio = total_outliers / total_non_nulls if total_non_nulls else 0.0
    
    return df_out, {
        "outlier_counts": outlier_counts,
        "total_outliers": int(total_outliers),
        "outlier_ratio": float(outlier_ratio)
    }

def impute_missing_values(
    df: pd.DataFrame,
    columns: List[str],
    method: str = "interpolate" # "interpolate", "mean", "median", "ffill"
) -> pd.DataFrame:
    """
    Resolves timeline missing cells or nullified sensor inputs.
    """
    df_imp = df.copy()
    
    for col in columns:
        if col not in df_imp.columns:
            continue
            
        if method == "mean":
            mean_val = pd.to_numeric(df_imp[col], errors='coerce').mean()
            df_imp[col] = df_imp[col].fillna(mean_val)
        elif method == "median":
            med_val = pd.to_numeric(df_imp[col], errors='coerce').median()
            df_imp[col] = df_imp[col].fillna(med_val)
        elif method == "ffill":
            df_imp[col] = df_imp[col].ffill().bfill()
        else: # Time-series linear interpolation
            df_imp[col] = pd.to_numeric(df_imp[col], errors='coerce').interpolate(method='linear').ffill().bfill()
            
    return df_imp

def scale_numerical_data(
    df: pd.DataFrame,
    columns: List[str],
    method: str = "standard" # "standard", "minmax", "none"
) -> pd.DataFrame:
    """
    Applies standardization (Mean=0, Std=1) or normalization (Min=0, Max=1) for machine learning convergence.
    """
    df_scl = df.copy()
    if method == "none":
        return df_scl
        
    for col in columns:
        if col not in df_scl.columns:
            continue
            
        series = pd.to_numeric(df_scl[col], errors='coerce')
        if series.dropna().empty:
            continue
            
        if method == "standard":
            mean_val = series.mean()
            std_val = series.std()
            std_val = std_val if std_val > 0 else 1.0
            df_scl[col] = (series - mean_val) / std_val
        elif method == "minmax":
            min_val = series.min()
            max_val = series.max()
            range_val = max_val - min_val if max_val != min_val else 1.0
            df_scl[col] = (series - min_val) / range_val
            
    return df_scl

def run_engineering_pipeline(
    df_raw: pd.DataFrame,
    df_ingested: pd.DataFrame,
    numerical_columns: List[str],
    impute_strategy: str = "interpolate",
    outlier_strategy: str = "iqr",
    outlier_threshold: float = 1.5,
    outlier_action: str = "cap",
    scaling_strategy: str = "standard"
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Executes Module 2 (Engineering & Sanitization).
    """
    df_baseline = df_ingested.copy()
    
    df_after_outliers, outlier_metrics = detect_and_handle_outliers(
        df_baseline, 
        numerical_columns, 
        method=outlier_strategy, 
        threshold=outlier_threshold, 
        action=outlier_action
    )
    
    df_imputed = impute_missing_values(
        df_after_outliers, 
        numerical_columns, 
        method=impute_strategy
    )
    
    raw_missing_cells = df_baseline[numerical_columns].isna().sum().sum()
    post_missing_cells = df_imputed[numerical_columns].isna().sum().sum()
    total_possible_cells = df_baseline[numerical_columns].size
    
    completeness_score = 100.0 * (1.0 - (post_missing_cells / total_possible_cells)) if total_possible_cells else 100.0
    initial_null_impact = 100.0 * (raw_missing_cells / total_possible_cells) if total_possible_cells else 0.0
    
    df_scaled = scale_numerical_data(
        df_imputed, 
        numerical_columns, 
        method=scaling_strategy
    )
    
    shift_metrics = analyze_distribution_shift(
        df_baseline, 
        df_imputed, 
        numerical_columns
    )
    
    health_results = calculate_engineering_health(
        null_percentage=initial_null_impact,
        outlier_ratio=outlier_metrics["outlier_ratio"],
        drift_score=shift_metrics["drift_score_ratio"]
    )
    
    diagnostics = {
        "success": True,
        "engineering_health_score": health_results["score"],
        "rating": health_results["rating"],
        "penalties": health_results["penalties"],
        "completeness_score": round(completeness_score, 1),
        "distribution_consistency_score": round(100.0 * (1.0 - shift_metrics["drift_score_ratio"]), 1),
        "outlier_summary": outlier_metrics,
        "drift_summary": shift_metrics,
        "warnings": shift_metrics["warnings"]
    }
    
    return df_scaled, diagnostics
