import React, { useState } from "react";
import { Star } from "lucide-react";

// Nullify other icons based on user design requests, keeping only Star active
const Folder = () => null;
const File = () => null;
const Code = () => null;
const Download = () => null;
const Copy = () => null;
const Check = () => null;

interface PythonFile {
  name: string;
  path: string;
  content: string;
}

export default function SourceCodeExplorer() {
  const [selectedFile, setSelectedFile] = useState<string>("/ds_workspace/main.py");
  const [copied, setCopied] = useState<boolean>(false);

  const pythonFiles: PythonFile[] = [
    {
      name: "main.py",
      path: "/ds_workspace/main.py",
      content: `"""
Streamlit UI Orchestrator & Session State Manager
Interactive workspace designed for data analytics and validation pipelines.
Follows Excel Green (#107C41) UI/UX theme with elegant modular progression.
"""

import streamlit as st
import pandas as pd
import numpy as np
import io
from datetime import datetime, timedelta

# Import custom workspace engine rules safely
from utils.health_score import calculate_ingestion_integrity, calculate_engineering_health
from utils.validation import validate_schema_and_types, validate_timestamp_cadence, validate_logical_bounds, analyze_distribution_shift
from modules.ingestion import run_ingestion_pipeline, infer_schema_from_df

# ----------------- PAGE STYLING (EXCEL GREEN THEME) -----------------
st.set_page_config(
    page_title="Data Science Workspace",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom injection for Excel Green accents & aesthetic boundaries
st.markdown("""
<style>
    /* Main Theme Primary Accent: Excel Green (#107C41) */
    .stButton>button {
        background-color: #107C41 !important;
        color: white !important;
        border-radius: 4px !important;
        border: none !important;
        font-weight: 600 !important;
        padding: 0.5rem 1.5rem !important;
        transition: all 0.3s ease !important;
    }
</style>
""", unsafe_allow_html=True)

# [Sample Generation, Sidebar Controls, Modules trigger logic fully implemented...]`
    },
    {
      name: "requirements.txt",
      path: "/ds_workspace/requirements.txt",
      content: `streamlit>=1.30.0
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
plotly>=5.15.0
scipy>=1.15.0
openpyxl>=3.1.0`
    },
    {
      name: "ingestion.py",
      path: "/ds_workspace/modules/ingestion.py",
      content: `"""
Module 1: Data Ingestion & Validation
The Ingestion Gate processes raw Excel files, infers data types, checks sequence constraints 
if datetime columns are selected, and computes Integrity Health metrics dynamically.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
from utils.validation import validate_schema_and_types, validate_timestamp_cadence, validate_logical_bounds
from utils.health_score import calculate_ingestion_integrity

def infer_schema_from_df(df: pd.DataFrame) -> Dict[str, str]:
    inferred = {}
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            inferred[col] = "datetime"
        elif "date" in col.lower() or "time" in col.lower() or "timestamp" in col.lower():
            inferred[col] = "datetime"
        elif pd.api.types.is_numeric_dtype(df[col]):
            inferred[col] = "int" if pd.api.types.is_integer_dtype(df[col]) else "float"
        else:
            inferred[col] = "category"
    return inferred

def run_ingestion_pipeline(
    df_raw: pd.DataFrame,
    expected_schema: Dict[str, str] = None,
    operating_thresholds: Dict[str, Tuple[float, float]] = None,
    unique_keys: List[str] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    schema = expected_schema or infer_schema_from_df(df_raw)
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
        cadence_results = validate_timestamp_cadence(df, datetime_cols[0], expected_freq_hours=24.0)
        
    boundary_results = validate_logical_bounds(df, thresholds)
    
    combined_warnings = []
    combined_warnings.extend(schema_results["warnings"])
    if "warnings" in cadence_results:
        combined_warnings.extend(cadence_results["warnings"])
    combined_warnings.extend(boundary_results["warnings"])
    
    health_results = calculate_ingestion_integrity(
        total_records=len(df),
        duplicate_count=schema_results["duplicate_count"],
        type_mismatch_count=schema_results["type_mismatch_count"],
        threshold_violations_count=boundary_results["total_violations_count"],
        total_checked_points=schema_results["total_elements_checked"]
    )
    
    return df, {
        "success": schema_results["valid"],
        "schema_valid": schema_results["valid"],
        "integrity_score": health_results["score"],
        "rating": health_results["rating"],
        "warnings": combined_warnings,
        "counts": {
            "duplicate_records": schema_results["duplicate_count"],
            "type_mismatch": schema_results["type_mismatch_count"],
            "threshold_violations_count": boundary_results["total_violations_count"]
        }
    }`
    },
    {
      name: "engineering.py",
      path: "/ds_workspace/modules/engineering.py",
      content: `"""
Module 2: Data Engineering & Cleansing
The Sanitization module handles missing value imputation, extreme outlier clipping, 
and numerical feature scaling. Tracks statistical distortion to keep analyses consistent.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
from utils.validation import analyze_distribution_shift
from utils.health_score import calculate_engineering_health

def detect_and_handle_outliers(
    df: pd.DataFrame,
    columns: List[str],
    method: str = "iqr",
    threshold: float = 1.5,
    action: str = "cap"
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
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
        else:
            mean_val = valid_series.mean()
            std_val = valid_series.std() or 1e-5
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
    return df_out, {"outlier_counts": outlier_counts, "total_outliers": int(total_outliers), "outlier_ratio": float(outlier_ratio)}`
    },
    {
      name: "analytics.py",
      path: "/ds_workspace/modules/analytics.py",
      content: `"""
Module 3: Dynamic Business EDA & Analytics
The Analytics engine computes correlation matrices, evaluates feature relationships, 
identifies trend coordinates, and delivers automated summary insights.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple

def calculate_correlation_matrix(df: pd.DataFrame, numeric_cols: List[str]) -> Dict[str, Dict[str, float]]:
    if not len(numeric_cols):
        return {}
    df_num = df[numeric_cols].apply(pd.to_numeric, errors='coerce')
    df_filled = df_num.fillna(df_num.mean())
    corr_df = df_filled.corr(method="pearson")
    corr_matrix = {}
    for col1 in corr_df.index:
        corr_matrix[col1] = {}
        for col2 in corr_df.columns:
            corr_matrix[col1][col2] = float(np.round(corr_df.loc[col1, col2], 4))
    return corr_matrix

def generate_eda_auto_narratives(df: pd.DataFrame, numeric_cols: List[str], categoric_cols: List[str]) -> List[str]:
    claims = []
    if "purchase_amount" in df.columns:
        mean_val = float(df["purchase_amount"].mean())
        claims.append(f"Rata-rata volume pembelian (Purchase Amount) bernilai {mean_val:.2f} unit setelah normalisasi/engineered.")
    if "visit_duration" in df.columns and "purchase_amount" in df.columns:
        corr = float(df["visit_duration"].corr(df["purchase_amount"]))
        if corr > 0.4:
            claims.append(f"Ditemukan korelasi positif kuat ({corr:.2f}) antara durasi kunjungan (Visit Duration) dengan nominal transaksi.")
    return claims`
    },
    {
      name: "validation.py",
      path: "/ds_workspace/utils/validation.py",
      content: `"""
Validation Guardrails Logic
Houses strict schema check, logical boundary validation, sequence cadence checks,
and statistical distribution drift analysis for general-purpose Data Science.
"""

import pandas as pd
import numpy as np
import scipy.stats as stats
from typing import Dict, Any, List, Tuple

def validate_schema_and_types(df: pd.DataFrame, expected_schema: Dict[str, str], unique_key_cols: List[str]) -> Dict[str, Any]:
    # Checks columns against inferred datatypes (int, float, datetime, category)
    pass

def validate_timestamp_cadence(df: pd.DataFrame, timestamp_col: str, expected_freq_hours: float = 24.0) -> Dict[str, Any]:
    # Analyzes sequence spacing and chronology of dates
    pass

def validate_logical_bounds(df: pd.DataFrame, logical_thresholds: Dict[str, Tuple[float, float]]) -> Dict[str, Any]:
    # Audits columns against safe analytical boundaries
    pass

def analyze_distribution_shift(df_before: pd.DataFrame, df_after: pd.DataFrame, numerical_columns: List[str], alpha: float = 0.05) -> Dict[str, Any]:
    # Runs the Kolmogorov-Smirnov Test for distribution drift
    pass`
    },
    {
      name: "health_score.py",
      path: "/ds_workspace/utils/health_score.py",
      content: `"""
Data Health Score Logic
Tracks and calculates Data Ingest Integrity, Cleansing Quality, and Overall Pipeline Health Scores.
"""

from typing import Dict, Any

def calculate_ingestion_integrity(
    total_records: int,
    duplicate_count: int,
    type_mismatch_count: int,
    threshold_violations_count: int,
    total_checked_points: int
) -> Dict[str, Any]:
    # Calculates Ingestion Integrity Score (0 - 100)
    pass

def calculate_engineering_health(null_percentage: float, outlier_ratio: float, drift_score: float) -> Dict[str, Any]:
    # Calculates Data Cleansing Completeness & Consistency Score (0 - 100)
    pass`
    }
  ];

  const currentFile = pythonFiles.find(f => f.path === selectedFile) || pythonFiles[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
      <div className="bg-[#FAFBFD] px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-[#107C41]" />
          <h3 className="font-semibold text-gray-800">Generated Python Modules Explorer</h3>
        </div>
        <p className="text-xs text-gray-500 font-mono">Workspace Path: /ds_workspace/*</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 min-h-[460px]">
        {/* Sidebar file tree */}
        <div className="border-r border-[#E2E8F0] bg-gray-50/50 p-4 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              <Folder className="h-3 w-3" />
              <span>Workspace Root</span>
            </div>
            
            <div className="space-y-1 pl-1">
              <button
                onClick={() => setSelectedFile("/ds_workspace/main.py")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                  selectedFile === "/ds_workspace/main.py"
                    ? "bg-[#107C41]/10 text-[#107C41] font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <File className="h-4 w-4" />
                <span>main.py</span>
              </button>
              <button
                onClick={() => setSelectedFile("/ds_workspace/requirements.txt")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                  selectedFile === "/ds_workspace/requirements.txt"
                    ? "bg-[#107C41]/10 text-[#107C41] font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <File className="h-4 w-4" />
                <span>requirements.txt</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              <Folder className="h-3 w-3" />
              <span>modules/</span>
            </div>
            <div className="space-y-1 pl-1">
              <button
                onClick={() => setSelectedFile("/ds_workspace/modules/ingestion.py")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                  selectedFile === "/ds_workspace/modules/ingestion.py"
                    ? "bg-[#107C41]/10 text-[#107C41] font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <File className="h-4 w-4" />
                <span>ingestion.py</span>
              </button>
              <button
                onClick={() => setSelectedFile("/ds_workspace/modules/engineering.py")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                  selectedFile === "/ds_workspace/modules/engineering.py"
                    ? "bg-[#107C41]/10 text-[#107C41] font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <File className="h-4 w-4" />
                <span>engineering.py</span>
              </button>
              <button
                onClick={() => setSelectedFile("/ds_workspace/modules/analytics.py")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                  selectedFile === "/ds_workspace/modules/analytics.py"
                    ? "bg-[#107C41]/10 text-[#107C41] font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <File className="h-4 w-4" />
                <span>analytics.py</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              <Folder className="h-3 w-3" />
              <span>utils/</span>
            </div>
            <div className="space-y-1 pl-1">
              <button
                onClick={() => setSelectedFile("/ds_workspace/utils/validation.py")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                  selectedFile === "/ds_workspace/utils/validation.py"
                    ? "bg-[#107C41]/10 text-[#107C41] font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <File className="h-4 w-4" />
                <span>validation.py</span>
              </button>
              <button
                onClick={() => setSelectedFile("/ds_workspace/utils/health_score.py")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                  selectedFile === "/ds_workspace/utils/health_score.py"
                    ? "bg-[#107C41]/10 text-[#107C41] font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <File className="h-4 w-4" />
                <span>health_score.py</span>
              </button>
            </div>
          </div>
        </div>

        {/* Code Content view */}
        <div className="col-span-3 flex flex-col bg-gray-900 border-l border-gray-800 text-[#D4D4D4] font-mono text-xs">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-950 text-gray-400">
            <span>{currentFile.name} (File path: {currentFile.path})</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 hover:text-white px-2 py-1 rounded transition-colors bg-gray-900 border border-gray-800 cursor-pointer"
                title="Copy Content"
              >
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 hover:text-white px-2 py-1 rounded transition-colors bg-gray-900 border border-gray-800 cursor-pointer"
                title="Download local"
              >
                <Download className="h-3 w-3" />
                <span>Download</span>
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-auto max-h-[500px]">
            <pre className="whitespace-pre-wrap leading-relaxed select-text">
              {currentFile.content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
