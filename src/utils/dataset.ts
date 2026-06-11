import { DataRecord, IngestionDiagnostics, EngineeringDiagnostics, ColumnEngineeringConfig, CorrelationPair, EdaDiagnostics, DescribeRow } from "../types";

/**
 * Generates high-fidelity mock Business Customer Engagement dataset.
 * Contains duplicates, bounds violations, and null values for learning/analysing.
 */
export function generateSyntheticCustomerData(rows = 150, noise = true): DataRecord[] {
  const data: DataRecord[] = [];
  const categories = ["Electronics", "Apparel", "Home & Kitchen", "Books", "Sports"];
  const startTime = new Date(2026, 5, 1, 9, 0, 0); // June 1st, 9 AM

  for (let i = 0; i < rows; i++) {
    // Inject exact duplicate row (all columns identical) for testing
    if (noise && i === 25 && data.length > 0) {
      data.push({ ...data[data.length - 1] });
      continue;
    }
    if (noise && i === 60 && data.length > 0) {
      data.push({ ...data[data.length - 1] });
      continue;
    }

    const timestamp = new Date(startTime.getTime());
    timestamp.setHours(startTime.getHours() + i);

    // Apply noise
    if (noise) {
      if (i === 15) {
        // Create duplicate timestamp key
        timestamp.setHours(startTime.getHours() + 14);
      }
      if (i === 55) {
        // Create datetime jump/gap
        timestamp.setHours(startTime.getHours() + 57);
      }
    }

    const customer_id = `C-${1000 + (noise && i === 15 ? 14 : i) % 30}`; // composite key matches grouping
    const cat = categories[i % categories.length];

    // Standard business/customer metrics logic
    const t = i;
    let amount = 145.0 + 80.0 * Math.sin(t / 10.0) + (Math.random() - 0.5) * 35.0;
    let duration = 12.5 + 4.5 * Math.cos(t / 8.0) + (Math.random() - 0.5) * 2.0;
    let trans = Math.floor(1 + (i % 4) + Math.random() * 2);

    // Inject heavy anomalies and null cells to test data scientist's guardrails
    if (noise) {
      if (i === 10) amount = -45.0;      // Invalid negative buy bounds
      if (i === 45) amount = 12000.0;    // Extreme high-spend outlier
      if (i === 72) duration = -5.0;     // Invalid negative duration
      if (i === 110) duration = 850.0;   // Extreme duration outlier
      if (i === 82) trans = 4.5;         // Stringent Decimal mismatch on count column

      // Missing values
      if (i === 22 || i === 23) amount = NaN;
      if (i === 65) duration = NaN;
      if (i === 30 || i === 31 || i === 32) trans = NaN;
    }

    let purchase_amount_val: any = isNaN(amount) ? null : Number(amount.toFixed(2));
    let visit_duration_val: any = isNaN(duration) ? null : Number(duration.toFixed(2));
    let transactions_val: any = isNaN(trans) ? null : trans;

    // Inject format anomalies specifically (e.g. text in numeric column)
    if (noise) {
      if (i === 35) {
        purchase_amount_val = "180.50_USD"; // Format anomaly: string with text in float column
      }
      if (i === 88) {
        visit_duration_val = "15.4_MINS"; // Format anomaly: string with text in float column
      }
      if (i === 52) {
        transactions_val = "4_PCS"; // Format anomaly: string with text in int column
      }
    }

    data.push({
      customer_id,
      purchase_date: formatTimestamp(timestamp),
      category: cat,
      purchase_amount: purchase_amount_val,
      visit_duration: visit_duration_val,
      transactions: transactions_val,
    });
  }

  return data;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Automatically infers column data types for any dataset schema
 */
export function inferSchema(data: DataRecord[]): Record<string, "datetime" | "float" | "int" | "category"> {
  if (!data || data.length === 0) return {};
  const schema: Record<string, "datetime" | "float" | "int" | "category"> = {};
  const sample = data[0];

  Object.keys(sample).forEach(col => {
    // Collect non-null values to test type
    const nonNulls = data.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== "");
    if (nonNulls.length === 0) {
      schema[col] = "category";
      return;
    }

    const firstVal = nonNulls[0];

    // 1. Double check datetime formats
    if (typeof firstVal === "string" && !isNaN(Date.parse(firstVal)) && (firstVal.includes("-") || firstVal.includes("/")) && (firstVal.includes(":") || /^[0-9-]{8,20}$/.test(firstVal))) {
      schema[col] = "datetime";
    } else if (typeof firstVal === "number") {
      // Check if integers/decimals
      const isDecimal = nonNulls.some(v => typeof v === "number" && !Number.isInteger(v));
      schema[col] = isDecimal ? "float" : "int";
    } else if (typeof firstVal === "boolean") {
      schema[col] = "category";
    } else {
      // Clean string floats check
      const looksNumeric = nonNulls.slice(0, 10).every(v => !isNaN(Number(v)));
      if (looksNumeric) {
        const isDecimal = nonNulls.some(v => !Number.isInteger(Number(v)));
        schema[col] = isDecimal ? "float" : "int";
      } else {
        schema[col] = "category";
      }
    }
  });

  return schema;
}

