"""
Vercel Serverless Entrypoint for Data Science Sandbox FastAPI
Exposes modular end-to-end data analytics, validation, and sanitization services.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Import custom workspace engine modules
from .utils.health_score import calculate_ingestion_integrity, calculate_engineering_health
from .utils.validation import (
    validate_schema_and_types,
    validate_timestamp_cadence,
    validate_logical_bounds,
    analyze_distribution_shift
)
from .modules.ingestion import run_ingestion_pipeline, infer_schema_from_df
from .modules.engineering import run_engineering_pipeline
from .modules.analytics import (
    calculate_correlation_matrix,
    identify_pivotal_correlations,
    generate_eda_auto_narratives
)

app = FastAPI(
    title="Data Science Sandbox API",
    description="Production-ready FastAPI engine for data ingestion, cleaning, validation, and analytics.",
    version="1.0.0"
)

# Enable CORS for cross-origin client apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- PYDANTIC REQUEST/RESPONSE MODULES -----------------

class GenerateDataRequest(BaseModel):
    rows: int = Field(default=150, ge=1, le=1000)
    noise: bool = Field(default=True)

class IngestRequest(BaseModel):
    records: List[Dict[str, Any]]
    expected_schema: Optional[Dict[str, str]] = None
    operating_thresholds: Optional[Dict[str, Tuple[float, float]]] = None
    unique_keys: Optional[List[str]] = None

class EngineerRequest(BaseModel):
    records_raw: List[Dict[str, Any]]
    records_ingested: List[Dict[str, Any]]
    numerical_columns: List[str]
    impute_strategy: str = Field(default="interpolate")
    outlier_strategy: str = Field(default="iqr")
    outlier_threshold: float = Field(default=1.5)
    outlier_action: str = Field(default="cap")
    scaling_strategy: str = Field(default="standard")

class AnalyticsRequest(BaseModel):
    records: List[Dict[str, Any]]
    numerical_columns: List[str]
    categorical_columns: List[str]

# ----------------- HELPER: SYNTHETIC DATA GENERATOR -----------------

def generate_sample_customer_data(rows: int = 150, noise: bool = True) -> pd.DataFrame:
    start_time = datetime(2026, 6, 1, 9, 0, 0)
    timestamps = [start_time + timedelta(hours=i) for i in range(rows)]
    
    if noise:
        timestamps[15] = timestamps[14]
        timestamps[55] = timestamps[55] + timedelta(hours=2)
        
    categories = ["Electronics", "Apparel", "Home & Kitchen", "Books", "Sports"]
    cat_col = [categories[i % len(categories)] for i in range(rows)]
    cust_id = [f"C-{1000 + (14 if noise and i == 15 else i) % 30}" for i in range(rows)]
    
    t = np.arange(rows)
    amount = 145.0 + 80.0 * np.sin(t / 10.0) + np.random.normal(0, 10.0, rows)
    duration = 12.5 + 4.5 * np.cos(t / 8.0) + np.random.normal(0, 0.8, rows)
    trans = [int(1 + (i % 4) + np.random.randint(1, 3)) for i in range(rows)]
    
    if noise:
        amount[10] = -45.0
        amount[45] = 12000.0
        duration[72] = -5.0
        duration[110] = 850.0
        amount[22] = np.nan
        amount[23] = np.nan
        duration[65] = np.nan
        
    df = pd.DataFrame({
        "customer_id": cust_id,
        "purchase_date": [ts.strftime("%Y-%m-%d %H:%M:%S") for ts in timestamps],
        "category": cat_col,
        "purchase_amount": amount,
        "visit_duration": duration,
        "transactions": trans
    })
    return df

# ----------------- API ENDPOINTS -----------------

@app.get("/")
@app.get("/api")
def root_info():
    return {
        "status": "online",
        "service": "Data Science Pipeline Engine",
        "framework": "FastAPI",
        "on_air": True
    }

@app.post("/api/generate_data")
def api_generate_data(req: GenerateDataRequest):
    try:
        df = generate_sample_customer_data(rows=req.rows, noise=req.noise)
        df_clean = df.replace({np.nan: None})
        return {
            "status": "success",
            "count": len(df_clean),
            "data": df_clean.to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@app.post("/api/ingest")
def api_ingest(req: IngestRequest):
    if not req.records:
        raise HTTPException(status_code=400, detail="Record list cannot be empty.")
    try:
        df_raw = pd.DataFrame(req.records)
        schema = req.expected_schema
        if schema is None:
            schema = infer_schema_from_df(df_raw)
            
        df_ingested, diagnostics = run_ingestion_pipeline(
            df_raw=df_raw,
            expected_schema=schema,
            operating_thresholds=req.operating_thresholds,
            unique_keys=req.unique_keys
        )
        
        df_clean = df_ingested.replace({np.nan: None})
        
        return {
            "status": "success",
            "diagnostics": diagnostics,
            "data": df_clean.to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.post("/api/engineer")
def api_engineer(req: EngineerRequest):
    if not req.records_raw or not req.records_ingested:
        raise HTTPException(status_code=400, detail="Data record lists cannot be empty.")
    try:
        df_raw = pd.DataFrame(req.records_raw)
        df_ingested = pd.DataFrame(req.records_ingested)
        
        df_engineered, diagnostics = run_engineering_pipeline(
            df_raw=df_raw,
            df_ingested=df_ingested,
            numerical_columns=req.numerical_columns,
            impute_strategy=req.impute_strategy,
            outlier_strategy=req.outlier_strategy,
            outlier_threshold=req.outlier_threshold,
            outlier_action=req.outlier_action,
            scaling_strategy=req.scaling_strategy
        )
        
        df_clean = df_engineered.replace({np.nan: None})
        
        return {
            "status": "success",
            "diagnostics": diagnostics,
            "data": df_clean.to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engineering failed: {str(e)}")

@app.post("/api/analytics")
def api_analytics(req: AnalyticsRequest):
    if not req.records:
        raise HTTPException(status_code=400, detail="Data list cannot be empty.")
    try:
        df = pd.DataFrame(req.records)
        
        corr_matrix = calculate_correlation_matrix(df, req.numerical_columns)
        pivotal_correlations = identify_pivotal_correlations(corr_matrix, threshold=0.1)
        narrative_claims = generate_eda_auto_narratives(df, req.numerical_columns, req.categorical_columns)
        
        return {
            "status": "success",
            "correlation_matrix": corr_matrix,
            "pivotal_correlations": pivotal_correlations,
            "narratives": narrative_claims
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {str(e)}")
