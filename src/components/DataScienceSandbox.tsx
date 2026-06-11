import React, { useState } from "react";
import { DataRecord } from "../types";

interface DataScienceSandboxProps {
  rawData: DataRecord[];
  engineeredData: DataRecord[] | null;
  ingestedData: DataRecord[] | null;
  schema: Record<string, "datetime" | "float" | "int" | "category">;
  deletedColumns: string[];
}

export function DataScienceSandbox({
  rawData,
  engineeredData,
  ingestedData,
  schema,
  deletedColumns,
}: DataScienceSandboxProps) {
  const dsData = engineeredData || ingestedData || rawData || [];
  
  // Filter schema to active columns
  const activeSchema = Object.fromEntries(
    Object.entries(schema).filter(([col]) => !deletedColumns.includes(col))
  ) as Record<string, "datetime" | "float" | "int" | "category">;
  
  const activeCols = Object.keys(activeSchema);
  const numericCols = activeCols.filter(col => activeSchema[col] === "float" || activeSchema[col] === "int");

  // State variables backends
  const [dsSelectedX, setDsSelectedX] = useState<string>("visit_duration");
  const [dsSelectedY, setDsSelectedY] = useState<string>("purchase_amount");
  const [dsSelectedZ, setDsSelectedZ] = useState<string>("category");
  const [dsTaskType, setDsTaskType] = useState<"classification" | "regression" | "clustering" | "anomaly">("regression");
  const [dsPredictionX, setDsPredictionX] = useState<number>(15);
  const [dsPredictionY, setDsPredictionY] = useState<number>(150);

  // Advanced task states
  const [kClusters, setKClusters] = useState<number>(3);
  const [contaminationRate, setContaminationRate] = useState<number>(10);

  // Fallbacks for empty column situations
  const xCol = numericCols.includes(dsSelectedX) ? dsSelectedX : (numericCols[1] || numericCols[0] || "");
  const yCol = numericCols.includes(dsSelectedY) ? dsSelectedY : (numericCols[0] || "");
  const zCol = activeCols.includes(dsSelectedZ) ? dsSelectedZ : (activeCols.find(c => activeSchema[c] === "category") || activeCols[0] || "");

  // Filter valid coordinates pairs
  const validPoints = dsData.map(row => {
    const xVal = Number(row[xCol]);
    const yVal = Number(row[yCol]);
    const zVal = row[zCol] !== undefined && row[zCol] !== null ? String(row[zCol]) : "Unknown";
    return { x: xVal, y: yVal, z: zVal };
  }).filter(p => !isNaN(p.x) && !isNaN(p.y));

  // Determine global bounds with elegant padding buffer
  const xValues = validPoints.map(p => p.x);
  const yValues = validPoints.map(p => p.y);
  
  const rawMinX = xValues.length > 0 ? Math.min(...xValues) : 0;
  const rawMaxX = xValues.length > 0 ? Math.max(...xValues) : 100;
  const rawMinY = yValues.length > 0 ? Math.min(...yValues) : 0;
  const rawMaxY = yValues.length > 0 ? Math.max(...yValues) : 100;

  const dx = rawMaxX - rawMinX || 1;
  const dy = rawMaxY - rawMinY || 1;

  // 10% buffer padding
  const minX = rawMinX >= 0 ? Math.max(0, rawMinX - dx * 0.1) : rawMinX - dx * 0.1;
  const maxX = rawMaxX + dx * 0.1;
  const minY = rawMinY >= 0 ? Math.max(0, rawMinY - dy * 0.1) : rawMinY - dy * 0.1;
  const maxY = rawMaxY + dy * 0.1;

  // Set safe inputs
  const validXPred = Math.max(minX, Math.min(maxX, dsPredictionX));
  const validYPred = Math.max(minY, Math.min(maxY, dsPredictionY));

  // ==================== SUPERVISED MODEL 1: REGRESSION ML SOLVER ====================
  let regSlope = 0;
  let regIntercept = 0;
  let regR2 = 0;
  let regPearson = 0;
  let regMSE = 0;

  if (validPoints.length > 1) {
    const n = validPoints.length;
    const sumX = validPoints.reduce((sum, p) => sum + p.x, 0);
    const sumY = validPoints.reduce((sum, p) => sum + p.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    let numSlope = 0;
    let denSlope = 0;
    validPoints.forEach(p => {
      numSlope += (p.x - meanX) * (p.y - meanY);
      denSlope += (p.x - meanX) * (p.x - meanX);
    });

    regSlope = denSlope !== 0 ? numSlope / denSlope : 0;
    regIntercept = meanY - regSlope * meanX;

    let ssTot = 0;
    let ssRes = 0;
    validPoints.forEach(p => {
      const predY = regSlope * p.x + regIntercept;
      ssTot += Math.pow(p.y - meanY, 2);
      ssRes += Math.pow(p.y - predY, 2);
    });

    regR2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
    regMSE = ssRes / n;
    
    let numR = 0;
    let denR1 = 0;
    let denR2 = 0;
    validPoints.forEach(p => {
      const dX = p.x - meanX;
      const dY = p.y - meanY;
      numR += dX * dY;
      denR1 += dX * dX;
      denR2 += dY * dY;
    });
    const denom = Math.sqrt(denR1 * denR2);
    regPearson = denom !== 0 ? numR / denom : 0;
  }

  // ==================== SUPERVISED MODEL 2: k-NN CLASSIFIER SOLVER ====================
  let knnMetrics = { accuracy: 0, precision: 0, recall: 0, f1: 0, classesList: [] as string[] };
  const classes = Array.from(new Set(validPoints.map(p => p.z))).sort();

  if (validPoints.length >= 5 && classes.length >= 2) {
    const trainSet = validPoints.filter((_, idx) => idx % 10 < 7);
    const testSet = validPoints.filter((_, idx) => idx % 10 >= 7);

    if (trainSet.length > 0 && testSet.length > 0) {
      let correctCount = 0;
      const tpMap: Record<string, number> = {};
      const fpMap: Record<string, number> = {};
      const fnMap: Record<string, number> = {};
      classes.forEach(c => {
        tpMap[c] = 0;
        fpMap[c] = 0;
        fnMap[c] = 0;
      });

      const kParam = Math.min(5, trainSet.length);

      testSet.forEach(testPt => {
        const distances = trainSet.map(trainPt => {
          const normXTrain = (trainPt.x - minX) / ((maxX - minX) || 1);
          const normYTrain = (trainPt.y - minY) / ((maxY - minY) || 1);
          const normXTest = (testPt.x - minX) / ((maxX - minX) || 1);
          const normYTest = (testPt.y - minY) / ((maxY - minY) || 1);

          const dist = Math.sqrt(Math.pow(normXTrain - normXTest, 2) + Math.pow(normYTrain - normYTest, 2));
          return { dist, z: trainPt.z };
        });

        distances.sort((a, b) => a.dist - b.dist);
        const votes: Record<string, number> = {};
        const selectK = distances.slice(0, kParam);
        selectK.forEach(neighbor => {
          votes[neighbor.z] = (votes[neighbor.z] || 0) + 1;
        });

        let winnerLabel = selectK[0]?.z || "Unknown";
        let maxVotes = 0;
        Object.entries(votes).forEach(([lbl, count]) => {
          if (count > maxVotes) {
            maxVotes = count;
            winnerLabel = lbl;
          }
        });

        const actual = testPt.z;
        const pred = winnerLabel;

        if (actual === pred) {
          correctCount++;
          tpMap[actual] = (tpMap[actual] || 0) + 1;
        } else {
          fpMap[pred] = (fpMap[pred] || 0) + 1;
          fnMap[actual] = (fnMap[actual] || 0) + 1;
        }
      });

      const totalTest = testSet.length;
      const accuracy = correctCount / totalTest;

      let sumPrecision = 0;
      let sumRecall = 0;
      let validClassesCount = 0;

      classes.forEach(c => {
        const tp = tpMap[c] || 0;
        const fp = fpMap[c] || 0;
        const fn = fnMap[c] || 0;

        const p = tp + fp > 0 ? tp / (tp + fp) : 0;
        const r = tp + fn > 0 ? tp / (tp + fn) : 0;
        
        sumPrecision += p;
        sumRecall += r;
        if (tp + fp > 0 || tp + fn > 0) {
          validClassesCount++;
        }
      });

      const macroPrecision = validClassesCount > 0 ? sumPrecision / validClassesCount : 0;
      const macroRecall = validClassesCount > 0 ? sumRecall / validClassesCount : 0;
      const macroF1 = macroPrecision + macroRecall > 0 ? 2 * (macroPrecision * macroRecall) / (macroPrecision + macroRecall) : 0;

      knnMetrics = {
        accuracy: accuracy * 100,
        precision: macroPrecision * 100,
        recall: macroRecall * 100,
        f1: macroF1 * 100,
        classesList: classes
      };
    }
  }

  // ==================== UNSUPERVISED MODEL 3: K-MEANS CLUSTERING SOLVER ====================
  interface KCentroid {
    xNorm: number;
    yNorm: number;
  }
  let kmeansResult = { 
    points: [] as { x: number; y: number; cluster: number; z: string }[], 
    centroids: [] as { x: number; y: number; id: number }[], 
    inertia: 0, 
    shadowSilhouette: 0 
  };

  if (dsTaskType === "clustering" && validPoints.length > 0) {
    const K = Math.max(2, Math.min(6, kClusters));
    
    // Normalize coordinates to [0, 1] for clustering
    const normPts = validPoints.map(p => ({
      xNorm: (p.x - minX) / ((maxX - minX) || 1),
      yNorm: (p.y - minY) / ((maxY - minY) || 1),
      orig: p
    }));

    // Space centroids along the diagonal to ensure convergent diversity
    let cents: KCentroid[] = Array.from({ length: K }, (_, idx) => {
      const ratio = (idx + 1) / (K + 1);
      return { xNorm: ratio, yNorm: ratio };
    });

    let assignments = new Array(normPts.length).fill(0);
    let iter = 0;

    while (iter < 15) {
      iter++;

      // 1. Assign points to nearest centroid
      const nextAssignments = normPts.map(pt => {
        let minDist = Infinity;
        let bestCentIdx = 0;
        cents.forEach((cent, centIdx) => {
          const d = Math.pow(pt.xNorm - cent.xNorm, 2) + Math.pow(pt.yNorm - cent.yNorm, 2);
          if (d < minDist) {
            minDist = d;
            bestCentIdx = centIdx;
          }
        });
        return bestCentIdx;
      });

      // Check if assignments changed
      let diff = false;
      for (let i = 0; i < assignments.length; i++) {
        if (nextAssignments[i] !== assignments[i]) {
          diff = true;
          break;
        }
      }
      if (!diff && iter > 1) break;
      assignments = nextAssignments;

      // 2. Recompute centroids
      const nextCents = cents.map((cent, centIdx) => {
        const assignedPts = normPts.filter((_, ptIdx) => assignments[ptIdx] === centIdx);
        if (assignedPts.length === 0) return cent;
        
        const totalX = assignedPts.reduce((acc, pt) => acc + pt.xNorm, 0);
        const totalY = assignedPts.reduce((acc, pt) => acc + pt.yNorm, 0);
        return {
          xNorm: totalX / assignedPts.length,
          yNorm: totalY / assignedPts.length
        };
      });

      // Calculate shift to check convergence
      let shift = 0;
      for (let idx = 0; idx < cents.length; idx++) {
        shift += Math.sqrt(Math.pow(cents[idx].xNorm - nextCents[idx].xNorm, 2) + Math.pow(cents[idx].yNorm - nextCents[idx].yNorm, 2));
      }
      cents = nextCents;
      if (shift < 0.001) break;
    }

    // Denormalize centroids back to standard scale
    const deNormCents = cents.map((cent, idx) => ({
      x: minX + cent.xNorm * (maxX - minX),
      y: minY + cent.yNorm * (maxY - minY),
      id: idx
    }));

    // Calculate within-cluster error (Inertia SSE)
    let totalInertia = 0;
    normPts.forEach((pt, idx) => {
      const cent = cents[assignments[idx]];
      const dSq = Math.pow(pt.xNorm - cent.xNorm, 2) + Math.pow(pt.yNorm - cent.yNorm, 2);
      totalInertia += dSq;
    });

    // Approximate Silhouette Quality Coefficient
    let totalSilRatio = 0;
    normPts.forEach((pt, ptIdx) => {
      const ownIdx = assignments[ptIdx];
      const ownCent = cents[ownIdx];
      const a_i = Math.sqrt(Math.pow(pt.xNorm - ownCent.xNorm, 2) + Math.pow(pt.yNorm - ownCent.yNorm, 2));

      let minOuterDist = Infinity;
      cents.forEach((cent, idx) => {
        if (idx !== ownIdx) {
          const d = Math.sqrt(Math.pow(pt.xNorm - cent.xNorm, 2) + Math.pow(pt.yNorm - cent.yNorm, 2));
          if (d < minOuterDist) minOuterDist = d;
        }
      });
      
      const s_i = (minOuterDist > a_i) ? (minOuterDist - a_i) / Math.max(minOuterDist, a_i) : 0;
      totalSilRatio += s_i;
    });
    const avgSilhouette = normPts.length > 0 ? totalSilRatio / normPts.length : 0;

    kmeansResult = {
      points: validPoints.map((p, idx) => ({
        x: p.x,
        y: p.y,
        cluster: assignments[idx],
        z: `Cluster ${assignments[idx] + 1}`
      })),
      centroids: deNormCents,
      inertia: totalInertia,
      shadowSilhouette: avgSilhouette
    };
  }

  // ==================== UNSUPERVISED MODEL 4: ANOMALY & OUTLIER DETECTION SOLVER ====================
  let anomalyResult = { 
    points: [] as { x: number; y: number; isAnomaly: boolean; score: number; z: string }[], 
    anomalyCount: 0, 
    thresholdScore: 0 
  };
  
  if (dsTaskType === "anomaly" && validPoints.length > 0) {
    // Score based on local density (average distance to 3-nearest neighbors)
    const scoreList = validPoints.map((p, idx) => {
      const dists = validPoints.map((other, oIdx) => {
        if (idx === oIdx) return Infinity;
        const nX1 = (p.x - minX) / ((maxX - minX) || 1);
        const nY1 = (p.y - minY) / ((maxY - minY) || 1);
        const nX2 = (other.x - minX) / ((maxX - minX) || 1);
        const nY2 = (other.y - minY) / ((maxY - minY) || 1);
        return Math.sqrt(Math.pow(nX1 - nX2, 2) + Math.pow(nY1 - nY2, 2));
      });
      dists.sort((a, b) => a - b);
      const neighborsK = Math.min(3, dists.length - 1);
      const sub = dists.slice(0, neighborsK);
      const avgD = sub.length > 0 ? sub.reduce((acc, val) => acc + val, 0) / sub.length : 0;
      return { index: idx, score: avgD, point: p };
    });

    const sortedScores = [...scoreList].sort((a, b) => b.score - a.score);
    const count = validPoints.length;
    const anomalyLimitIndex = Math.max(1, Math.ceil((contaminationRate / 100) * count));
    const topAnomsIndices = new Set(sortedScores.slice(0, anomalyLimitIndex).map(s => s.index));
    const thresholdVal = sortedScores[anomalyLimitIndex - 1]?.score || 0;

    anomalyResult = {
      points: validPoints.map((p, idx) => ({
        x: p.x,
        y: p.y,
        isAnomaly: topAnomsIndices.has(idx),
        score: scoreList[idx].score,
        z: topAnomsIndices.has(idx) ? "Outlier" : "Inlier"
      })),
      anomalyCount: topAnomsIndices.size,
      thresholdScore: thresholdVal
    };
  }

  // ==================== LIVE PREDICTION INTERSECT COUPLING ====================
  const normXQ = (validXPred - minX) / ((maxX - minX) || 1);
  const normYQ = (validYPred - minY) / ((maxY - minY) || 1);

  // Supervised label predict
  let predictedClass = "N/A";
  if (validPoints.length > 0 && classes.length >= 2) {
    const distances = validPoints.map(p => {
      const normPtX = (p.x - minX) / ((maxX - minX) || 1);
      const normPtY = (p.y - minY) / ((maxY - minY) || 1);
      return {
        dist: Math.sqrt(Math.pow(normPtX - normXQ, 2) + Math.pow(normPtY - normYQ, 2)),
        z: p.z
      };
    });
    distances.sort((a, b) => a.dist - b.dist);
    const k = Math.min(5, validPoints.length);
    const selectK = distances.slice(0, k);
    const votes: Record<string, number> = {};
    selectK.forEach(item => {
      votes[item.z] = (votes[item.z] || 0) + 1;
    });
    let winner = selectK[0]?.z || "Unknown";
    let maxV = 0;
    Object.entries(votes).forEach(([lbl, count]) => {
      if (count > maxV) {
        maxV = count;
        winner = lbl;
      }
    });
    predictedClass = winner;
  }

  // Regression Y pred
  const regPredictionY = regSlope * validXPred + regIntercept;

  // Unsupervised cluster assign predict
  let predictedCluster = "N/A";
  if (dsTaskType === "clustering" && kmeansResult.centroids.length > 0) {
    let minDist = Infinity;
    let closestClust = 0;
    kmeansResult.centroids.forEach((cent, idx) => {
      const d = Math.pow(validXPred - cent.x, 2) + Math.pow(validYPred - cent.y, 2);
      if (d < minDist) {
        minDist = d;
        closestClust = idx;
      }
    });
    predictedCluster = `Cluster ${closestClust + 1}`;
  }

  // Unsupervised density anomaly predict
  let predictedAnomStatus = "Inlier (Symmetrical/Dense)";
  if (dsTaskType === "anomaly" && validPoints.length > 0) {
    const dists = validPoints.map((pt) => {
      const nX1 = (validXPred - minX) / ((maxX - minX) || 1);
      const nY1 = (validYPred - minY) / ((maxY - minY) || 1);
      const nX2 = (pt.x - minX) / ((maxX - minX) || 1);
      const nY2 = (pt.y - minY) / ((maxY - minY) || 1);
      return Math.sqrt(Math.pow(nX1 - nX2, 2) + Math.pow(nY1 - nY2, 2));
    });
    dists.sort((a, b) => a - b);
    const neighborsK = Math.min(3, dists.length);
    const sub = dists.slice(0, neighborsK);
    const queryScore = sub.reduce((acc, v) => acc + v, 0) / (sub.length || 1);
    
    if (queryScore > anomalyResult.thresholdScore) {
      predictedAnomStatus = "Outlier (Isolated Region)";
    } else {
      predictedAnomStatus = "Inlier (Dense Cluster)";
    }
  }

  // ==================== CLASSIFIER BOUNDARY BACKGROUND GRID ====================
  const bgDots: { x: number; y: number; predictedClass: string }[] = [];
  if (dsTaskType === "classification" && validPoints.length >= 5 && classes.length >= 2) {
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const px = minX + (i / steps) * (maxX - minX);
      for (let j = 0; j <= steps; j++) {
        const py = minY + (j / steps) * (maxY - minY);
        
        const normPtX = (px - minX) / ((maxX - minX) || 1);
        const normPtY = (py - minY) / ((maxY - minY) || 1);
        
        const distances = validPoints.map(p => {
          const normX = (p.x - minX) / ((maxX - minX) || 1);
          const normY = (p.y - minY) / ((maxY - minY) || 1);
          return {
            dist: Math.sqrt(Math.pow(normX - normPtX, 2) + Math.pow(normY - normPtY, 2)),
            z: p.z
          };
        });
        distances.sort((a, b) => a.dist - b.dist);
        const k = Math.min(5, validPoints.length);
        const selectK = distances.slice(0, k);
        
        const votes: Record<string, number> = {};
        selectK.forEach(item => {
          votes[item.z] = (votes[item.z] || 0) + 1;
        });
        let winner = selectK[0]?.z || "Unknown";
        let maxV = 0;
        Object.entries(votes).forEach(([lbl, count]) => {
          if (count > maxV) {
            maxV = count;
            winner = lbl;
          }
        });
        
        bgDots.push({ x: px, y: py, predictedClass: winner });
      }
    }
  }

  // Color mappings helper
  const getClassColor = (cName: string, isLight = false) => {
    const colors = [
      { fill: "#1D4ED8", hexLight: "#DBEAFE" }, // blue
      { fill: "#B45309", hexLight: "#FEF3C7" }, // amber
      { fill: "#15803D", hexLight: "#D1FAE5" }, // emerald
      { fill: "#A21CAF", hexLight: "#FDF4FF" }, // fuchsia
      { fill: "#BE123C", hexLight: "#FFE4E6" }, // rose
      { fill: "#0369A1", hexLight: "#E0F2FE" }, // sky
      { fill: "#6D28D9", hexLight: "#EDE9FE" }, // violet
      { fill: "#C2410C", hexLight: "#FFEDD5" }, // orange
    ];
    const charSum = cName.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const picked = colors[charSum % colors.length];
    return isLight ? picked.hexLight : picked.fill;
  };

  const getClassTailwind = (cName: string) => {
    const charSum = cName.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const twStyles = [
      { bg: "bg-blue-50 text-blue-700 border-blue-200/50", dot: "bg-blue-500" },
      { bg: "bg-amber-50 text-amber-700 border-amber-200/50", dot: "bg-amber-500" },
      { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/50", dot: "bg-emerald-505" },
      { bg: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/50", dot: "bg-fuchsia-500" },
      { bg: "bg-rose-50 text-rose-700 border-rose-200/50", dot: "bg-rose-500" },
      { bg: "bg-sky-50 text-sky-700 border-sky-200/50", dot: "bg-sky-500" },
      { bg: "bg-violet-50 text-violet-700 border-violet-200/50", dot: "bg-violet-500" },
      { bg: "bg-orange-50 text-orange-700 border-orange-200/50", dot: "bg-orange-500" },
    ];
    return twStyles[charSum % twStyles.length];
  };

  const getSvgCoords = (xValCoord: number, yValCoord: number) => {
    const paddingLeft = 55;
    const paddingRight = 30;
    const paddingTop = 25;
    const paddingBottom = 45;
    
    const widthVal = 500;
    const heightVal = 320;
    
    const plotX = paddingLeft + ((xValCoord - minX) / (maxX - minX || 1)) * (widthVal - paddingLeft - paddingRight);
    const plotY = heightVal - paddingBottom - ((yValCoord - minY) / (maxY - minY || 1)) * (heightVal - paddingTop - paddingBottom);
    
    return { cx: plotX, cy: plotY };
  };

  const handleSvgClick = (evt: React.MouseEvent<SVGSVGElement>) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const clickX = evt.clientX - rect.left;
    const clickY = evt.clientY - rect.top;
    
    const paddingLeft = 55;
    const paddingRight = 30;
    const paddingTop = 25;
    const paddingBottom = 45;
    
    const widthVal = rect.width;
    const heightVal = rect.height;
    
    const relativeX = (clickX - (paddingLeft / 500) * widthVal) / (((500 - paddingLeft - paddingRight) / 500) * widthVal);
    const relativeY = 1.0 - (clickY - (paddingTop / 320) * heightVal) / (((320 - paddingTop - paddingBottom) / 320) * heightVal);
    
    if (relativeX >= 0 && relativeX <= 1 && relativeY >= 0 && relativeY <= 1) {
      const targetX = minX + relativeX * (maxX - minX);
      const targetY = minY + relativeY * (maxY - minY);
      
      setDsPredictionX(Number(targetX.toFixed(2)));
      setDsPredictionY(Number(targetY.toFixed(2)));
    }
  };

  // Build classes list strictly depending on task
  const classesToRender = 
    dsTaskType === "clustering" 
      ? Array.from({ length: kClusters }, (_, idx) => `Cluster ${idx + 1}`) 
      : dsTaskType === "anomaly" 
        ? ["Inlier", "Outlier"] 
        : classes;

  return (
    <section className="bg-white border border-[#E2E8F0] p-5 rounded-lg shadow-2xs space-y-5">
      <div className="flex items-center gap-2.5 border-b border-gray-150 pb-3">
        <div>
          <span className="text-3xs font-extrabold text-[#107C41] uppercase tracking-wider font-mono">MODULE 4: PREDICTIVE MACHINE LEARNING & SANDBOX</span>
          <h3 className="text-sm font-bold text-gray-800">Visual Machine Learning Solver & Multi-algorithmic Sandbox</h3>
        </div>
      </div>

      {/* Prominent paradigm selection block at the very top (Pilihan di Bagian Awal) */}
      <div className="space-y-2">
        <span className="text-[9px] font-bold text-gray-450 uppercase tracking-widest font-mono block">
          1. SELECT MACHINE LEARNING PIPELINE PARADIGM (MODEL PARADIGM)
        </span>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          {[
            { type: "regression", title: "Regression Models", desc: "Linear numerical correlation. Quantifies continuous trend relationships." },
            { type: "classification", title: "k-NN Identification", desc: "Supervised categorization. Defines localized classification margins." },
            { type: "clustering", title: "K-Means Clustering", desc: "Unsupervised grouping. Detects proximity-based structural clusters." },
            { type: "anomaly", title: "Anomaly & Outliers", desc: "Density evaluation. Flags isolated outliers with isolation distances." }
          ].map((opt) => {
            const isActive = dsTaskType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => setDsTaskType(opt.type as any)}
                className={`p-3 text-left rounded-lg transition-all cursor-pointer border select-none ${
                  isActive 
                    ? "bg-[#107C41] text-white border-[#107C41] ring-1 ring-[#107C41] shadow-xs scale-[1.008]" 
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50/80 hover:border-gray-300"
                }`}
              >
                <div className="text-[11px] font-black tracking-tight leading-none mb-1">
                  {opt.title}
                </div>
                <span className={`text-[9px] line-clamp-2 leading-relaxed block ${isActive ? "text-emerald-100" : "text-gray-400"}`}>
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        
        {/* Arena Configuration block parameters */}
        <div className="bg-[#FAFBFD] p-3.5 rounded-lg border border-gray-200 shadow-3xs">
          <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-wider mb-2.5">
            2. ARENA CONFIGURATION (DIMENSIONAL ATTRIBUTES INPUTS)
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[8px] font-black text-gray-500 uppercase block mb-1 font-mono">X-Axis Coordinate Feature</label>
              <select
                value={dsSelectedX}
                onChange={(e) => setDsSelectedX(e.target.value)}
                className="w-full text-xs font-semibold px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-[#107C41] focus:border-[#107C41] bg-white text-gray-800 font-mono capitalize"
              >
                {numericCols.map(col => (
                  <option key={col} value={col}>{col.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[8px] font-black text-gray-500 uppercase block mb-1 font-mono">Y-Axis Coordinate Feature</label>
              <select
                value={dsSelectedY}
                onChange={(e) => setDsSelectedY(e.target.value)}
                className="w-full text-xs font-semibold px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-[#107C41] focus:border-[#107C41] bg-white text-gray-800 font-mono capitalize"
              >
                {numericCols.map(col => (
                  <option key={col} value={col}>{col.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            {/* Z label selection OR Unsupervised parameters options */}
            {(dsTaskType === "regression" || dsTaskType === "classification") ? (
              <div>
                <label className="text-[8px] font-black text-gray-500 uppercase block mb-1 font-mono">Z classification target label</label>
                <select
                  value={dsSelectedZ}
                  onChange={(e) => setDsSelectedZ(e.target.value)}
                  className="w-full text-xs font-semibold px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-[#107C41] focus:border-[#107C41] bg-white text-gray-800 font-mono capitalize"
                >
                  {activeCols.map(col => (
                    <option key={col} value={col}>{col.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            ) : dsTaskType === "clustering" ? (
              <div>
                <label className="text-[8.5px] font-bold text-[#107C41] uppercase block mb-1 font-mono">
                  <span>K-Means Clusters Count (K)</span>
                </label>
                <select
                  value={kClusters}
                  onChange={(e) => setKClusters(Number(e.target.value))}
                  className="w-full text-xs font-bold px-2 py-1.5 border border-[#107C41]/30 bg-[#107C41]/5 text-[#107C41] rounded focus:ring-1 focus:ring-[#107C41] outline-none font-mono"
                >
                  {[2, 3, 4, 5, 6].map(val => (
                    <option key={val} value={val}>{val} Clusters (K={val})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-[8.5px] font-bold text-rose-750 uppercase block mb-1 font-mono">
                  <span>Outlier Contamination Rate (%)</span>
                </label>
                <select
                  value={contaminationRate}
                  onChange={(e) => setContaminationRate(Number(e.target.value))}
                  className="w-full text-xs font-bold px-2 py-1.5 border border-rose-300 bg-rose-500/5 text-rose-750 rounded focus:ring-1 focus:ring-rose-500 outline-none font-mono"
                >
                  {[2, 5, 8, 10, 15, 20, 25].map(val => (
                    <option key={val} value={val}>{val}% Contamination sensitivity</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Model Statistics Display */}
        <div className="bg-slate-900 border border-slate-950 p-3 rounded-lg text-white font-mono space-y-2 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[8px] text-emerald-400 uppercase tracking-widest font-black flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
              Interactive Local Solver Statistics Dashboard
            </span>
            <span className="text-[8.5px] text-gray-400 font-bold">
              {validPoints.length} Validated Samples Available
            </span>
          </div>

          {dsTaskType === "regression" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">R² Determination</span>
                <span className="text-emerald-400 font-black text-sm">{regR2.toFixed(4)}</span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Pearson Correl (r)</span>
                <span className="text-[#F59E0B] font-black text-sm">{regPearson > 0 ? `+${regPearson.toFixed(3)}` : regPearson.toFixed(3)}</span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">MSE Residuals</span>
                <span className="text-rose-400 font-black text-sm">{regMSE.toFixed(1)}</span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Least-Squares Line</span>
                <span className="text-blue-300 font-black text-[10px] truncate block" title={`y = ${regSlope.toFixed(2)}x + ${regIntercept.toFixed(1)}`}>
                  y = {regSlope.toFixed(2)}x + {regIntercept.toFixed(1)}
                </span>
              </div>
            </div>
          ) : dsTaskType === "classification" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Classification Acc.</span>
                <span className="text-emerald-400 font-black text-sm">
                  {knnMetrics.accuracy > 0 ? `${knnMetrics.accuracy.toFixed(1)}%` : "N/A (Needs multi-groups)"}
                </span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black font-black">Macro Precision</span>
                <span className="text-[#F59E0B] font-black text-sm">
                  {knnMetrics.precision > 0 ? `${knnMetrics.precision.toFixed(1)}%` : "N/A"}
                </span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Macro Recall</span>
                <span className="text-rose-400 font-black text-sm">
                  {knnMetrics.recall > 0 ? `${knnMetrics.recall.toFixed(1)}%` : "N/A"}
                </span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Macro F1 Score</span>
                <span className="text-blue-300 font-black text-sm">
                  {knnMetrics.f1 > 0 ? `${knnMetrics.f1.toFixed(1)}%` : "N/A"}
                </span>
              </div>
            </div>
          ) : dsTaskType === "clustering" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Intra Residual Inertia (SSE)</span>
                <span className="text-emerald-400 font-black text-sm">{kmeansResult.inertia.toFixed(4)}</span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Silhouette Quality Ratio</span>
                <span className="text-[#F59E0B] font-black text-sm">{kmeansResult.shadowSilhouette.toFixed(4)}</span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black font-black">Cluster Elements (K)</span>
                <span className="text-rose-400 font-black text-sm">{kClusters} groups</span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Partition Quality</span>
                <span className="text-blue-300 font-black text-[10px] truncate block">
                  {kmeansResult.shadowSilhouette > 0.45 ? "High-Density Compact clusters" : "Overlap/Linear Spread groups"}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Flagged Outlier Element Count</span>
                <span className="text-rose-400 font-black text-sm">{anomalyResult.anomalyCount} anomalies</span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Mean Neighbor Distance Threshold</span>
                <span className="text-emerald-400 font-black text-sm">{anomalyResult.thresholdScore.toFixed(4)}</span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Density Sensitivity Rate</span>
                <span className="text-[#F59E0B] font-black text-sm">{contaminationRate}%</span>
              </div>
              <div className="bg-slate-800/65 p-2 rounded border border-slate-800">
                <span className="text-[7.5px] text-gray-400 block uppercase font-sans mb-0.5 font-black">Density Inliers Density</span>
                <span className="text-blue-300 font-bold text-sm">{(100 - contaminationRate)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Canvas Visual Plot & Dynamic Live Activity Description */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Interactive Scatterplot Screen (Coordinates Arena) */}
          <div className="lg:col-span-7 bg-white border border-gray-250 p-3.5 rounded-lg shadow-3xs space-y-3">
            <div className="flex items-center justify-between text-[10px] font-sans">
              <span className="text-gray-500 font-extrabold uppercase tracking-wider block">
                Interactive Scatterplot Screen (Coordinates Arena)
              </span>
              <span className="text-gray-400 italic">
                *Klik koordinat untuk posisikan pin pengujian.
              </span>
            </div>

            <div className="relative border border-gray-200/90 rounded bg-[#FAFBFD] overflow-hidden shadow-3xs select-none">
              <svg 
                viewBox="0 0 500 320" 
                className="w-full h-auto cursor-crosshair block" 
                onClick={handleSvgClick}
              >
                <rect width={500} height={320} fill="#FAFBFD" />
                
                {/* Reference grid coordinates */}
                {[0.2, 0.4, 0.6, 0.8].map((ratio, idx) => {
                  const w_x = 55 + ratio * (500 - 55 - 30);
                  const w_y = 320 - 45 - ratio * (320 - 25 - 45);
                  return (
                    <React.Fragment key={idx}>
                      <line x1={w_x} y1={25} x2={w_x} y2={320 - 45} stroke="#E3E8EE" strokeWidth={0.8} strokeDasharray="3 3" />
                      <line x1={55} y1={w_y} x2={500 - 30} y2={w_y} stroke="#E3E8EE" strokeWidth={0.8} strokeDasharray="3 3" />
                    </React.Fragment>
                  );
                })}

                {/* k-NN Decision partition dots */}
                {dsTaskType === "classification" && bgDots.map((dot, idx) => {
                  const coords = getSvgCoords(dot.x, dot.y);
                  return (
                    <circle 
                      key={`bg-dot-${idx}`}
                      cx={coords.cx}
                      cy={coords.cy}
                      r={3.8}
                      fill={getClassColor(dot.predictedClass, true)}
                      fillOpacity={0.4}
                    />
                  );
                })}

                {/* Main axes borders */}
                <line x1={55} y1={320 - 45} x2={500 - 30} y2={320 - 45} stroke="#64748B" strokeWidth={1.5} />
                <line x1={55} y1={25} x2={55} y2={320 - 45} stroke="#64748B" strokeWidth={1.5} />

                {/* Dynamic boundary value representations */}
                <text x={55} y={320 - 32} fill="#64748B" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  {minX.toFixed(0)}
                </text>
                <text x={500 - 30} y={320 - 32} fill="#64748B" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  {maxX.toFixed(0)}
                </text>
                <text x={48} y={320 - 43} fill="#64748B" fontSize="8" textAnchor="end" fontFamily="monospace">
                  {minY.toFixed(0)}
                </text>
                <text x={48} y={31} fill="#64748B" fontSize="8" textAnchor="end" fontFamily="monospace">
                  {maxY.toFixed(0)}
                </text>

                {/* Axis Label Labels */}
                <text x={277} y={320 - 18} fill="#334155" fontSize="9.5" fontWeight="bold" textAnchor="middle" className="capitalize font-sans">
                  {xCol.replace(/_/g, " ")} (X Input Metric)
                </text>
                <text x={14} y={160} fill="#334155" fontSize="9.5" fontWeight="bold" textAnchor="middle" transform="rotate(-90 14 160)" className="capitalize font-sans">
                  {yCol.replace(/_/g, " ")} (Y Target Metric)
                </text>

                {/* Mathematical Linear Regression boundary line fitted */}
                {dsTaskType === "regression" && validPoints.length > 1 && (() => {
                  const yPredMin = regSlope * minX + regIntercept;
                  const yPredMax = regSlope * maxX + regIntercept;
                  const coordMin = getSvgCoords(minX, yPredMin);
                  const coordMax = getSvgCoords(maxX, yPredMax);
                  return (
                    <line 
                      x1={coordMin.cx} 
                      y1={coordMin.cy} 
                      x2={coordMax.cx} 
                      y2={coordMax.cy} 
                      stroke="#1D4ED8" 
                      strokeWidth={3} 
                      strokeOpacity={0.8}
                    />
                  );
                })()}

                {/* Plotting elements - Dynamic to selected solver model */}
                {dsTaskType === "clustering" ? (
                  // Elements grouped into converged clusters coordinates
                  kmeansResult.points.map((pt, idx) => {
                    const coords = getSvgCoords(pt.x, pt.y);
                    const clusterLabel = `Cluster ${pt.cluster + 1}`;
                    return (
                      <circle 
                        key={`pt-clust-${idx}`}
                        cx={coords.cx}
                        cy={coords.cy}
                        r={4.2}
                        fill={getClassColor(clusterLabel)}
                        fillOpacity={0.8}
                        stroke="#FFFFFF"
                        strokeWidth={0.8}
                      />
                    );
                  })
                ) : dsTaskType === "anomaly" ? (
                  // Elements categorized into inliers and highlighted double outlier elements
                  anomalyResult.points.map((pt, idx) => {
                    const coords = getSvgCoords(pt.x, pt.y);
                    if (pt.isAnomaly) {
                      return (
                        <g key={`pt-anom-${idx}`}>
                          <circle 
                            cx={coords.cx} 
                            cy={coords.cy} 
                            r={7.5} 
                            fill="none" 
                            stroke="#EF4444" 
                            strokeWidth={1.2} 
                            strokeOpacity={0.85}
                          />
                          <circle 
                            cx={coords.cx} 
                            cy={coords.cy} 
                            r={4.2} 
                            fill="#EF4444" 
                            stroke="#FFFFFF"
                            strokeWidth={0.8}
                          />
                        </g>
                      );
                    } else {
                      return (
                        <circle 
                          key={`pt-norm-${idx}`}
                          cx={coords.cx}
                          cy={coords.cy}
                          r={3.8}
                          fill="#475569"
                          fillOpacity={0.65}
                          stroke="#FFFFFF"
                          strokeWidth={0.8}
                        />
                      );
                    }
                  })
                ) : (
                  // Supervised scatter circles pairs
                  validPoints.map((pt, idx) => {
                    const coords = getSvgCoords(pt.x, pt.y);
                    return (
                      <circle 
                        key={`pt-${idx}`}
                        cx={coords.cx}
                        cy={coords.cy}
                        r={3.8}
                        fill={getClassColor(pt.z)}
                        fillOpacity={0.8}
                        stroke="#FFFFFF"
                        strokeWidth={0.8}
                      />
                    );
                  })
                )}

                {/* Unsupervised centroid marks stars plotted on cluster coordinates */}
                {dsTaskType === "clustering" && kmeansResult.centroids.map((cent) => {
                  const coords = getSvgCoords(cent.x, cent.y);
                  const clusterLabel = `Cluster ${cent.id + 1}`;
                  return (
                    <g key={`cent-${cent.id}`}>
                      <circle 
                        cx={coords.cx} 
                        cy={coords.cy} 
                        r={9.5} 
                        fill="none" 
                        stroke={getClassColor(clusterLabel)} 
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                      />
                      <path
                        d="M 0,-5 L 1.5,-1.5 L 5,-1.5 L 2,1 L 3,4.5 L 0,2.5 L -3,4.5 L -2,1 L -5,-1.5 L -1.5,-1.5 Z"
                        transform={`translate(${coords.cx}, ${coords.cy}) scale(1.15)`}
                        fill="#EAB308"
                        stroke="#854D0E"
                        strokeWidth={0.8}
                      />
                      <text 
                        x={coords.cx} 
                        y={coords.cy - 7.5} 
                        fill="#0F172A" 
                        fontSize="7" 
                        fontWeight="bold" 
                        textAnchor="middle" 
                        fontFamily="monospace"
                      >
                        C{cent.id + 1}
                      </text>
                    </g>
                  );
                })}

                {/* Centered crosshair calibration target index mapping */}
                {(() => {
                  const cursorCoords = getSvgCoords(validXPred, validYPred);
                  return (
                    <g>
                      <circle 
                        cx={cursorCoords.cx} 
                        cy={cursorCoords.cy} 
                        r={8.5} 
                        fill="none" 
                        stroke="#EF4444" 
                        strokeWidth={1.8} 
                      />
                      <line x1={cursorCoords.cx - 14} y1={cursorCoords.cy} x2={cursorCoords.cx + 14} y2={cursorCoords.cy} stroke="#EF4444" strokeWidth={1} />
                      <line x1={cursorCoords.cx} y1={cursorCoords.cy - 14} x2={cursorCoords.cx} y2={cursorCoords.cy + 14} stroke="#EF4444" strokeWidth={1} />
                      <circle cx={cursorCoords.cx} cy={cursorCoords.cy} r={3} fill="#EF4444" />
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Dynamic dynamic legend label indicators mapping */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 border-t border-gray-100 select-none">
              <span className="text-[8px] font-bold text-gray-400 uppercase font-mono">Dynamic Legend Classes (Z):</span>
              {classesToRender.map(clsName => {
                const badgeStyle = getClassTailwind(clsName);
                return (
                  <div key={clsName} className={`flex items-center gap-1 px-2 py-0.5 border text-[9px] font-bold rounded capitalize font-sans ${badgeStyle.bg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${badgeStyle.dot}`} />
                    <span>{clsName.replace(/_/g, " ")}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Model Description */}
          <div className="lg:col-span-5 bg-slate-50 border border-gray-250 p-4 rounded-lg shadow-3xs flex flex-col justify-between space-y-4 font-sans">
            <div className="space-y-3">
              <span className="text-[8.5px] font-extrabold text-[#107C41] uppercase tracking-wider font-mono block">
                LIVE DESCRIPTOR PANEL (PENJELASAN AKTIVITAS)
              </span>
              <h4 className="text-xs font-bold text-gray-800 border-b border-gray-200 pb-1.5 font-sans">
                {dsTaskType === "regression" && "Regresi Linier Sederhana"}
                {dsTaskType === "classification" && "Identifikasi K-NN Klasifikasi"}
                {dsTaskType === "clustering" && "Klasterisasi Unsupervised K-Means"}
                {dsTaskType === "anomaly" && "Deteksi Outlier Kerapatan Lokal"}
              </h4>

              <div className="space-y-3 text-[11px] leading-relaxed text-gray-700">
                {/* Variable Mappings Card */}
                <div className="bg-white border text-gray-700 border-gray-100 rounded p-2.5 font-mono text-[10px] space-y-1 shadow-2xs">
                  <div className="flex justify-between border-b border-gray-50 pb-1">
                    <span className="text-gray-400">FITUR SUMBU X (Row):</span>
                    <span className="font-bold text-[#107C41] capitalize">{xCol.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-50 pb-1">
                    <span className="text-gray-400">FITUR SUMBU Y (Row):</span>
                    <span className="font-bold text-[#107C41] capitalize">{yCol.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">STATUS ALGORITMA:</span>
                    <span className="font-bold text-blue-700 capitalize">
                      {dsTaskType === "regression" ? "Supervised Trend" : ""}
                      {dsTaskType === "classification" ? `Voted Label Z: ${dsSelectedZ}` : ""}
                      {dsTaskType === "clustering" ? `K-Means (${kClusters} Kelompok)` : ""}
                      {dsTaskType === "anomaly" ? "Local Outliers Screen" : ""}
                    </span>
                  </div>
                </div>

                {/* Analytical explanations based on current type */}
                {dsTaskType === "regression" && (
                  <p className="text-gray-600 font-sans leading-normal">
                    Model sedang melakukan perhitungan matematis linier antara koordinat independen <strong className="font-mono font-bold text-[10px] capitalize text-gray-800">{xCol.replace(/_/g, " ")}</strong> dan koordinat dependen <strong className="font-mono font-bold text-[10px] capitalize text-gray-800">{yCol.replace(/_/g, " ")}</strong>.
                    <br /><br />
                    Garis biru tebal yang membentang melambangkan fitted line model regresi terkecil (Ordinary Least Squares). 
                    Saat pin penunjuk diletakkan di sepanjang sumbu X, mesin memperkirakan tren korelasi linier kualitatif secara real-time.
                  </p>
                )}

                {dsTaskType === "classification" && (
                  <p className="text-gray-600 font-sans leading-normal">
                    Model mempartisi ruang grafik menjadi zona keputusan kelas berdasarkan sebaran mayoritas <strong className="font-mono font-bold text-[10px] capitalize text-gray-800">{dsSelectedZ.replace(/_/g, " ")}</strong>.
                    <br /><br />
                    Bila koordinat pengujian diarahkan ke koordinat <strong className="font-mono text-[10px] text-gray-800">({validXPred}, {validYPred})</strong>, mesin memproses perhitungan jarak spasial spasial Euclid ke seluruh elemen sampel. 
                    Algoritma mengidentifikasi 5 tetangga terdekat di sekitar pin pengujian dan menetapkan prediksi mayoritas: <strong className="font-sans font-black text-rose-700 capitalize">{predictedClass.replace(/_/g, " ")}</strong>.
                  </p>
                )}

                {dsTaskType === "clustering" && (
                  <p className="text-gray-600 font-sans leading-normal">
                    Melalui proses tanpa pengenal (unsupervised), K-Means memisahkan data menjadi <strong className="font-mono text-[10px] text-gray-800">{kClusters} klaster spasial</strong>.
                    <br /><br />
                    Tanda bintang kuning C1, C2, dst melambangkan titik pusat massa (centroid) dari masing-masing kelompok data yang terus-menerus dikalkulasi secara berulang sampai mencapai titik seimbang (konvergen). 
                    Pin uji Anda yang berada di posisi target saat ini dinilai memiliki kedekatan jarak terdekat ke pusat centroid kelima grup sehingga dimasukkan sebagai anggota grup <strong className="font-bold text-blue-700">{predictedCluster}</strong>.
                  </p>
                )}

                {dsTaskType === "anomaly" && (
                  <p className="text-gray-600 font-sans leading-normal">
                    Metode deteksi menganalisis tingkat kesunyian spasial di sekeliling data dengan mengevaluasi tetangga terdekat.
                    <br /><br />
                    Data yang berada di daerah terasing terpencil akan ditandai dengan lingkaran tebal berwarna merah menyala sebagai pencilan (outliers). 
                    Tingkat sensitivitas kontaminasi diatur sebesar <strong className="font-mono text-[10px] text-gray-800">{contaminationRate}%</strong>, yang memfilter objek terluar. Posisi pin uji Anda saat ini dikategorikan berada di daerah densitas <strong className="font-bold text-emerald-700">{predictedAnomStatus.includes("Outlier") ? "Pencilan (Outlier)" : "Padat/Normal (Inlier)"}</strong>.
                  </p>
                )}
              </div>
            </div>

            {/* Inference Status Summary Card inside the panel */}
            <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono space-y-1.5 shadow-xs border border-slate-950">
              <span className="text-[7.5px] text-emerald-400 font-black tracking-widest uppercase block">
                STATUS PREDIKSI INTERAKTIF (Live Output)
              </span>
              <div className="grid grid-cols-1 gap-1 text-[10px] leading-relaxed">
                <div>
                  <span className="text-slate-400">Sumbu Koordinat Pin:</span>{" "}
                  <span className="text-white font-bold">X = {validXPred.toFixed(1)}, Y = {validYPred.toFixed(1)}</span>
                </div>
                {dsTaskType === "regression" && (
                  <div>
                    <span className="text-indigo-300 font-semibold font-sans">Estimasi Target Y:</span>{" "}
                    <span className="text-emerald-400 font-black text-[12px]">{regPredictionY.toFixed(2)}</span>
                  </div>
                )}
                {dsTaskType === "classification" && (
                  <div>
                    <span className="text-emerald-300 font-semibold font-sans">Hasil Voted Class:</span>{" "}
                    <span className="text-emerald-400 font-black capitalize bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/30">
                      {predictedClass.replace(/_/g, " ")}
                    </span>
                  </div>
                )}
                {dsTaskType === "clustering" && (
                  <div>
                    <span className="text-cyan-300 font-semibold font-sans">Terpetakan ke Grup:</span>{" "}
                    <span className="text-cyan-400 font-bold bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/30">
                      {predictedCluster}
                    </span>
                  </div>
                )}
                {dsTaskType === "anomaly" && (
                  <div>
                    <span className="text-rose-300 font-semibold font-sans">Prediksi Kerapatan:</span>{" "}
                    <span className={`font-bold px-1.5 py-0.5 rounded border ${
                      predictedAnomStatus.includes("Outlier") 
                        ? "bg-rose-950/60 border-rose-800/30 text-rose-300" 
                        : "bg-emerald-950/60 border-emerald-800/30 text-emerald-300"
                    }`}>
                      {predictedAnomStatus.includes("Outlier") ? "PENCILAN (Outlier)" : "NORMAL (Inlier)"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sliders Panels and Live Inference Output mapping */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="bg-slate-50 p-4 rounded-lg border border-gray-200 shadow-3xs space-y-3.5">
            <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-widest font-mono">
              LIVE PREDICTION TUNING SLIDERS
            </h4>

            <div className="space-y-4">
              {/* Slider X */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-700 capitalize font-mono text-[9.5px]">
                    Feature X ({xCol.replace(/_/g, " ")})
                  </span>
                  <span className="font-black text-[#107C41] font-mono text-[10.5px] bg-white border px-2 py-0.5 rounded shadow-3xs">
                    {validXPred.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={minX}
                  max={maxX}
                  step={(maxX - minX) / 100 || 1}
                  value={validXPred}
                  onChange={(e) => setDsPredictionX(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#107C41] focus:outline-none"
                />
                <div className="flex justify-between text-[8px] text-gray-450 font-mono">
                  <span>Lower Bound: {minX.toFixed(1)}</span>
                  <span>Upper Bound: {maxX.toFixed(1)}</span>
                </div>
              </div>

              {/* Slider Y */}
              {dsTaskType !== "regression" ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-700 capitalize font-mono text-[9.5px]">
                      Feature Y ({yCol.replace(/_/g, " ")})
                    </span>
                    <span className="font-black text-[#107C41] font-mono text-[10.5px] bg-white border px-2 py-0.5 rounded shadow-3xs">
                      {validYPred.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={minY}
                    max={maxY}
                    step={(maxY - minY) / 100 || 1}
                    value={validYPred}
                    onChange={(e) => setDsPredictionY(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#107C41] focus:outline-none"
                  />
                  <div className="flex justify-between text-[8px] text-gray-450 font-mono">
                    <span>Lower Bound: {minY.toFixed(1)}</span>
                    <span>Upper Bound: {maxY.toFixed(1)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200/50 p-2.5 rounded text-[10px] text-amber-900 leading-normal font-sans">
                  <strong>Active Regression Equation:</strong> The coordinate on the Y-Axis {yCol.replace(/_/g, " ")} is derived using least-squares equation against the calibrated X-Axis predictor parameters.
                </div>
              )}
            </div>
          </div>

          <div className={`p-4 rounded-lg border flex flex-col justify-between gap-3 shadow-3xs relative overflow-hidden text-white transition-all duration-300 ${
            dsTaskType === "regression"
              ? "bg-gradient-to-br from-indigo-900 to-indigo-950 border-indigo-950"
              : dsTaskType === "classification"
                ? "bg-gradient-to-br from-emerald-950 to-slate-950 border-emerald-950"
                : dsTaskType === "clustering"
                  ? "bg-gradient-to-br from-cyan-950 to-teal-980 border-cyan-950"
                  : "bg-gradient-to-br from-rose-950 to-stone-950 border-rose-950"
          }`}>
            <div className="space-y-1 z-10">
              <span className="text-[8px] text-gray-300 font-bold uppercase tracking-widest font-mono block">
                MODEL INFERENCE ENGINE (REAL-TIME MODEL EMULATION)
              </span>
              <h4 className="text-[11px] font-black text-white/90">
                {dsTaskType === "regression" 
                  ? "Linear Fitting Polynomial Trend Estimator" 
                  : dsTaskType === "classification"
                    ? "Neighbor-voted Supervised k-NN Boundary Solver"
                    : dsTaskType === "clustering"
                      ? "Unsupervised Centroid-distance Cluster Assigner"
                      : "Isolation-Distance Density Boundary Outlier Evaluator"
                }
              </h4>
            </div>

            <div className="py-2.5 z-10 text-center select-all">
              {dsTaskType === "regression" ? (
                <div className="space-y-1">
                  <span className="text-[8.5px] text-gray-300 block font-mono uppercase tracking-wider">Estimated Target Y-Value:</span>
                  <span className="text-2xl font-black font-mono tracking-tight text-white block">
                    {regPredictionY.toFixed(2)}
                  </span>
                  <span className="text-[8px] text-indigo-300 font-mono block capitalize">
                    {yCol.replace(/_/g, " ")} Prediction
                  </span>
                </div>
              ) : dsTaskType === "classification" ? (
                <div className="space-y-1">
                  <span className="text-[8.5px] text-gray-300 block font-mono uppercase tracking-semibold">Predicted Category (Z-Label):</span>
                  <span className="text-xl font-bold font-sans tracking-tight bg-white/10 border border-white/20 py-1.5 px-3.5 rounded-lg capitalize inline-block text-white">
                    {predictedClass.replace(/_/g, " ")}
                  </span>
                  <span className="text-[8px] text-emerald-300 font-mono block mt-1.5">
                    Based on 5 Nearest neighbors voting
                  </span>
                </div>
              ) : dsTaskType === "clustering" ? (
                <div className="space-y-1">
                  <span className="text-[8.5px] text-gray-300 block font-mono uppercase tracking-semibold">Estimated Cluster Segment:</span>
                  <span className="text-xl font-bold font-sans tracking-tight bg-white/10 border border-white/20 py-1.5 px-3.5 rounded-lg capitalize inline-block text-white">
                    {predictedCluster}
                  </span>
                  <span className="text-[8px] text-cyan-300 font-mono block mt-1.5">
                    Mapped to closest computed cluster centroid
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="text-[8.5px] text-gray-300 block font-mono uppercase tracking-semibold">Coordinate Density Status:</span>
                  <span className={`text-lg font-bold font-sys tracking-tight border py-1.5 px-3.5 rounded-lg inline-block ${
                    predictedAnomStatus.includes("Outlier") 
                      ? "bg-rose-500/25 border-rose-400 text-rose-300" 
                      : "bg-emerald-500/25 border-emerald-400 text-emerald-300"
                  }`}>
                    {predictedAnomStatus}
                  </span>
                  <span className="text-[8px] text-gray-300 font-mono block mt-1.5">
                    Computed isolation threshold distance limit
                  </span>
                </div>
              )}
            </div>

            <p className="text-[9px] text-gray-300 leading-relaxed font-sans z-10 border-t border-white/10 pt-2 select-none">
              {dsTaskType === "regression" ? (
                <>
                  Linear mathematical regression prediction: Y-Axis trends by <strong className="text-white font-mono">{regSlope.toFixed(2)}</strong> points for each increment of +1 X with $R^2 \approx {regR2.toFixed(3)}$.
                </>
              ) : dsTaskType === "classification" ? (
                <>
                  Query coordinates <strong className="text-white font-mono font-bold">({validXPred.toFixed(0)}, {validYPred.toFixed(0)})</strong> map to the local neighbor cluster in standard multidimensional space.
                </>
              ) : dsTaskType === "clustering" ? (
                <>
                  The visual point is designated to center <strong className="text-white font-mono font-bold">{predictedCluster}</strong>, which minimizes intra-cluster distance calculations dynamically across K centroids.
                </>
              ) : (
                <>
                  Outlier classification determines whether coordinate isolation exceeds the calibrated threshold margin ($d \approx {anomalyResult.thresholdScore.toFixed(3)}$) calculated over contamination criteria.
                </>
              )}
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