/**
 * JS implementation of Ingestion Pipeline (Module 1) for Generic datasets
 */
export function runIngestionStage(
  raw: DataRecord[],
  schema: Record<string, "datetime" | "float" | "int" | "category">,
  thresholds: Record<string, { min: number; max: number }>,
  uniqueKeyCols: string[],
  datetimeColName?: string
): { data: DataRecord[]; diagnostics: IngestionDiagnostics } {
  const data = raw.map(r => ({ ...r }));
  const warnings: string[] = [];

  // 1. Data Completeness Check
  let missingCellCount = 0;
  data.forEach((row) => {
    Object.keys(schema).forEach((col) => {
      const val = row[col];
      if (val === null || val === undefined || val === "") {
        missingCellCount++;
      }
    });
  });

  if (missingCellCount > 0) {
    warnings.push(`[Data Completeness] Terdapat ${missingCellCount} sel kosong (Null / Empty) yang terdeteksi pada dataset.`);
  }

  // 2. Data Uniqueness Check
  let duplicateCount = 0;
  let exactRowDuplicateCount = 0;

  // Let's first check for exact row duplicates (all column values match)
  const seenFullRows = new Set<string>();
  data.forEach(row => {
    // stringify sorting by keys to prevent order mismatches
    const rowStr = Object.keys(row).sort().map(k => `${k}:${row[k]}`).join("||");
    if (seenFullRows.has(rowStr)) {
      exactRowDuplicateCount++;
    } else {
      seenFullRows.add(rowStr);
    }
  });

  if (exactRowDuplicateCount > 0) {
    warnings.push(`[Data Uniqueness] Terdeteksi ${exactRowDuplicateCount} baris data duplikat penuh (seluruh kolom identik).`);
  }

  // Then check for composite key overlaps
  if (uniqueKeyCols && uniqueKeyCols.length > 0) {
    const keyMap = new Set<string>();
    data.forEach(row => {
      const compositeKey = uniqueKeyCols.map(k => String(row[k] ?? "")).join("::");
      if (keyMap.has(compositeKey)) {
        duplicateCount++;
      } else {
        keyMap.add(compositeKey);
      }
    });

    if (duplicateCount > 0) {
      warnings.push(`[Data Uniqueness] Terdeteksi ${duplicateCount} baris data duplikat berdasarkan pencocokan composite key.`);
    }
  }

  // 3. Data Validity Check (Logical Bounds & Constraints)
  let thresholdViolationsCount = 0;
  Object.entries(thresholds).forEach(([col, bound]) => {
    if (!schema[col] || (schema[col] !== "float" && schema[col] !== "int")) return;

    data.forEach(row => {
      const val = row[col];
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        const numVal = Number(val);
        if (numVal < bound.min || numVal > bound.max) {
          thresholdViolationsCount++;
        }
      }
    });
  });

  if (thresholdViolationsCount > 0) {
    warnings.push(`[Data Validity] Terdeteksi ${thresholdViolationsCount} nilai di luar jangkauan batas rentang logis (Logical Bounds) yang ditetapkan.`);
  }

  // 4. Data Conformity Check (Type & Class formatting)
  let typeMismatchCount = 0;
  data.forEach((row) => {
    Object.entries(schema).forEach(([col, colType]) => {
      const val = row[col];
      if (val === null || val === undefined || val === "") {
        return;
      }

      if (colType === "datetime") {
        const parsed = new Date(val).getTime();
        if (isNaN(parsed)) {
          typeMismatchCount++;
        }
      } else if (colType === "float" || colType === "int") {
        const num = Number(val);
        if (isNaN(num)) {
          typeMismatchCount++;
        } else if (colType === "int" && !Number.isInteger(num)) {
          typeMismatchCount++;
        }
      }
    });
  });

  if (typeMismatchCount > 0) {
    warnings.push(`[Data Conformity] Terdeteksi ${typeMismatchCount} kasus ketidaksesuaian tipe data murni (Data Type Mismatch) berdasarkan aturan skema.`);
  }

  // Calculate Ingestion Integrity Rating (0 - 100)
  const totalCheckedCells = data.length * Object.keys(schema).length || 1;
  const pDup = Math.min(30.0, ((duplicateCount + exactRowDuplicateCount) / data.length) * 150.0);
  const pTyp = Math.min(40.0, (typeMismatchCount / totalCheckedCells) * 100.0);
  const pThr = Math.min(30.0, (thresholdViolationsCount / totalCheckedCells) * 100.0);
  const score = Math.max(0.0, 100.0 - (pDup + pTyp + pThr));

  let rating = "Excellent";
  if (score < 50) rating = "Poor (Critical Schema/Boundary Warnings)";
  else if (score < 75) rating = "Fair (Requires Review)";
  else if (score < 90) rating = "Good";

  const diagnostics: IngestionDiagnostics = {
    success: true,
    integrity_score: Number(score.toFixed(1)),
    rating,
    penalties: {
      duplicates: Number(pDup.toFixed(1)),
      type_mismatches: Number(pTyp.toFixed(1)),
      threshold_violations: Number(pThr.toFixed(1))
    },
    warnings,
    counts: {
      duplicate_records: duplicateCount,
      exact_row_duplicates: exactRowDuplicateCount,
      type_mismatch: typeMismatchCount,
      threshold_violations_count: thresholdViolationsCount
    }
  };

  return { data, diagnostics };
}

