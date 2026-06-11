export type DataRecord = Record<string, any>;

export interface ColumnEngineeringConfig {
  imputeStrategy: "interpolate" | "mean" | "median" | "ffill";
  outlierStrategy: "iqr" | "zscore";
  outlierThreshold: number;
  outlierAction: "cap" | "nullify" | "remove";
  scalingStrategy: "standard" | "minmax" | "none";
  invalidFormatAction: "coerce_impute" | "extract_numeric";
}

export interface IngestionDiagnostics {
  success: boolean;
  integrity_score: number;
  rating: string;
  penalties: {
    duplicates: number;
    type_mismatches: number;
    threshold_violations: number;
  };
  warnings: string[];
  counts: {
    duplicate_records: number;
    exact_row_duplicates?: number;
    type_mismatch: number;
    threshold_violations_count: number;
  };
}

export interface EngineeringDiagnostics {
  engineering_health_score: number;
  rating: string;
  penalties: {
    missing_data: number;
    outliers_presence: number;
    distribution_drift: number;
  };
  completeness_score: number;
  distribution_consistency_score: number;
  outlier_summary: {
    outlier_counts: Record<string, number>;
    total_outliers: number;
    outlier_ratio: number;
  };
  drift_summary: {
    drift_score_ratio: number;
    drift_detected: boolean;
    warnings: string[];
  };
  warnings: string[];
}

export interface CorrelationPair {
  feature_a: string;
  feature_b: string;
  coefficient: number;
  strength: "Strong" | "Moderate" | "Very Weak" | "Weak";
  direction: "Strong Positive" | "Strong Negative" | "Positive" | "Negative" | "None / Direct Correlation";
}

export interface DescribeRow {
  col: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  p25: number;
  p50: number;
  p75: number;
  max: number;
  skewness: number;
  kurtosis: number;
}

export interface EdaDiagnostics {
  correlation_matrix: Record<string, Record<string, number>>;
  high_correlations: CorrelationPair[];
  insights: string[];
  numerical_summary: DescribeRow[];
  summary_insights?: string[];
  distribution_insights?: string[];
  relationship_insights?: string[];
}

