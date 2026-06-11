"""
Module 3: Dynamic Business EDA & Analytics
The Analytics engine computes correlation matrices, evaluates feature relationships, 
identifies trend coordinates, and delivers automated summary insights.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple

def calculate_correlation_matrix(df: pd.DataFrame, numeric_cols: List[str]) -> Dict[str, Dict[str, float]]:
    """
    Computes Pearson correlation coefficient between numeric features.
    """
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

def identify_pivotal_correlations(corr_matrix: Dict[str, Dict[str, float]], threshold: float = 0.3) -> List[Dict[str, Any]]:
    """
    Highlights significant relationship coefficients in the dataset.
    """
    high_pairs = []
    seen = set()
    
    for col1, targets in corr_matrix.items():
        for col2, val in targets.items():
            if col1 == col2:
                continue
            pair_key = tuple(sorted([col1, col2]))
            if pair_key not in seen:
                seen.add(pair_key)
                if abs(val) >= threshold:
                    high_pairs.append({
                        "feature_a": col1,
                        "feature_b": col2,
                        "coefficient": val,
                        "strength": "Kuat" if abs(val) > 0.6 else "Sedang",
                        "direction": "Positif (Searah)" if val > 0 else "Negatif (Berlawanan)"
                    })
    return sorted(high_pairs, key=lambda x: abs(x["coefficient"]), reverse=True)

def generate_eda_auto_narratives(df: pd.DataFrame, numeric_cols: List[str], categoric_cols: List[str]) -> List[str]:
    """
    Analyzes final dataset to output business recommendations and patterns.
    """
    claims = []
    
    if "purchase_amount" in df.columns:
        mean_val = float(df["purchase_amount"].mean())
        claims.append(f"Rata-rata volume pembelian (Purchase Amount) bernilai {mean_val:.2f} unit setelah normalisasi/engineered.")
        
    if "visit_duration" in df.columns and "purchase_amount" in df.columns:
        corr = float(df["visit_duration"].corr(df["purchase_amount"]))
        if corr > 0.4:
            claims.append(f"Ditemukan korelasi positif kuat ({corr:.2f}) antara durasi kunjungan (Visit Duration) dengan nominal transaksi. Rekomendasi: Optimalkan retensi halaman (stickiness).")
        elif corr > 0.1:
            claims.append(f"Hubungan positif tipis ({corr:.2f}) terdeteksi antara durasi kunjungan dan nominal transaksi.")
            
    for cat in categoric_cols:
        if cat in df.columns:
            top_class = df[cat].value_counts().index[0]
            top_pct = float((df[cat] == top_class).sum() / len(df) * 100)
            claims.append(f"Variasi utama kelas pada kolom '{cat}' didominasi oleh kelompok '{top_class}' dengan kontribusi sebanyak {top_pct:.1f}%.")
            
    return claims