/**
 * JS implementation of Sanitization and Feature Engineering (Module 2) for dynamic schemas
 */
export function runEngineeringStage(
  ingested: DataRecord[],
  baserecords: DataRecord[],
  schema: Record<string, "datetime" | "float" | "int" | "category">,
  columnConfigs: Record<string, ColumnEngineeringConfig>
): { data: DataRecord[]; diagnostics: EngineeringDiagnostics } {
  let data = ingested.map(r => ({ ...r }));

  const defaultConfig: ColumnEngineeringConfig = {
    imputeStrategy: "interpolate",
    outlierStrategy: "iqr",
    outlierThreshold: 1.5,
    outlierAction: "cap",
    scalingStrategy: "standard",
    invalidFormatAction: "coerce_impute"
  };

  // Identify numeric columns dynamically
  const numericCols = Object.entries(schema)
    .filter(([_, colType]) => colType === "float" || colType === "int")
    .map(([colName]) => colName);

  // 0. Preprocess and Clean Format Anomalies (e.g. "180.50_USD")
  let formatAnomaliesCleaned = 0;
  let formatAnomaliesCoerced = 0;

  data.forEach((row) => {
    numericCols.forEach((col) => {
      const colConfig = columnConfigs[col] || defaultConfig;
      const val = row[col];
      if (val !== null && val !== undefined && val !== "") {
        const numVal = Number(val);
        if (isNaN(numVal)) {
          // Format anomaly detected
          if (colConfig.invalidFormatAction === "extract_numeric") {
            const stripped = String(val).replace(/[^\d.-]/g, "");
            const parsed = parseFloat(stripped);
            if (!isNaN(parsed)) {
              row[col] = parsed;
              formatAnomaliesCleaned++;
            } else {
              row[col] = null;
              formatAnomaliesCoerced++;
            }
          } else {
            // coerce_impute
            row[col] = null;
            formatAnomaliesCoerced++;
          }
        } else {
          row[col] = numVal;
        }
      }
    });
  });

  // 1. Detect & Handle Outliers
  const outlierCounts: Record<string, number> = {};
  numericCols.forEach(col => { outlierCounts[col] = 0; });

  let totalOutliers = 0;
  let totalValuesChecked = 0;

  numericCols.forEach(col => {
    const colConfig = columnConfigs[col] || defaultConfig;
    const values = data.map(r => Number(r[col])).filter(v => v !== null && !isNaN(v));
    if (values.length === 0) return;

    totalValuesChecked += values.length;

    let lowerBound = -999999;
    let upperBound = 999999;

    if (colConfig.outlierStrategy === "iqr") {
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
      const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
      const iqr = q3 - q1;
      lowerBound = q1 - colConfig.outlierThreshold * iqr;
      upperBound = q3 + colConfig.outlierThreshold * iqr;
    } else {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const tVar = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
      const std = Math.sqrt(tVar) || 1.0;
      lowerBound = avg - colConfig.outlierThreshold * std;
      upperBound = avg + colConfig.outlierThreshold * std;
    }

    data.forEach(row => {
      const val = row[col];
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        const numVal = Number(val);
        if (numVal < lowerBound || numVal > upperBound) {
          outlierCounts[col] = (outlierCounts[col] || 0) + 1;
          totalOutliers++;

          if (colConfig.outlierAction === "cap") {
            row[col] = Number(Math.max(lowerBound, Math.min(numVal, upperBound)).toFixed(3));
          } else if (colConfig.outlierAction === "nullify") {
            row[col] = null;
          }
        }
      }
    });
  });

  // Remove rows if outlierAction is configured to "remove" for any columns
  let anyRemoveAction = false;
  numericCols.forEach(col => {
    const colConfig = columnConfigs[col] || defaultConfig;
    if (colConfig.outlierAction === "remove") {
      anyRemoveAction = true;
    }
  });

  if (anyRemoveAction) {
    data = data.filter(row => {
      let keepRow = true;
      numericCols.forEach(col => {
        const colConfig = columnConfigs[col] || defaultConfig;
        if (colConfig.outlierAction === "remove") {
          const val = row[col];
          if (val !== null && val !== undefined && !isNaN(Number(val))) {
            const numVal = Number(val);
            const values = ingested.map(r => Number(r[col])).filter(v => v !== null && !isNaN(v));
            if (values.length > 0) {
              let lowerBound = -999999;
              let upperBound = 999999;
              if (colConfig.outlierStrategy === "iqr") {
                const sorted = [...values].sort((a, b) => a - b);
                const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
                const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
                const iqr = q3 - q1;
                lowerBound = q1 - colConfig.outlierThreshold * iqr;
                upperBound = q3 + colConfig.outlierThreshold * iqr;
              } else {
                const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
                const tVar = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
                const std = Math.sqrt(tVar) || 1.0;
                lowerBound = avg - colConfig.outlierThreshold * std;
                upperBound = avg + colConfig.outlierThreshold * std;
              }
              if (numVal < lowerBound || numVal > upperBound) {
                keepRow = false;
              }
            }
          }
        }
      });
      return keepRow;
    });
  }

  // 2. Impute Missing Values
  numericCols.forEach(col => {
    const colConfig = columnConfigs[col] || defaultConfig;
    const validVals = data.map(r => Number(r[col])).filter(v => v !== null && !isNaN(v));
    const meanVal = validVals.length ? validVals.reduce((sum, v) => sum + v, 0) / validVals.length : 0.0;
    const sorted = [...validVals].sort((a, b) => a - b);
    const medianVal = sorted.length ? sorted[Math.floor(sorted.length / 2)] ?? 0.0 : 0.0;

    for (let i = 0; i < data.length; i++) {
      const rawVal = data[i][col];
      if (rawVal === null || rawVal === undefined || isNaN(Number(rawVal))) {
        if (colConfig.imputeStrategy === "mean") {
          data[i][col] = Number(meanVal.toFixed(3));
        } else if (colConfig.imputeStrategy === "median") {
          data[i][col] = Number(medianVal.toFixed(3));
        } else if (colConfig.imputeStrategy === "ffill") {
          let filled = false;
          for (let prev = i - 1; prev >= 0; prev--) {
            if (data[prev][col] !== null && data[prev][col] !== undefined && !isNaN(Number(data[prev][col]))) {
              data[i][col] = data[prev][col];
              filled = true;
              break;
            }
          }
          if (!filled) {
            for (let next = i + 1; next < data.length; next++) {
              if (data[next][col] !== null && data[next][col] !== undefined && !isNaN(Number(data[next][col]))) {
                data[i][col] = data[next][col];
                filled = true;
                break;
              }
            }
          }
          if (!filled) data[i][col] = Number(meanVal.toFixed(3));
        } else {
          // Linear Interpolation
          let prevIdx = -1;
          for (let p = i - 1; p >= 0; p--) {
            if (data[p][col] !== null && data[p][col] !== undefined && !isNaN(Number(data[p][col]))) {
              prevIdx = p;
              break;
            }
          }
          let nextIdx = -1;
          for (let n = i + 1; n < data.length; n++) {
            if (data[n][col] !== null && data[n][col] !== undefined && !isNaN(Number(data[n][col]))) {
              nextIdx = n;
              break;
            }
          }

          if (prevIdx !== -1 && nextIdx !== -1) {
            const prevVal = Number(data[prevIdx][col]);
            const nextVal = Number(data[nextIdx][col]);
            const fraction = (i - prevIdx) / (nextIdx - prevIdx);
            data[i][col] = Number((prevVal + (nextVal - prevVal) * fraction).toFixed(3));
          } else if (prevIdx !== -1) {
            data[i][col] = data[prevIdx][col];
          } else if (nextIdx !== -1) {
            data[i][col] = data[nextIdx][col];
          } else {
            data[i][col] = Number(meanVal.toFixed(3));
          }
        }
      }
    }
  });

  // Calculate Completeness Score
  let rawNullCount = 0;
  baserecords.forEach(row => {
    numericCols.forEach(col => {
      const val = row[col];
      if (val === null || val === undefined || isNaN(Number(val))) {
        rawNullCount++;
      }
    });
  });

  const totalPossibleCells = baserecords.length * numericCols.length || 1;
  const initialNullImpact = (rawNullCount / totalPossibleCells) * 100.0;
  const completenessScore = 100.0; // final output is completely filled

  // Analyze Distribution Drift
  const originalStats = numericCols.map(col => {
    const valid = ingested.map(r => Number(r[col])).filter(v => v !== null && !isNaN(v));
    const mean = valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0.0;
    const std = Math.sqrt(valid.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / valid.length) || 1.0;
    return { col, mean, std };
  });

  let driftColumnsCount = 0;
  const driftWarnings: string[] = [];

  numericCols.forEach(col => {
    const baseStat = originalStats.find(s => s.col === col)!;
    const currentVals = data.map(r => Number(r[col])).filter(v => v !== null && !isNaN(v));
    if (currentVals.length === 0) return;

    const curMean = currentVals.reduce((s, v) => s + v, 0) / currentVals.length;
    const curVar = currentVals.reduce((s, v) => s + Math.pow(v - curMean, 2), 0) / currentVals.length;
    const curStd = Math.sqrt(curVar) || 1.0;

    const stdShiftPct = baseStat.std !== 0 ? Math.abs((curStd - baseStat.std) / baseStat.std) * 100.0 : 0.0;
    const meanShiftPct = baseStat.mean !== 0 ? Math.abs((curMean - baseStat.mean) / baseStat.mean) * 100.0 : 0.0;

    if (stdShiftPct > 25.0 || meanShiftPct > 20.0) {
      driftColumnsCount++;
      driftWarnings.push(`Statistical Bias Warning (Column '${col}'): Distribution severely transformed. Variance Shift: ${stdShiftPct.toFixed(1)}%, Mean Shift: ${meanShiftPct.toFixed(1)}%.`);
    }
  });

  if (formatAnomaliesCleaned > 0 || formatAnomaliesCoerced > 0) {
    driftWarnings.unshift(`Format Cleansing: Cleared format anomalies of numeric type. Successfully salvaged ${formatAnomaliesCleaned} values via Extraction, coerced & imputed ${formatAnomaliesCoerced} values.`);
  }

  const driftScoreRatio = numericCols.length ? driftColumnsCount / numericCols.length : 0;
  const distributionConsistencyScore = Math.max(0.0, 100.0 - (driftScoreRatio * 100.0));

  // 3. Perform Scaling
  data.forEach(row => {
    numericCols.forEach(col => {
      const colConfig = columnConfigs[col] || defaultConfig;
      const val = row[col];
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        const numVal = Number(val);
        if (colConfig.scalingStrategy === "standard") {
          const statsVal = originalStats.find(s => s.col === col)!;
          row[col] = Number(((numVal - statsVal.mean) / (statsVal.std || 1.0)).toFixed(3));
        } else if (colConfig.scalingStrategy === "minmax") {
          const values = ingested.map(r => Number(r[col])).filter(v => v !== null && !isNaN(v));
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min || 1.0;
          row[col] = Number(((numVal - min) / range).toFixed(3));
        } else {
          row[col] = Number(numVal.toFixed(3));
        }
      }
    });
  });

  // Calculate sanitization health metrics
  const pNull = Math.min(40.0, initialNullImpact * 1.5);
  const pOut = Math.min(25.0, (totalOutliers / (totalValuesChecked || 1)) * 100.0);
  const pDrift = Math.min(35.0, driftScoreRatio * 100.0);
  const healthScore = Math.max(0.0, 100.0 - (pNull + pOut + pDrift));

  let rating = "Pragmatic (Ready for Modelling)";
  if (healthScore < 50) rating = "Corrupted/Degraded (Severe Damage)";
  else if (healthScore < 75) rating = "Disrupted (Review Imputation/Scaling)";
  else if (healthScore < 90) rating = "Restructured (Minor Distribution Shift)";

  const diagnostics: EngineeringDiagnostics = {
    engineering_health_score: Number(healthScore.toFixed(1)),
    rating,
    penalties: {
      missing_data: Number(pNull.toFixed(1)),
      outliers_presence: Number(pOut.toFixed(1)),
      distribution_drift: Number(pDrift.toFixed(1))
    },
    completeness_score: completenessScore,
    distribution_consistency_score: Number(distributionConsistencyScore.toFixed(1)),
    outlier_summary: {
      outlier_counts: outlierCounts,
      total_outliers: totalOutliers,
      outlier_ratio: totalValuesChecked ? totalOutliers / totalValuesChecked : 0
    },
    drift_summary: {
      drift_score_ratio: driftScoreRatio,
      drift_detected: driftScoreRatio > 0.3,
      warnings: driftWarnings
    },
    warnings: driftWarnings
  };

  return { data, diagnostics };
}

