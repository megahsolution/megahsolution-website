"""
Module 1: Data Ingestion & Validation
The Ingestion Gate processes raw Excel files, infers data types, checks sequence constraints 
if datetime columns are selected, and computes Integrity Health metrics dynamically.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
from ..utils.validation import validate_schema_and_types, validate_timestamp_cadence, validate_logical_bounds
from ..utils.health_score import calculate_ingestion_integrity

def infer_schema_from_df(df: pd.DataFrame) -> Dict[str, str]:
    """
    Dynamically infers standard column types for generic datasets.
    """
    inferred = {}
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            inferred[col] = "datetime"
        elif "date" in col.lower() or "time" in col.lower() or "timestamp" in col.lower():
            try:
                pd.to_datetime(df[col].iloc[:50], errors='raise')
                inferred[col] = "datetime"
            except:
                inferred[col] = "category"
        elif pd.api.types.is_float_dtype(df[col]) or pd.api.types.is_numeric_dtype(df[col]):
            if pd.api.types.is_integer_dtype(df[col]):
                inferred[col] = "int"
            else:
                inferred[col] = "float"
        else:
            inferred[col] = "category"
    return inferred

def run_ingestion_pipeline(
    df_raw: pd.DataFrame,
    expected_schema: Dict[str, str] = None,
    operating_thresholds: Dict[str, Tuple[float, float]] = None,
    unique_keys: List[str] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Executes Module 1 (Data Analyst Sandbox Ingestion).
    """
    if expected_schema is None:
        schema = infer_schema_from_df(df_raw)
    else:
        schema = expected_schema
        
    thresholds = operating_thresholds or {}
    keys = unique_keys or []
    
    df = df_raw.copy()
    
    schema_results = validate_schema_and_types(df, schema, keys)
    
    for col, expected_type in schema.items():
        if col in df.columns:
            if expected_type == "datetime":
                df[col] = pd.to_datetime(df[col], errors='coerce')
            elif expected_type == "float":
                df[col] = pd.to_numeric(df[col], errors='coerce').astype(float)
            elif expected_type == "int":
                df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')
            elif expected_type in ["category", "string"]:
                df[col] = df[col].astype(str).astype("category")

    cadence_results = {}
    datetime_cols = [c for c, t in schema.items() if t == "datetime" and c in df.columns]
    if datetime_cols:
        target_dt = datetime_cols[0]
        cadence_results = validate_timestamp_cadence(df, target_dt, expected_freq_hours=24.0)
        
    boundary_results = validate_logical_bounds(df, thresholds)
    
    combined_warnings = []
    combined_warnings.extend(schema_results["warnings"])
    if "warnings" in cadence_results:
        combined_warnings.extend(cadence_results["warnings"])
    combined_warnings.extend(boundary_results["warnings"])
    
    total_checked_points = schema_results["total_elements_checked"]
    
    health_results = calculate_ingestion_integrity(
        total_records=len(df),
        duplicate_count=schema_results["duplicate_count"],
        type_mismatch_count=schema_results["type_mismatch_count"],
        threshold_violations_count=boundary_results["total_violations_count"],
        total_checked_points=total_checked_points
    )
    
    diagnostics = {
        "success": schema_results["valid"],
        "schema_valid": schema_results["valid"],
        "integrity_score": health_results["score"],
        "rating": health_results["rating"],
        "penalties": health_results["penalties"],
        "warnings": combined_warnings,
        "critical_errors": schema_results["errors"],
        "cadence_report": cadence_results,
        "boundary_report": boundary_results,
        "inferred_schema": schema,
        "counts": {
            "duplicate_records": schema_results["duplicate_count"],
            "type_mismatch": schema_results["type_mismatch_count"],
            "threshold_violations_count": boundary_results["total_violations_count"]
        }
    }
    
    return df, diagnostics