/**
 * JS implementation of Business EDA Analysis and Correlation Matrix (Module 3)
 */
export function runEdaStage(
  data: DataRecord[],
  schema: Record<string, "datetime" | "float" | "int" | "category">
): EdaDiagnostics {
  const numericCols = Object.entries(schema)
    .filter(([_, type]) => type === "float" || type === "int")
    .map(([col]) => col);

  const categoricCols = Object.entries(schema)
    .filter(([_, type]) => type === "category")
    .map(([col]) => col);

  // Calculate correlation matrix
  const correlation_matrix: Record<string, Record<string, number>> = {};
  numericCols.forEach(c1 => {
    correlation_matrix[c1] = {};
    numericCols.forEach(c2 => {
      if (c1 === c2) {
        correlation_matrix[c1][c2] = 1.0;
        return;
      }
      
      const vals1: number[] = [];
      const vals2: number[] = [];
      
      data.forEach(r => {
        const v1 = Number(r[c1]);
        const v2 = Number(r[c2]);
        if (!isNaN(v1) && !isNaN(v2) && r[c1] !== null && r[c2] !== null) {
          vals1.push(v1);
          vals2.push(v2);
        }
      });
      
      const n = Math.min(vals1.length, vals2.length);
      if (n < 2) {
        correlation_matrix[c1][c2] = 0.0;
        return;
      }
      
      const sum1 = vals1.reduce((a, b) => a + b, 0);
      const sum2 = vals2.reduce((a, b) => a + b, 0);
      const mean1 = sum1 / n;
      const mean2 = sum2 / n;
      
      let num = 0;
      let den1 = 0;
      let den2 = 0;
      for (let i = 0; i < n; i++) {
        const d1 = vals1[i] - mean1;
        const d2 = vals2[i] - mean2;
        num += d1 * d2;
        den1 += d1 * d1;
        den2 += d2 * d2;
      }
      const denom = Math.sqrt(den1 * den2);
      correlation_matrix[c1][c2] = denom === 0 ? 0.0 : Number((num / denom).toFixed(4));
    });
  });

  // Extract significant non-identity pairs
  const high_correlations: CorrelationPair[] = [];
  const seenPairs = new Set<string>();
  
  numericCols.forEach(c1 => {
    numericCols.forEach(c2 => {
      if (c1 === c2) return;
      const key = [c1, c2].sort().join("::");
      if (seenPairs.has(key)) return;
      seenPairs.add(key);
      
      const val = correlation_matrix[c1]?.[c2] ?? 0.0;
      const absVal = Math.abs(val);
      
      if (absVal >= 0.15) {
        let strength: "Strong" | "Moderate" | "Very Weak" | "Weak" = "Very Weak";
        if (absVal > 0.6) strength = "Strong";
        else if (absVal > 0.3) strength = "Moderate";
        else strength = "Weak";
        
        let direction: any = "None / Direct Correlation";
        if (val > 0.5) direction = "Strong Positive";
        else if (val > 0) direction = "Positive";
        else if (val < -0.5) direction = "Strong Negative";
        else if (val < 0) direction = "Negative";
        
        high_correlations.push({
          feature_a: c1,
          feature_b: c2,
          coefficient: val,
          strength,
          direction
        });
      }
    });
  });
  
  high_correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));

  // 1. Calculate Numerical Summary (The Hard Numbers, including skewness and kurtosis)
  const numerical_summary: DescribeRow[] = [];
  numericCols.forEach(col => {
    const vals: number[] = [];
    data.forEach(r => {
      const v = Number(r[col]);
      if (!isNaN(v) && r[col] !== null && r[col] !== undefined) {
        vals.push(v);
      }
    });

    const count = vals.length;
    if (count === 0) {
      numerical_summary.push({
        col,
        count: 0,
        mean: 0,
        std: 0,
        min: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        max: 0,
        skewness: 0,
        kurtosis: 0
      });
      return;
    }

    const sorted = [...vals].sort((a, b) => a - b);
    const sum = vals.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    let varSum = 0;
    let skew3Sum = 0;
    let kurt4Sum = 0;

    vals.forEach(v => {
      const diff = v - mean;
      varSum += diff * diff;
      skew3Sum += diff * diff * diff;
      kurt4Sum += diff * diff * diff * diff;
    });

    const m2 = varSum / count;
    const m3 = skew3Sum / count;
    const m4 = kurt4Sum / count;

    const std = count > 1 ? Math.sqrt(varSum / (count - 1)) : 0;
    
    // Skewness
    const skewness = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
    
    // Kurtosis (excess)
    const kurtosis = m2 > 0 ? (m4 / Math.pow(m2, 2)) - 3 : 0;

    const getPercentile = (p: number) => {
      const pos = (sorted.length - 1) * p;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
      }
      return sorted[base];
    };

    numerical_summary.push({
      col,
      count,
      mean: Number(mean.toFixed(4)),
      std: Number(std.toFixed(4)),
      min: Number(sorted[0].toFixed(4)),
      p25: Number(getPercentile(0.25).toFixed(4)),
      p50: Number(getPercentile(0.5).toFixed(4)),
      p75: Number(getPercentile(0.75).toFixed(4)),
      max: Number(sorted[sorted.length - 1].toFixed(4)),
      skewness: Number(skewness.toFixed(4)),
      kurtosis: Number(kurtosis.toFixed(4))
    });
  });

  // Build automatic narrative insights
  const insights: string[] = [];
  const summary_insights: string[] = [];
  const distribution_insights: string[] = [];
  const relationship_insights: string[] = [];

  // --- POPULATE SUMMARY INSIGHTS ---
  summary_insights.push(`Modul 3 memverifikasi total ${data.length} baris data transaksi yang dibersihkan untuk pemetaan bisnis.`);
  numerical_summary.forEach(row => {
    const formattedCol = row.col.replace(/_/g, " ");
    summary_insights.push(`Rata-rata & Rentang '${formattedCol}': Rata-rata sebesar ${row.mean.toFixed(2)}, sebaran dari ${row.min.toFixed(2)} hingga ${row.max.toFixed(2)} (Standard Deviasi: ${row.std.toFixed(2)}).`);
  });

  // Group top values for categoricals
  categoricCols.forEach(cat => {
    const counts: Record<string, number> = {};
    data.forEach(r => {
      const v = String(r[cat] ?? "Unknown");
      counts[v] = (counts[v] || 0) + 1;
    });
    
    let maxK = "";
    let maxV = 0;
    Object.entries(counts).forEach(([k, val]) => {
      if (val > maxV) {
        maxV = val;
        maxK = k;
      }
    });
    
    if (maxK && data.length > 0) {
      const pct = ((maxV / data.length) * 100).toFixed(1);
      summary_insights.push(`Kelompok Dominan: Kolom '${cat.replace(/_/g, " ")}' paling banyak memiliki entri '${maxK}' (${pct}% sebaran).`);
    }
  });

  // --- POPULATE DISTRIBUTION INSIGHTS ---
  numerical_summary.forEach(row => {
    const formattedCol = row.col.replace(/_/g, " ");
    const absSkew = Math.abs(row.skewness);
    
    let skewText = "Simetris";
    let skewDetail = "terdistribusi seimbang mendekati normal";
    if (absSkew > 1.0) {
      skewText = row.skewness > 0 ? "Highly Right-Skewed" : "Highly Left-Skewed";
      skewDetail = row.skewness > 0 ? "ekor panjang condong ke kanan (banyak nilai kecil)" : "ekor panjang condong ke kiri";
    } else if (absSkew > 0.5) {
      skewText = row.skewness > 0 ? "Moderate Right-Skew" : "Moderate Left-Skew";
      skewDetail = "berat sebelah derajat sedang";
    }

    let kurtText = "Mesokurtik (Normal)";
    let kurtDetail = "kelengkungan normal";
    if (row.kurtosis > 0.8) {
      kurtText = "Leptokurtik (Ekor Tinggi)";
      kurtDetail = "memiliki puncak runcing & rentan fluktuasi nilai ekstrim";
    } else if (row.kurtosis < -0.8) {
      kurtText = "Platikurtik (Ekor Rata)";
      kurtDetail = "memiliki puncak mendatar dengan sebaran lebih rata";
    }

    distribution_insights.push(`Bentuk Kemiringan '${formattedCol}': Skewness adalah ${row.skewness > 0 ? `+${row.skewness.toFixed(3)}` : row.skewness.toFixed(3)} (${skewText}), menunjukkan data ${skewDetail}.`);
    distribution_insights.push(`Keruncingan '${formattedCol}': Kurtosis adalah ${row.kurtosis > 0 ? `+${row.kurtosis.toFixed(3)}` : row.kurtosis.toFixed(3)} (${kurtText}), mencerminkan ${kurtDetail}.`);
  });

  // --- POPULATE RELATIONSHIP INSIGHTS ---
  if (high_correlations.length > 0) {
    const strongest = high_correlations[0];
    const dirType = strongest.coefficient > 0 ? "positif (searah)" : "negatif (berlawanan)";
    relationship_insights.push(`Relasi Terkuat: Kolom '${strongest.feature_a.replace(/_/g, " ")}' berkorelasi dengan '${strongest.feature_b.replace(/_/g, " ")}' sebesar ${strongest.coefficient.toFixed(3)} (${dirType}).`);
  } else {
    relationship_insights.push("Relasi Linier: Tidak ditemukan korelasi linier yang solid di atas ambang batas 0.15 antar variabel numerik.");
  }

  // Multi-column insights rules
  if (numericCols.includes("visit_duration") && numericCols.includes("purchase_amount")) {
    const vc = correlation_matrix["visit_duration"]?.["purchase_amount"] ?? 0.0;
    if (Math.abs(vc) > 0.25) {
      relationship_insights.push(`Asosiasi Belanja: Hubungan 'Visit Duration' dan 'Purchase Amount' memiliki r = ${vc.toFixed(3)}. Durasi kunjungan berpotensi memicu tingkat belanja lebih tinggi.`);
    } else {
      relationship_insights.push(`Asosiasi Belanja: Hubungan durasi kunjungan dengan seberapa banyak belanja bernilai rendah (r = ${vc.toFixed(2)}). Menunjukkan pembelian yang cepat/efisien.`);
    }
  }

  if (high_correlations.length > 1) {
    const backup = high_correlations[1];
    relationship_insights.push(`Relasi Tambahan: Asosiasi sekunder antara '${backup.feature_a.replace(/_/g, " ")}' dan '${backup.feature_b.replace(/_/g, " ")}' bernilai r = ${backup.coefficient.toFixed(3)}.`);
  }

  // Populate fallback single insights array with highlights
  insights.push(`Modul 3 memverifikasi total ${data.length} baris data transaksi.`);
  if (high_correlations.length > 0) {
    insights.push(`Relasi Terkuat: '${high_correlations[0].feature_a.replace(/_/g, " ")}' vs '${high_correlations[0].feature_b.replace(/_/g, " ")}' r = ${high_correlations[0].coefficient.toFixed(2)}.`);
  }

  return {
    correlation_matrix,
    high_correlations,
    insights,
    numerical_summary,
    summary_insights,
    distribution_insights,
    relationship_insights
  };
}

/**
 * Formats a value as it is, with simple decimal parsing
 */
export function formatExcelValue(
  val: any,
  _formatType?: any
): string {
  if (val === null || val === undefined) return "NaN";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  if (Number.isInteger(num)) {
    return String(num);
  }
  return Number(num.toFixed(4)).toString();
}

