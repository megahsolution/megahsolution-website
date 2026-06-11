import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Star } from "lucide-react";

// Nullify other icons based on user design requests, keeping only Star active
const Upload = () => null;
const Layers = () => null;
const Sparkles = () => null;
const RefreshCw = () => null;
const TrendingUp = () => null;
const Sliders = () => null;
const CheckCircle2 = () => null;
const AlertTriangle = () => null;
const Code = () => null;
const Download = () => null;
const Terminal = () => null;
const Grid = () => null;
const Info = () => null;
const SlidersHorizontal = () => null;
const ChevronRight = () => null;
const ChevronUp = () => null;
const ChevronDown = () => null;
const ShieldCheck = () => null;
const ShieldAlert = () => null;
const Zap = () => null;
const Check = () => null;
const Trash2 = () => null;
const Brain = () => null;
const Calendar = () => null;
const User = () => null;
const ShoppingBag = () => null;
const ArrowUpRight = () => null;
const Activity = () => null;
const Compass = () => null;
import {
  generateSyntheticCustomerData,
  inferSchema,
  runIngestionStage,
  runEngineeringStage,
  runEdaStage,
  formatExcelValue
} from "./utils/dataset";
import { DataRecord, IngestionDiagnostics, EngineeringDiagnostics, ColumnEngineeringConfig, EdaDiagnostics, CorrelationPair } from "./types";
import SourceCodeExplorer from "./components/SourceCodeExplorer";
import { DataScienceSandbox } from "./components/DataScienceSandbox";
import { DatasetExplorer } from "./components/DatasetExplorer";

export default function App() {
  // Datasets states
  const [rawData, setRawData] = useState<DataRecord[] | null>(null);
  const [ingestedData, setIngestedData] = useState<DataRecord[] | null>(null);
  const [engineeredData, setEngineeredData] = useState<DataRecord[] | null>(null);
  const [deletedDuplicatesCount, setDeletedDuplicatesCount] = useState<number>(0);
  const [duplicateCleared, setDuplicateCleared] = useState<boolean>(false);

  // Inferred/Custom schema states
  const [schema, setSchema] = useState<Record<string, "datetime" | "float" | "int" | "category">>({});
  const [deletedColumns, setDeletedColumns] = useState<string[]>([]);
  const [uniqueKeys, setUniqueKeys] = useState<string[]>([]);
  const [dateTimeCol, setDateTimeCol] = useState<string>("");

  // Diagnostics states
  const [ingestionDiag, setIngestionDiag] = useState<IngestionDiagnostics | null>(null);
  const [engineeringDiag, setEngineeringDiag] = useState<EngineeringDiagnostics | null>(null);

  // Workspace pipelines states
  const [completedStep, setCompletedStep] = useState<number>(0); // 0=Unloaded, 1=Ingested, 2=Engineered
  const [activeTab, setActiveTab] = useState<"workspace" | "source">("workspace");
  const [showSandboxParams, setShowSandboxParams] = useState<boolean>(false);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [isEngineering, setIsEngineering] = useState<boolean>(false);

  // Dynamic Threshold boundaries (user is the data scientist)
  const [customThresholds, setCustomThresholds] = useState<Record<string, { min: number; max: number }>>({
    purchase_amount: { min: 0, max: 1500 },
    visit_duration: { min: 0, max: 200 }
  });

  // Keep track of active comparison chart column
  const [activeChartCol, setActiveChartCol] = useState<string>("purchase_amount");

  // Worksheet selection states
  const [pendingWorkbook, setPendingWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  // Load standard business mock data
  const handleGenerateData = () => {
    const data = generateSyntheticCustomerData(150, true);
    const inferred = inferSchema(data);
    
    // Auto-setup settings from inferred columns
    const numericCols = Object.entries(inferred)
      .filter(([_, type]) => type === "float" || type === "int")
      .map(([colName]) => colName);
    
    const dts = Object.entries(inferred)
      .filter(([_, type]) => type === "datetime")
      .map(([col]) => col);

    // Initial thresholds setup
    const newLimits: Record<string, { min: number; max: number }> = {};
    numericCols.forEach(col => {
      if (col === "purchase_amount") newLimits[col] = { min: 0, max: 1500 };
      else if (col === "visit_duration") newLimits[col] = { min: 0, max: 200 };
      else newLimits[col] = { min: 0, max: 10 };
    });

    const initialConfigs: Record<string, ColumnEngineeringConfig> = {};
    numericCols.forEach(col => {
      initialConfigs[col] = {
        imputeStrategy: "interpolate",
        outlierStrategy: "iqr",
        outlierThreshold: 1.5,
        outlierAction: "cap",
        scalingStrategy: col === "transactions" ? "none" : "standard",
        invalidFormatAction: "extract_numeric"
      };
    });
    setColumnConfigs(initialConfigs);
    if (numericCols.length > 0) {
      setSelectedConfigCol(numericCols[0]);
    }

    // Auto-run stage 1 (Ingestion)
    const uniqueKeysVal = dts.length > 0 ? [dts[0]] : [];
    const dateTimeColVal = dts.length > 0 ? dts[0] : "";
    const { data: ingData, diagnostics: ingDiag } = runIngestionStage(
      data, 
      inferred, 
      newLimits, 
      uniqueKeysVal, 
      dateTimeColVal
    );

    // Auto-run stage 2 (Engineering)
    const { data: engData, diagnostics: engDiag } = runEngineeringStage(
      ingData, 
      data, 
      inferred, 
      initialConfigs
    );

    // Auto-run stage 3 (EDA)
    const edaDiagnostics = runEdaStage(engData, inferred);

    setRawData(data);
    setSchema(inferred);
    setDeletedColumns([]);
    setUniqueKeys(uniqueKeysVal);
    setDateTimeCol(dateTimeColVal);
    setCustomThresholds(newLimits);
    setDeletedDuplicatesCount(0);
    setDuplicateCleared(false);
    if (numericCols.length > 0) {
      setActiveChartCol(numericCols[0]);
    }

    setIngestedData(ingData);
    setIngestionDiag(ingDiag);
    setEngineeredData(engData);
    setEngineeringDiag(engDiag);
    setEdaDiag(edaDiagnostics);

    if (numericCols.length > 0) {
      setDistSelectedCol(numericCols[0]);
      setSelectedRelCols(numericCols);
    }

    setCompletedStep(3);
  };

  const handleRunIngestion = () => {
    if (!rawData) return;
    setIsIngesting(true);

    setTimeout(() => {
      const { data: ingData, diagnostics: ingDiag } = runIngestionStage(
        rawData, 
        schema, 
        customThresholds, 
        uniqueKeys, 
        dateTimeCol
      );
      setIngestedData(ingData);
      setIngestionDiag(ingDiag);

      // Auto-run stage 2 (Engineering)
      const filteredSchema = Object.fromEntries(
        Object.entries(schema).filter(([col]) => !deletedColumns.includes(col))
      ) as Record<string, "datetime" | "float" | "int" | "category">;
      const { data: engData, diagnostics: engDiag } = runEngineeringStage(
        ingData, 
        rawData, 
        filteredSchema, 
        columnConfigs
      );

      const cleanedEngData = engData.map((row) => {
        const copy = { ...row };
        deletedColumns.forEach((c) => {
          delete copy[c];
        });
        return copy;
      });

      setEngineeredData(cleanedEngData);
      setEngineeringDiag(engDiag);

      // Auto-run stage 3 (EDA)
      const edaDiagnostics = runEdaStage(cleanedEngData, filteredSchema);
      setEdaDiag(edaDiagnostics);

      // Auto populate interactive variables for EDA if empty
      const numericCols = Object.entries(filteredSchema)
        .filter(([_, t]) => t === "float" || t === "int")
        .map(([col]) => col);

      if (numericCols.length > 0) {
        if (!distSelectedCol || deletedColumns.includes(distSelectedCol)) {
          setDistSelectedCol(numericCols[0]);
        }
        setSelectedRelCols((prev) => {
          const intersection = prev.filter((c) => !deletedColumns.includes(c));
          return intersection.length > 0 ? intersection : numericCols;
        });
      }

      setCompletedStep(3);
      setIsIngesting(false);
    }, 450);
  };

  // Cleansing and engineering pipeline
  const [columnConfigs, setColumnConfigs] = useState<Record<string, ColumnEngineeringConfig>>({});
  const [selectedConfigCol, setSelectedConfigCol] = useState<string>("");

  const triggerPipelineUpdate = (activeDeleted: string[], activeConfigs: Record<string, ColumnEngineeringConfig>) => {
    if (!ingestedData || !rawData) return;
    
    const filteredSchema = Object.fromEntries(
      Object.entries(schema).filter(([col]) => !activeDeleted.includes(col))
    ) as Record<string, "datetime" | "float" | "int" | "category">;
    
    const { data: engData, diagnostics: engDiag } = runEngineeringStage(ingestedData, rawData, filteredSchema, activeConfigs);
    
    // Physically exclude deleted columns from resulting dataset
    const cleanedEngData = engData.map((row) => {
      const copy = { ...row };
      activeDeleted.forEach((c) => {
        delete copy[c];
      });
      return copy;
    });

    setEngineeredData(cleanedEngData);
    setEngineeringDiag(engDiag);

    // Synchronize/re-run Ingestion & Bounds Check Stage (Module 1) values on the newly cleaned data
    const { data: updatedIngestData, diagnostics: updatedIngestDiag } = runIngestionStage(
      engData,
      schema,
      customThresholds,
      uniqueKeys,
      dateTimeCol
    );
    setIngestedData(updatedIngestData);
    setIngestionDiag(updatedIngestDiag);

    // Auto-run stage 3 (EDA)
    const edaDiagnostics = runEdaStage(cleanedEngData, filteredSchema);
    setEdaDiag(edaDiagnostics);

    // Auto populate interactive variables for EDA if empty
    const numericCols = Object.entries(filteredSchema)
      .filter(([_, t]) => t === "float" || t === "int")
      .map(([col]) => col);

    if (numericCols.length > 0) {
      if (!distSelectedCol || activeDeleted.includes(distSelectedCol)) {
        setDistSelectedCol(numericCols[0]);
      }
      setSelectedRelCols((prev) => {
        const intersection = prev.filter((c) => !activeDeleted.includes(c));
        return intersection.length > 0 ? intersection : numericCols;
      });
    }
  };

  const handleRunEngineering = () => {
    if (!ingestedData || !rawData) return;
    setIsEngineering(true);

    setTimeout(() => {
      const filteredSchema = Object.fromEntries(
        Object.entries(schema).filter(([col]) => !deletedColumns.includes(col))
      ) as Record<string, "datetime" | "float" | "int" | "category">;
      const { data: engData, diagnostics: engDiag } = runEngineeringStage(ingestedData, rawData, filteredSchema, columnConfigs);
      
      // Physically exclude deleted columns from resulting dataset
      const cleanedEngData = engData.map((row) => {
        const copy = { ...row };
        deletedColumns.forEach((c) => {
          delete copy[c];
        });
        return copy;
      });

      setEngineeredData(cleanedEngData);
      setEngineeringDiag(engDiag);

      // Synchronize/re-run Ingestion & Bounds Check Stage (Module 1) values on the newly cleaned data
      // so Module 1's Integrity Score, anomalies count, and alerts update in real-time.
      const { data: updatedIngestData, diagnostics: updatedIngestDiag } = runIngestionStage(
        engData,
        schema,
        customThresholds,
        uniqueKeys,
        dateTimeCol
      );
      setIngestedData(updatedIngestData);
      setIngestionDiag(updatedIngestDiag);

      // Auto-run stage 3 (EDA)
      const edaDiagnostics = runEdaStage(cleanedEngData, filteredSchema);
      setEdaDiag(edaDiagnostics);

      // Auto populate interactive variables for EDA if empty
      const numericCols = Object.entries(filteredSchema)
        .filter(([_, t]) => t === "float" || t === "int")
        .map(([col]) => col);

      if (numericCols.length > 0) {
        if (!distSelectedCol || deletedColumns.includes(distSelectedCol)) {
          setDistSelectedCol(numericCols[0]);
        }
        setSelectedRelCols((prev) => {
          const intersection = prev.filter((c) => !deletedColumns.includes(c));
          return intersection.length > 0 ? intersection : numericCols;
        });
      }

      setCompletedStep(3);
      setIsEngineering(false);
    }, 450);
  };

  const handleDeleteDuplicates = () => {
    if (!rawData) return;
    
    const dedupedData: DataRecord[] = [];
    const seenFullRows = new Set<string>();
    const seenCompositeKeys = new Set<string>();
    
    let deletedCount = 0;
    
    rawData.forEach(row => {
      // 1. Full row representation (all columns match)
      const rowStr = Object.keys(row).sort().map(k => `${k}:${row[k]}`).join("||");
      
      // 2. Composite key representation
      const compositeKey = uniqueKeys.map(k => String(row[k] ?? "")).join("::");
      
      const isFullDup = seenFullRows.has(rowStr);
      const isKeyDup = uniqueKeys.length > 0 && seenCompositeKeys.has(compositeKey);
      
      if (isFullDup || isKeyDup) {
        deletedCount++;
      } else {
        seenFullRows.add(rowStr);
        if (uniqueKeys.length > 0) {
          seenCompositeKeys.add(compositeKey);
        }
        dedupedData.push(row);
      }
    });
    
    if (deletedCount === 0) {
      alert("Tidak ditemukan baris duplikat (identik penuh atau composite key overlap) pada dataset saat ini.");
      return;
    }
    
    setRawData(dedupedData);
    setDeletedDuplicatesCount(deletedCount);
    setDuplicateCleared(true);
    
    // Auto re-run all pipeline states to synchronize immediately and update UI
    const { data: ingData, diagnostics: ingDiag } = runIngestionStage(
      dedupedData,
      schema,
      customThresholds,
      uniqueKeys,
      dateTimeCol
    );
    setIngestedData(ingData);
    setIngestionDiag(ingDiag);
    
    const filteredSchema = Object.fromEntries(
      Object.entries(schema).filter(([col]) => !deletedColumns.includes(col))
    ) as Record<string, "datetime" | "float" | "int" | "category">;
    
    const { data: engData, diagnostics: engDiag } = runEngineeringStage(
      ingData,
      dedupedData,
      filteredSchema,
      columnConfigs
    );
    
    const cleanedEngData = engData.map((row) => {
      const copy = { ...row };
      deletedColumns.forEach((c) => {
        delete copy[c];
      });
      return copy;
    });
    
    setEngineeredData(cleanedEngData);
    setEngineeringDiag(engDiag);
    
    const edaDiagnostics = runEdaStage(cleanedEngData, filteredSchema);
    setEdaDiag(edaDiagnostics);
  };

  // EDA & Analytics pipeline
  const [edaDiag, setEdaDiag] = useState<EdaDiagnostics | null>(null);
  const [edaTargetCol, setEdaTargetCol] = useState<string>("purchase_amount");
  const [activeEdaTab, setActiveEdaTab] = useState<"summary" | "distribution" | "relationship" | "profiler">("summary");
  const [distSelectedCol, setDistSelectedCol] = useState<string>("");
  const [distRangeMode, setDistRangeMode] = useState<"default" | "iqr" | "trim2" | "trim5" | "custom">("default");
  const [distCustomMin, setDistCustomMin] = useState<string>("");
  const [distCustomMax, setDistCustomMax] = useState<string>("");
  const [selectedRelCols, setSelectedRelCols] = useState<string[]>([]);
  const [bivariateVarX, setBivariateVarX] = useState<string>("");
  const [bivariateVarY, setBivariateVarY] = useState<string>("");
  const [showPairplot, setShowPairplot] = useState<boolean>(false);
  const [profilerCol, setProfilerCol] = useState<string>("");
  const [profilerVal, setProfilerVal] = useState<string>("");
  const [profilerSearch, setProfilerSearch] = useState<string>("");
  const [profilerMeasureCol, setProfilerMeasureCol] = useState<string>("");
  const [profilerAggOp, setProfilerAggOp] = useState<string>("count");
  const [profilerGroupByCols, setProfilerGroupByCols] = useState<string[]>([]);
  const [profilerTimeCol, setProfilerTimeCol] = useState<string>("");
  const [profilerTimeGranularity, setProfilerTimeGranularity] = useState<string>("month");
  const [profilerFilters, setProfilerFilters] = useState<{ col: string; op: string; val: string }[]>([]);
  const [profilerChartOverride, setProfilerChartOverride] = useState<string>("auto");
  const [profilerHoverIndex, setProfilerHoverIndex] = useState<number | null>(null);
  const [activeExcelCell, setActiveExcelCell] = useState<{ref: string; val: string}>({ ref: "A2", val: "Click any cell to view formula" });
  const [activeModuleTab, setActiveModuleTab] = useState<"module1" | "module2" | "module3" | "module4">("module1");
  const [dsSelectedX, setDsSelectedX] = useState<string>("visit_duration");
  const [dsSelectedY, setDsSelectedY] = useState<string>("purchase_amount");
  const [dsSelectedZ, setDsSelectedZ] = useState<string>("category");
  const [dsTaskType, setDsTaskType] = useState<"classification" | "regression">("regression");
  const [dsPredictionX, setDsPredictionX] = useState<number>(15);
  const [dsPredictionY, setDsPredictionY] = useState<number>(150);
  const [showSpecificMethods, setShowSpecificMethods] = useState<boolean>(true);
  const [showAllEdaInsights, setShowAllEdaInsights] = useState<boolean>(false);
  const [showAllEngWarnings, setShowAllEngWarnings] = useState<boolean>(false);

  const handleRunEda = () => {
    if (!engineeredData) return;
    const filteredSchema = Object.fromEntries(
      Object.entries(schema).filter(([col]) => !deletedColumns.includes(col))
    ) as Record<string, "datetime" | "float" | "int" | "category">;
    const diagnostics = runEdaStage(engineeredData, filteredSchema);
    setEdaDiag(diagnostics);
    
    // Auto populate interactive variables if empty
    const numericCols = Object.entries(filteredSchema)
      .filter(([_, t]) => t === "float" || t === "int")
      .map(([col]) => col);

    if (numericCols.length > 0) {
      if (!distSelectedCol || deletedColumns.includes(distSelectedCol)) {
        setDistSelectedCol(numericCols[0]);
      }
      setSelectedRelCols((prev) => {
        const intersection = prev.filter((c) => !deletedColumns.includes(c));
        return intersection.length > 0 ? intersection : numericCols;
      });
    }
    
    setCompletedStep(Math.max(completedStep, 3));
  };

  const handleConvertColumnType = (colName: string, targetType: "datetime" | "float" | "int" | "category") => {
    if (!rawData) return;

    // Convert values in rawData
    const updatedRawData = rawData.map(row => {
      const copy = { ...row };
      const originalVal = copy[colName];

      let convertedVal: any = originalVal;
      if (originalVal === null || originalVal === undefined || originalVal === "") {
        convertedVal = null;
      } else if (targetType === "datetime") {
        // Special conversion to date string (YYYY-MM-DD or ISO subset)
        // 1. Check if number or string representing a number
        const num = Number(originalVal);
        if (!isNaN(num) && typeof originalVal !== "boolean") {
          if (num > 1000000) {
            // Looks like a timestamp in seconds or milliseconds
            const ms = num < 10000000000 ? num * 1000 : num;
            const dateObj = new Date(ms);
            convertedVal = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : String(originalVal);
          } else if (num > 30000 && num < 60000) {
            // Excel serial date numbers (e.g. 45000 is mid 2023)
            try {
              const dateObj = new Date((num - 25569) * 86400 * 1000);
              convertedVal = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : String(originalVal);
            } catch {
              convertedVal = String(originalVal);
            }
          } else if (num >= 1900 && num <= 2100) {
            // Year only conversion
            convertedVal = `${num}-01-01`;
          } else {
            // fallback
            const dateObj = new Date(num);
            convertedVal = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : String(originalVal);
          }
        } else {
          // It's a string, try parsing directly as Date
          const dateObj = new Date(String(originalVal));
          convertedVal = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : String(originalVal);
        }
      } else if (targetType === "float" || targetType === "int") {
        const cleanStr = String(originalVal).replace(/[^0-9.-]/g, "");
        const num = parseFloat(cleanStr);
        if (isNaN(num)) {
          convertedVal = null;
        } else {
          convertedVal = targetType === "int" ? Math.round(num) : num;
        }
      } else if (targetType === "category") {
        convertedVal = String(originalVal);
      }
      copy[colName] = convertedVal;
      return copy;
    });

    // Update the schema
    const updatedSchema = { ...schema, [colName]: targetType };

    // Update numeric columns bounds and column engineering configs if it's numeric/was numeric
    const numericCols = Object.entries(updatedSchema)
      .filter(([_, type]) => type === "float" || type === "int")
      .map(([colName]) => colName);
    
    const dts = Object.entries(updatedSchema)
      .filter(([_, type]) => type === "datetime")
      .map(([col]) => col);

    const newLimits = { ...customThresholds };
    // If newly numeric, ensure it has limits
    numericCols.forEach(col => {
      if (!newLimits[col]) {
        const colVals = updatedRawData.map(r => Number(r[col])).filter(v => !isNaN(v) && v !== null);
        const colMin = colVals.length ? Math.min(...colVals) : 0;
        const colMax = colVals.length ? Math.max(...colVals) : 100;
        newLimits[col] = { 
          min: Math.floor(colMin - (colMax - colMin) * 0.1), 
          max: Math.ceil(colMax + (colMax - colMin) * 0.1) 
        };
      }
    });

    // If no configs, add defaults
    const updatedConfigs = { ...columnConfigs };
    numericCols.forEach(col => {
      if (!updatedConfigs[col]) {
        updatedConfigs[col] = {
          imputeStrategy: "interpolate",
          outlierStrategy: "iqr",
          outlierThreshold: 1.5,
          outlierAction: "cap",
          scalingStrategy: "none",
          invalidFormatAction: "extract_numeric"
        };
      }
    });

    // Handle datetime col mapping updates
    let updatedDateTimeCol = dateTimeCol;
    if (targetType === "datetime" && !dateTimeCol) {
      updatedDateTimeCol = colName;
    } else if (dateTimeCol === colName && targetType !== "datetime") {
      updatedDateTimeCol = dts.length > 0 ? dts[0] : "";
    }

    let updatedUniqueKeys = uniqueKeys;
    if (targetType === "datetime" && uniqueKeys.length === 0) {
      updatedUniqueKeys = [colName];
    } else if (uniqueKeys.includes(colName) && targetType !== "datetime") {
      updatedUniqueKeys = uniqueKeys.filter(k => k !== colName);
    }

    // Now run ingestion & engineering pipelines
    const { data: ingData, diagnostics: ingDiag } = runIngestionStage(
      updatedRawData,
      updatedSchema,
      newLimits,
      updatedUniqueKeys,
      updatedDateTimeCol
    );

    const { data: engData, diagnostics: engDiag } = runEngineeringStage(
      ingData,
      updatedRawData,
      updatedSchema,
      updatedConfigs
    );

    const cleanedEngData = engData.map((row) => {
      const copy = { ...row };
      deletedColumns.forEach((c) => {
        delete copy[c];
      });
      return copy;
    });

    const edaDiagnostics = runEdaStage(cleanedEngData, updatedSchema);

    setRawData(updatedRawData);
    setSchema(updatedSchema);
    setCustomThresholds(newLimits);
    setColumnConfigs(updatedConfigs);
    setDateTimeCol(updatedDateTimeCol);
    setUniqueKeys(updatedUniqueKeys);
    setIngestedData(ingData);
    setIngestionDiag(ingDiag);
    setEngineeredData(cleanedEngData);
    setEngineeringDiag(engDiag);
    setEdaDiag(edaDiagnostics);
  };

  const handleDownloadCSV = () => {
    if (!engineeredData || engineeredData.length === 0) return;
    const cols = Object.keys(engineeredData[0]);
    const headers = cols.join(",") + "\n";
    const rows = engineeredData
      .map(r => cols.map(c => r[c] !== null && r[c] !== undefined ? `"${String(r[c])}"` : "").join(","))
      .join("\n");
      
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sanitized_analytics_dataset.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle dynamic Excel or CSV upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        // Read as array buffer which natively handles .xlsx, .xls, and .csv files correctly
        const workbook = XLSX.read(data, { type: "array" });
        setPendingWorkbook(workbook);
        setAvailableSheets(workbook.SheetNames);
        setUploadedFileName(file.name);
      } catch (err: any) {
        alert("Failed to parse file correctly (make sure it is valid Excel or CSV): " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSelectSheet = (sheetName: string) => {
    if (!pendingWorkbook) return;
    try {
      const worksheet = pendingWorkbook.Sheets[sheetName];
      // Parse directly to JSON key-value blocks
      const parsed = XLSX.utils.sheet_to_json<DataRecord>(worksheet, { defval: null });
      if (parsed.length === 0) {
        alert("Lembar kerja (sheet) yang dipilih tidak mengandung data baris apapun.");
        return;
      }

      const inferred = inferSchema(parsed);
      const numericCols = Object.entries(inferred)
        .filter(([_, type]) => type === "float" || type === "int")
        .map(([colName]) => colName);
      
      const dts = Object.entries(inferred)
        .filter(([_, type]) => type === "datetime")
        .map(([col]) => col);

      const newLimits: Record<string, { min: number; max: number }> = {};
      numericCols.forEach(col => {
        // Attempt automatic logical limit guess
        const colVals = parsed.map(r => Number(r[col])).filter(v => !isNaN(v) && v !== null);
        const colMin = colVals.length ? Math.min(...colVals) : 0;
        const colMax = colVals.length ? Math.max(...colVals) : 100;
        newLimits[col] = { 
          min: Math.floor(colMin - (colMax - colMin) * 0.1), 
          max: Math.ceil(colMax + (colMax - colMin) * 0.1) 
        };
      });

      const initialConfigs: Record<string, ColumnEngineeringConfig> = {};
      numericCols.forEach(col => {
        initialConfigs[col] = {
          imputeStrategy: "interpolate",
          outlierStrategy: "iqr",
          outlierThreshold: 1.5,
          outlierAction: "cap",
          scalingStrategy: "none", // uploaded data keeps absolute units by default unless styled
          invalidFormatAction: "extract_numeric"
        };
      });
      setColumnConfigs(initialConfigs);
      if (numericCols.length > 0) {
        setSelectedConfigCol(numericCols[0]);
      }

      // Auto-run stage 1 (Ingestion)
      const uniqueKeysVal = dts.length > 0 ? [dts[0]] : [];
      const dateTimeColVal = dts.length > 0 ? dts[0] : "";
      const { data: ingData, diagnostics: ingDiag } = runIngestionStage(
        parsed, 
        inferred, 
        newLimits, 
        uniqueKeysVal, 
        dateTimeColVal
      );

      // Auto-run stage 2 (Engineering)
      const { data: engData, diagnostics: engDiag } = runEngineeringStage(
        ingData, 
        parsed, 
        inferred, 
        initialConfigs
      );

      // Auto-run stage 3 (EDA)
      const edaDiagnostics = runEdaStage(engData, inferred);

      setRawData(parsed);
      setSchema(inferred);
      setDeletedColumns([]);
      setUniqueKeys(uniqueKeysVal);
      setDateTimeCol(dateTimeColVal);
      setCustomThresholds(newLimits);
      setDeletedDuplicatesCount(0);
      setDuplicateCleared(false);
      if (numericCols.length > 0) {
        setActiveChartCol(numericCols[0]);
      }

      setIngestedData(ingData);
      setIngestionDiag(ingDiag);
      setEngineeredData(engData);
      setEngineeringDiag(engDiag);
      setEdaDiag(edaDiagnostics);

      if (numericCols.length > 0) {
        setDistSelectedCol(numericCols[0]);
        setSelectedRelCols(numericCols);
      }

      setCompletedStep(3);
      // Clean up states
      setPendingWorkbook(null);
      setAvailableSheets([]);
    } catch (err: any) {
      alert("Gagal memproses sheet terpilih: " + err.message);
    }
  };

  // Quick pre-engineering statistics calculation for display purposes
  const getPreEngineeringColumnProfile = (colName: string) => {
    if (!ingestedData) return null;
    const values = ingestedData
      .map(r => r[colName])
      .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(Number);
    
    const totalRows = ingestedData.length;
    const nullCount = totalRows - values.length;
    const nullPercentage = Number(((nullCount / totalRows) * 100).toFixed(1));
    
    if (values.length === 0) {
      return {
        nullCount,
        nullPercentage,
        min: 0,
        max: 0,
        mean: 0,
        outlierCount: 0,
        outlierPercentage: 0,
        histogramBins: Array(12).fill({ count: 0, heightPct: 8 })
      };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((s, v) => s + v, 0);
    const mean = Number((sum / values.length).toFixed(2));

    // Count outliers based on customThresholds
    const bounds = customThresholds[colName] || { min: -Infinity, max: Infinity };
    const outliers = values.filter(v => v < bounds.min || v > bounds.max);
    const outlierCount = outliers.length;
    const outlierPercentage = Number(((outlierCount / totalRows) * 100).toFixed(1));

    // Generate 12-bin histogram data
    const binCount = 12;
    const range = max - min || 1.0;
    const binWidth = range / binCount;
    const bins = Array(binCount).fill(0);
    
    values.forEach(v => {
      let binIdx = Math.floor((v - min) / binWidth);
      if (binIdx >= binCount) binIdx = binCount - 1;
      if (binIdx < 0) binIdx = 0;
      bins[binIdx]++;
    });

    const maxBinValue = Math.max(...bins) || 1;
    const histogramBins = bins.map(count => ({
      count,
      heightPct: Math.max(8, Math.min(100, (count / maxBinValue) * 100))
    }));

    return {
      nullCount,
      nullPercentage,
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      mean,
      outlierCount,
      outlierPercentage,
      histogramBins
    };
  };

  const getCategoryProfile = (colName: string) => {
    if (!ingestedData) return null;
    const values = ingestedData
      .map(r => r[colName])
      .filter(v => v !== null && v !== undefined && v !== "");
    
    const totalRows = ingestedData.length;
    const nullCount = totalRows - values.length;
    const nullPercentage = Number(((nullCount / totalRows) * 100).toFixed(1));

    const counts: Record<string, number> = {};
    values.forEach(v => {
      const valStr = String(v);
      counts[valStr] = (counts[valStr] || 0) + 1;
    });

    const uniqueClasses = Object.keys(counts).length;
    const sortedCategories = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // top 3 classes

    return {
      nullCount,
      nullPercentage,
      uniqueClasses,
      sortedCategories,
      totalCount: values.length
    };
  };

  // Quick identification helper for columns
  const numericColumns = Object.entries(schema)
    .filter(([col, t]) => (t === "float" || t === "int") && !deletedColumns.includes(col))
    .map(([col]) => col);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-800 font-sans flex flex-col">
      {/* Worksheet selector modal if workbook is loaded */}
      {pendingWorkbook && availableSheets.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-lg border border-gray-250 shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="border-b border-gray-150 p-4 bg-slate-50/50">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider font-sans">
                PILIH LEMBAR KERJA (SELECT WORKSHEET)
              </h3>
              <p className="text-3xs text-gray-500 mt-0.5">
                File: <span className="font-mono text-[10px] font-semibold text-gray-700">{uploadedFileName}</span>
              </p>
            </div>
            
            <div className="p-4 space-y-3.5 max-h-[280px] overflow-y-auto">
              <p className="text-[11px] text-gray-600 leading-snug">
                Silakan pilih salah satu sheet dari spreadsheet Anda yang ingin diimpor dan dianalisis dalam modul sandbox:
              </p>
              
              <div className="space-y-1.5 font-sans">
                {availableSheets.map((sheet) => (
                  <button
                    key={sheet}
                    type="button"
                    onClick={() => handleSelectSheet(sheet)}
                    className="w-full text-left p-3 rounded-md border border-gray-200 hover:border-[#107C41] hover:bg-[#107C41]/5 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <span className="text-xs font-mono font-bold text-gray-800 group-hover:text-[#107C41] truncate">
                      {sheet}
                    </span>
                    <span className="text-[9.5px] font-sans font-medium text-gray-400 group-hover:text-[#107C41] shrink-0">
                      Pilih Sheet &rarr;
                    </span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t border-gray-100 p-3 bg-gray-50/60 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingWorkbook(null);
                  setAvailableSheets([]);
                  setUploadedFileName("");
                }}
                className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-3xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer"
              >
                Batal (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Navigation Header */}
      <header className="bg-white border-b border-[#E2E8F0] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#107C41] text-white p-2.5 rounded-lg flex items-center justify-center">
              <Star className="h-5 w-5 fill-white text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg tracking-tight">MGS Data Analytics</h1>
              <p className="text-2xs text-[#107C41] font-semibold tracking-wider uppercase">Human-In-The-Loop Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="tab-workspace"
              onClick={() => setActiveTab("workspace")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === "workspace"
                  ? "bg-[#107C41]/10 text-[#107C41]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Grid className="h-4 w-4" />
              <span>Workspace Applet</span>
            </button>
            <button
              id="tab-source"
              onClick={() => setActiveTab("source")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === "source"
                  ? "bg-[#107C41]/10 text-[#107C41]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Code className="h-4 w-4" />
              <span>Python Source Code</span>
            </button>


          </div>
        </div>

        {/* Sticky Modules Navigation Bar (Underneath Main Header) */}
        {rawData && activeTab === "workspace" && (
          <div className="bg-gray-50/95 backdrop-blur-md border-t border-[#E2E8F0] py-2 px-6 shadow-2xs">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setActiveModuleTab("module1")}
                className={`flex-1 py-2 px-3 text-2xs md:text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  activeModuleTab === "module1"
                    ? "bg-[#107C41] border-[#107C41] text-white shadow-xs font-extrabold"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Modul 1: Schema Ingestion & Validation</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModuleTab("module2")}
                className={`flex-1 py-2 px-3 text-2xs md:text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  activeModuleTab === "module2"
                    ? "bg-[#107C41] border-[#107C41] text-white shadow-xs font-extrabold"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Modul 2: Feature Engineering & Scaling</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModuleTab("module3")}
                className={`flex-1 py-2 px-3 text-2xs md:text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  activeModuleTab === "module3"
                    ? "bg-[#107C41] border-[#107C41] text-white shadow-xs font-extrabold"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>Modul 3: Dynamic Business EDA & Workbench</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModuleTab("module4")}
                className={`flex-1 py-2 px-3 text-2xs md:text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  activeModuleTab === "module4"
                    ? "bg-[#107C41]/90 border-[#107C41] text-white shadow-xs font-extrabold"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Brain className="h-4 w-4 text-emerald-500 group-hover:text-white" />
                <span>Modul 4: Data Science Sandbox</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Workspace Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        {activeTab === "source" ? (
          <div className="space-y-4">
            <div className="bg-[#107C41]/5 p-4 border border-[#107C41]/20 rounded-xl text-sm text-[#107C41] flex items-start gap-3">
              <Info className="h-5 w-5 shrink-0 mt-0.5 text-[#107C41]" />
              <div>
                <p className="font-semibold">Python Integration Codehouse</p>
                <p className="text-xs opacity-90 mt-1">
                  Export any modular data cleansing, distribution drift, or logical validation scripts directly to carry out data science tasks.
                </p>
              </div>
            </div>
            <SourceCodeExplorer />
          </div>
        ) : (
          <div className="space-y-6 transition-all duration-300">
            {/* Steps Progress Checklist */}
            {rawData && (
              <div className="bg-gray-50/70 border border-gray-200/80 p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-2xs shadow-3xs">
                <div className="flex items-center gap-1.5 font-bold text-[#107C41] uppercase tracking-widest font-mono select-none">
                  <TrendingUp className="h-4 w-4" />
                  <span>Pipeline Progression:</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-2 font-medium">
                    <div className={`h-2.5 w-2.5 rounded-full ${completedStep >= 1 ? "bg-[#107C41]" : "bg-gray-300 animate-pulse"}`} />
                    <span className={completedStep >= 1 ? "text-gray-900 font-bold" : "text-gray-400"}>1. Ingestion Validation</span>
                  </div>
                  <div className="hidden sm:block h-3.5 w-px bg-gray-200" />
                  <div className="flex items-center gap-2 font-medium">
                    <div className={`h-2.5 w-2.5 rounded-full ${completedStep >= 2 ? "bg-[#107C41]" : "bg-gray-300"}`} />
                    <span className={completedStep >= 2 ? "text-gray-900 font-bold" : "text-gray-400"}>2. Feature Engineering & Scaling</span>
                  </div>
                  <div className="hidden sm:block h-3.5 w-px bg-gray-200" />
                  <div className="flex items-center gap-2 font-medium">
                    <div className={`h-2.5 w-2.5 rounded-full ${completedStep >= 3 ? "bg-[#107C41]" : "bg-gray-300"}`} />
                    <span className={completedStep >= 3 ? "text-gray-900 font-bold" : "text-gray-400"}>3. Dynamic Business EDA (Post-Process)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Core Workspace Canvas */}
            <main className="space-y-4">
              {/* Tabular Schema Ingestion & Bounds Check Persistent Header for Module 1 & 2 */}
              {rawData && (
                <div style={{ display: (activeModuleTab === "module1" || activeModuleTab === "module2") ? "block" : "none" }}>
                  <section className="bg-white border border-[#E2E8F0] p-3.5 rounded-lg shadow-2xs space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-[#107C41]" />
                        <span>Module 1: Tabular Schema Ingestion & Bounds Check</span>
                      </h2>
                      <p className="text-3xs text-gray-500 mt-0.5">Validates data formats, tests composite primary keys uniqueness, and scans for out-of-bounds metrics.</p>
                    </div>
                  </div>

                  {/* Sandbox Parameter - Boundary Guards toggle block */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-3 rounded-lg border border-gray-200 gap-3">
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-[#107C41]" />
                      <div>
                        <span className="text-xs font-bold text-gray-800">Sandbox Boundary Guards</span>
                        <p className="text-3xs text-gray-500 mt-0.5">Enforce custom logical range constraints/rules on numerical columns dynamically.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSandboxParams(!showSandboxParams)}
                      className={`px-3 py-1.5 text-3xs font-extrabold rounded-md border transition-all cursor-pointer whitespace-nowrap self-stretch sm:self-auto text-center ${
                        showSandboxParams
                          ? "bg-[#107C41] text-white border-transparent shadow-xs"
                          : "bg-white text-gray-700 hover:bg-gray-100 border-gray-300"
                      }`}
                    >
                      {showSandboxParams ? "Sembunyikan Panel Batasan" : "Atur Batasan (Boundary Guards)"}
                    </button>
                  </div>

                  {showSandboxParams && (
                    <div className="bg-[#107C41]/5 p-3.5 rounded-lg border border-[#107C41]/10 space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-[#107C41]/15 pb-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-[#107C41]" />
                        <span className="text-3xs font-extrabold text-[#107C41] uppercase tracking-wider font-mono">Set threshold parameters</span>
                      </div>
                      {numericColumns.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {numericColumns.map(col => {
                            const bounds = customThresholds[col] || { min: 0, max: 100 };
                            return (
                              <div key={col} className="bg-white p-3 rounded-md border border-gray-200 space-y-1.5 shadow-3xs hover:border-[#107C41]/30 transition-all">
                                <span className="text-2xs font-extrabold text-gray-800 block font-mono capitalize truncate" title={col}>
                                  {col.replace(/_/g, " ")} Bounds
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-[9px] text-gray-400 block uppercase font-bold">Min Limit</span>
                                    <input
                                      type="number"
                                      value={bounds.min}
                                      onChange={(e) => {
                                        setCustomThresholds({
                                          ...customThresholds,
                                          [col]: { ...bounds, min: Number(e.target.value) }
                                        });
                                      }}
                                      className="w-full text-2xs px-2.5 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-[#107C41] focus:border-[#107C41] bg-gray-50 font-mono"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-gray-400 block uppercase font-bold">Max Limit</span>
                                    <input
                                      type="number"
                                      value={bounds.max}
                                      onChange={(e) => {
                                        setCustomThresholds({
                                          ...customThresholds,
                                          [col]: { ...bounds, max: Number(e.target.value) }
                                        });
                                      }}
                                      className="w-full text-2xs px-2.5 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-[#107C41] focus:border-[#107C41] bg-gray-50 font-mono"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-white rounded border border-gray-200 text-3xs text-gray-550 italic">
                          No numeric columns loaded yet. Try injecting some sample data.
                        </div>
                      )}
                    </div>
                  )}

                  {ingestionDiag && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div className="bg-[#FAFBFD] p-3 rounded-md border border-gray-200/80 flex flex-col justify-between">
                        <div>
                          <span className="text-3xs font-bold text-gray-400 block uppercase tracking-wider mb-1.5 font-mono">Integrity Health Score</span>
                          <span className="text-2xl font-extrabold text-[#107C41] font-mono leading-none">
                            {ingestionDiag.integrity_score}%
                          </span>
                        </div>
                        <div className="mt-2.5 border-t border-gray-100 pt-1.5 text-3xs">
                          <span className="text-gray-500">Classification Level: </span>
                          <span className="font-semibold text-gray-700">{ingestionDiag.rating}</span>
                        </div>
                      </div>

                      <div className="bg-[#FAFBFD] p-3 rounded-md border border-gray-200/80 space-y-2">
                        <span className="text-3xs font-bold text-gray-400 block uppercase tracking-wider font-mono">Estimated Deductions</span>
                        <div className="text-3xs space-y-1 font-mono">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Row Duplication Penalty:</span>
                            <span className="text-red-500 font-semibold shadow-3xs">-{ingestionDiag.penalties.duplicates}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Bounds Outliers Penalty:</span>
                            <span className="text-red-400">-{ingestionDiag.penalties.threshold_violations}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Format Mismatches:</span>
                            <span className="text-amber-500">-{ingestionDiag.penalties.type_mismatches}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#FAFBFD] p-3 rounded-md border border-gray-200/80 space-y-1.5">
                        <span className="text-3xs font-bold text-gray-400 block uppercase tracking-wider font-mono">Scan Counter Diagnostics</span>
                        <div className="text-3xs space-y-1 font-mono">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Verified Rows:</span>
                            <span className="text-gray-700 font-semibold">{rawData.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Composite Key Overlaps:</span>
                            <span className="text-red-400 font-semibold">{ingestionDiag.counts.duplicate_records}</span>
                          </div>
                          {ingestionDiag.counts.exact_row_duplicates !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Exact Row Duplicates:</span>
                              <span className="text-red-400 font-semibold">{ingestionDiag.counts.exact_row_duplicates}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Out-Of-Bounds Violations:</span>
                            <span className="text-red-500 font-bold">{ingestionDiag.counts.threshold_violations_count}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {ingestionDiag && (
                    <div className="bg-amber-50/20 border border-amber-200/60 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-amber-200/40">
                        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-amber-900 block font-mono">
                            Ingestion Validation Alerts: Tabular Quality Violations
                          </span>
                          <span className="text-[10px] text-amber-700 font-sans block">
                            Pendeteksian anomali yang difokuskan pada 4 pilar integritas data (Completeness, Uniqueness, Validity, Conformity):
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {["Completeness", "Uniqueness", "Validity", "Conformity"].map((pillar) => {
                          const pillarWarnings = (ingestionDiag.warnings || []).filter(w => 
                            w.toLowerCase().includes(pillar.toLowerCase())
                          );
                          const hasIssue = pillarWarnings.length > 0;
                          return (
                            <div 
                              key={pillar} 
                              className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                                hasIssue 
                                  ? "bg-amber-50/50 border-amber-250/60" 
                                  : "bg-emerald-50/20 border-emerald-100/50"
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span className={`text-[10px] font-bold font-mono tracking-wider uppercase ${hasIssue ? "text-amber-800" : "text-emerald-800"}`}>
                                  {pillar} Check
                                </span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase font-mono ${
                                  hasIssue ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                }`}>
                                  {hasIssue ? "ALERT" : "PASSED"}
                                </span>
                              </div>
                              <div className="text-[10px] leading-relaxed mt-1 font-mono">
                                {hasIssue ? (
                                  pillarWarnings.map((err, idx) => (
                                    <div key={idx} className="text-amber-900 font-medium">
                                      • {err.substring(err.indexOf("]") + 1).trim()}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-emerald-700/80">Kondisi data memenuhi seluruh prasyarat pilar integritas.</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

              {/* Step A: Data Ingest Seeding - Only shown in Module 1 */}
              <div style={{ display: activeModuleTab === "module1" ? "block" : "none" }}>
                <section className="bg-white border border-[#E2E8F0] p-3.5 rounded-lg shadow-2xs space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-[#107C41]" />
                        <span>Seeding dataset feeds</span>
                      </h2>
                      <p className="text-3xs text-gray-500 mt-0.5">Upload our structured spreadsheet template or ingest your own custom Microsoft Excel or CSV analytical files.</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        id="btn-generate-synthetic"
                        onClick={handleGenerateData}
                        className="bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-300 text-3xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-3xs"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Inject Customer Sample Dataset</span>
                      </button>
                      <label className="bg-[#107C41] hover:bg-[#0b592e] text-white text-3xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-3xs">
                        <Upload className="h-3 w-3" />
                        <span>Upload Excel / CSV (.xlsx/.xls/.csv)</span>
                        <input
                          id="file-excel-upload"
                          type="file"
                          accept=".xlsx, .xls, .csv"
                          className="hidden"
                          onChange={handleExcelUpload}
                        />
                      </label>
                    </div>
                  </div>

                  {rawData && rawData.length > 0 && (
                    <div className="bg-gray-50/50 rounded-lg border border-gray-100 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-bold text-gray-400 uppercase tracking-widest font-mono">
                          Active Dataset Preview (Loaded: {rawData.length} rows)
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500 bg-gray-100 font-mono">
                              {Object.keys(rawData[0]).map(col => (
                                <th key={col} className="p-2 truncate capitalize">{col.replace(/_/g, " ")}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rawData.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="border-b border-gray-100 font-mono hover:bg-gray-50">
                                {Object.keys(row).map(col => {
                                  const val = row[col];
                                  const isNum = typeof val === "number";
                                  return (
                                    <td 
                                      key={col} 
                                      className={`p-2 ${
                                        val === null ? "text-gray-400 italic font-normal" : isNum ? "text-emerald-700 font-medium" : "text-gray-700"
                                      }`}
                                    >
                                      {val === null || val === undefined ? "NaN" : String(val)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-3xs text-gray-550 font-medium">Showing top 5 rows. Injected dataset has random null entries, decimals on count labels, and outliers to evaluate cleansing routines.</p>
                    </div>
                  )}
                </section>
              </div>

              {/* Module 2: Cleansing & Imputations */}
              {rawData && ingestedData && (
                <div style={{ display: activeModuleTab === "module2" ? "block" : "none" }}>
                  <section className="bg-white border border-[#E2E8F0] p-3.5 rounded-lg shadow-2xs space-y-3.5">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <SlidersHorizontal className="h-4 w-4 text-[#107C41]" />
                      <span>Module 2: Imputation Tools, Outliers Treatment & Scaler</span>
                    </h2>
                    <p className="text-3xs text-gray-500 mt-0.5">Impute omissions seamlessly, handle mathematical extremes, and convert parameters scopes.</p>
                  </div>

                  {/* Row Duplicates Handling Quick Check & Erase Tool */}
                  <div className={`border p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300 ${
                    duplicateCleared 
                      ? "bg-emerald-50/20 border-emerald-200" 
                      : "bg-red-50/20 border-red-200"
                  }`}>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5 font-mono">
                        {duplicateCleared ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
                        )}
                        <span>Row Duplication Management & Unique Resolution</span>
                      </h3>
                      <p className="text-3xs text-gray-650 leading-relaxed max-w-2xl">
                        {duplicateCleared ? (
                          <>
                            Dataset cleaning successful! A total of <b className="text-emerald-700 font-mono">{deletedDuplicatesCount}</b> duplicate rows have been permanently removed. The dataset is now clean with <span className="font-bold text-emerald-700 font-mono">0</span> detected duplicates, optimization of integrity scores, and ingestion performance is maxed out.
                          </>
                        ) : (
                          <>
                            Detected a total of <b className="text-red-600 font-mono">{(ingestionDiag?.counts.exact_row_duplicates || 0) + (ingestionDiag?.counts.duplicate_records || 0)}</b> duplicates (<span className="font-bold text-red-600 font-mono">{ingestionDiag?.counts.exact_row_duplicates || 0}</span> exact duplicate rows and <span className="font-bold text-red-600 font-mono">{ingestionDiag?.counts.duplicate_records || 0}</span> composite key overlaps). Click the action button to remove duplicates and guarantee row level integrity.
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      id="btn-delete-duplicates"
                      type="button"
                      onClick={handleDeleteDuplicates}
                      disabled={duplicateCleared || ((ingestionDiag?.counts.exact_row_duplicates || 0) + (ingestionDiag?.counts.duplicate_records || 0)) === 0}
                      className={`text-3xs font-extrabold px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 select-none self-stretch sm:self-auto text-center justify-center whitespace-nowrap cursor-pointer uppercase font-mono tracking-wider ${
                        duplicateCleared
                          ? "bg-emerald-600 text-white border border-transparent cursor-not-allowed opacity-90"
                          : ((ingestionDiag?.counts.exact_row_duplicates || 0) + (ingestionDiag?.counts.duplicate_records || 0)) > 0
                            ? "bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg active:scale-95"
                            : "bg-gray-100 text-gray-400 border border-gray-250 cursor-not-allowed opacity-80"
                      }`}
                    >
                      {duplicateCleared ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Duplicates Cleaned Successfully</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove Duplicates</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* UNIFIED COLUMNS WORKSPACE PANEL: VISUALIZATION & DATA ENGINEERING */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs mt-1 bg-white">
                    <button
                      type="button"
                      onClick={() => setShowSpecificMethods(!showSpecificMethods)}
                      className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/90 transition-colors cursor-pointer text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <div className="bg-[#107C41]/10 p-1.5 rounded-md shrink-0">
                          <SlidersHorizontal className="h-4 w-4 text-[#107C41]" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-xs font-mono">
                            Column Quality Preset Configurator
                          </h3>
                          <p className="text-3xs text-gray-500 mt-0.5">Analyze dataset attributes and customize individual feature cleansing rules directly.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-3xs font-extrabold text-[#107C41] bg-[#107C41]/10 px-2 py-0.5 rounded font-mono">
                          {showSpecificMethods ? "HIDE" : "SHOW"}
                        </span>
                        {showSpecificMethods ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                      </div>
                    </button>

                    {showSpecificMethods && (
                      <div className="p-3.5 bg-white border-t border-gray-150 space-y-3.5">
                        <p className="text-2xs text-gray-600 leading-relaxed pl-1">
                          Select a column from the dropdown menu to view live quality statistics and customize feature engineering rules (such as missing values imputation, normalization scaling, and outlier handling).
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left Panel: Dropdown Selector & Exclude Control */}
                          <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-200 space-y-3 flex flex-col justify-center">
                            <label htmlFor="feature-col-dropdown" className="text-3xs font-extrabold text-[#107C41] uppercase tracking-wider font-mono block">
                              SELECT PRIMARY VARIABLE / FEATURE COLUMN
                            </label>
                            
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                id="feature-col-dropdown"
                                value={selectedConfigCol}
                                onChange={(e) => {
                                  setSelectedConfigCol(e.target.value);
                                }}
                                className="flex-1 text-2xs font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 hover:border-[#107C41] focus:ring-1 focus:ring-[#107C41] capitalize cursor-pointer focus:outline-none"
                              >
                                <option value="">-- Select Feature Column --</option>
                                {Object.keys(schema).map((colName) => {
                                  const colType = schema[colName];
                                  const isDel = deletedColumns.includes(colName);
                                  const isConfigurable = colType === "float" || colType === "int";
                                  const labelType = isConfigurable ? "numeric" : colType;
                                  return (
                                    <option key={colName} value={colName}>
                                      {colName.replace(/_/g, " ")} ({labelType}){isDel ? " [EXCLUDED]" : ""}
                                    </option>
                                  );
                                })}
                              </select>

                              {selectedConfigCol && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const isDel = deletedColumns.includes(selectedConfigCol);
                                    let nextDeleted: string[] = [];
                                    if (isDel) {
                                      nextDeleted = deletedColumns.filter(c => c !== selectedConfigCol);
                                      setDeletedColumns(nextDeleted);
                                    } else {
                                      nextDeleted = [...deletedColumns, selectedConfigCol];
                                      setDeletedColumns(nextDeleted);
                                      setSelectedConfigCol("");
                                    }
                                    
                                    // Instantly update the pipeline downstream (EDA, Sandbox, Ingestion scores)
                                    setTimeout(() => {
                                      triggerPipelineUpdate(nextDeleted, columnConfigs);
                                    }, 0);
                                  }}
                                  className={`px-3 py-2 text-3xs font-extrabold uppercase rounded-lg font-mono transition-all border flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                                    deletedColumns.includes(selectedConfigCol)
                                      ? "border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                      : "border-red-300 text-red-600 hover:bg-red-50 bg-white"
                                  }`}
                                >
                                  {deletedColumns.includes(selectedConfigCol) ? (
                                    <>
                                      <RefreshCw className="h-3 w-3" />
                                      <span>Restore Column</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-3 w-3" />
                                      <span>Exclude Column</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            
                            {selectedConfigCol && deletedColumns.includes(selectedConfigCol) && (
                              <p className="text-[10px] text-amber-600 font-sans italic leading-tight">
                                This column is excluded from the active data pipeline. Click "Restore Column" to include it again.
                              </p>
                            )}

                            {/* Data Type Converter Options Container */}
                            {selectedConfigCol && !deletedColumns.includes(selectedConfigCol) && (
                              <div className="pt-2 border-t border-gray-200 mt-2 space-y-2">
                                <div className="flex items-center gap-1.5 justify-between">
                                  <span className="text-[10px] font-bold text-[#107C41] uppercase tracking-wider font-mono block">
                                    DATA TYPE CONVERTER (CONVERTER DATA)
                                  </span>
                                  <span className="text-[9px] text-[#107C41] font-mono bg-[#107C41]/15 px-2 py-0.5 rounded font-bold">
                                    Dua Arah / Bi-directional
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-gray-550 leading-snug">
                                  Convert the values of <code className="font-bold text-gray-800 font-mono bg-gray-200/65 px-1 py-0.5 rounded text-4xs">[{selectedConfigCol.replace(/_/g, " ")}]</code>. Bagus sekali untuk merujuk data numerik/epoch mentah kembali menjadi tipe data tanggal (Date/Time) murninya.
                                </p>
                                
                                <div className="grid grid-cols-2 gap-1.5 pt-1">
                                  {[
                                    { label: "Date / Time", type: "datetime", desc: "For epoch / raw Excel serial dates" },
                                    { label: "Integer (Int)", type: "int", desc: "For whole-numbered records" },
                                    { label: "Decimal (Float)", type: "float", desc: "For fractional real numbers" },
                                    { label: "Text / Class", type: "category", desc: "For category & qualitative data" }
                                  ].map((opt) => {
                                    const currentType = schema[selectedConfigCol];
                                    const isCurrent = currentType === opt.type;
                                    
                                    return (
                                      <button
                                        key={opt.type}
                                        type="button"
                                        onClick={() => handleConvertColumnType(selectedConfigCol, opt.type as any)}
                                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between h-[52px] select-none ${
                                          isCurrent 
                                            ? "border-[#107C41] bg-[#107C41]/5 text-[#107C41] ring-1 ring-[#107C41]" 
                                            : "border-gray-200 bg-white hover:bg-gray-50/80 text-gray-700"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          <span className="text-[10.5px] font-bold font-mono truncate leading-none">
                                            {opt.label}
                                          </span>
                                          {isCurrent && (
                                            <span className="text-[8px] font-extrabold uppercase font-mono bg-[#107C41] text-white px-1 py-0.2 rounded scale-90 leading-none">
                                              Active
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[8px] text-gray-400 line-clamp-2 leading-tight w-full block mt-0.5">
                                          {opt.desc}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right Panel: Compact Column Profile Stats & Small, Simple Visualization */}
                          <div className="bg-white p-4 rounded-xl border border-gray-150 min-h-[90px] flex flex-col justify-between">
                            {selectedConfigCol ? (
                              (() => {
                                const colType = schema[selectedConfigCol];
                                const isDeleted = deletedColumns.includes(selectedConfigCol);
                                const isConfigurable = colType === "float" || colType === "int";

                                if (isDeleted) {
                                  return (
                                    <div className="h-full flex flex-col justify-center items-center text-center py-2">
                                      <div className="text-3xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-500 uppercase font-mono tracking-wider mb-1">
                                        Status: Dikecualikan
                                      </div>
                                      <span className="text-[10px] text-gray-400 font-sans italic">Data kolom diabaikan dan tidak dimasukkan ke dalam model EDA.</span>
                                    </div>
                                  );
                                }

                                // Metrics details & tiny distribution box
                                let infoNode = null;
                                let tinyVisualizer = null;

                                if (isConfigurable) {
                                  const profile = getPreEngineeringColumnProfile(selectedConfigCol);
                                  if (profile) {
                                    infoNode = (
                                      <div className="text-[10px] text-gray-500 font-mono grid grid-cols-2 gap-x-3 gap-y-1">
                                        <div className="flex justify-between border-b border-gray-50 pb-0.5">
                                          <span className="text-gray-400">Kelengkapan:</span>
                                          <span className={profile.nullCount > 0 ? "text-amber-600 font-bold" : "text-[#107C41] font-bold"}>
                                            {Math.round(100 - profile.nullPercentage)}%
                                          </span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-50 pb-0.5">
                                          <span className="text-gray-400">Pencilan (Outlier):</span>
                                          <span className={profile.outlierCount > 0 ? "text-red-500 font-bold" : "text-gray-500"}>
                                            {profile.outlierCount} ({profile.outlierPercentage}%)
                                          </span>
                                        </div>
                                        <div className="flex justify-between col-span-2">
                                          <span className="text-gray-400">Rentang Entri Awal:</span>
                                          <span className="text-gray-750 font-semibold truncate">[{profile.min} .. {profile.max}]</span>
                                        </div>
                                      </div>
                                    );

                                    tinyVisualizer = (
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Visual Sebaran</span>
                                        <div className="h-5 flex items-end justify-between gap-0.5 px-0.5 bg-gray-50 rounded border border-gray-150/40 pb-0.5 w-[140px]">
                                          {profile.histogramBins.map((bin, bIdx) => {
                                            let isOutlierPeak = false;
                                            if (profile.outlierCount > 0) {
                                              if (selectedConfigCol === "purchase_amount" && (bIdx === 0 || bIdx === 11)) {
                                                isOutlierPeak = true;
                                              }
                                              if (selectedConfigCol === "visit_duration" && (bIdx === 0 || bIdx === 11)) {
                                                isOutlierPeak = true;
                                              }
                                            }
                                            return (
                                              <div key={bIdx} className="flex-1 flex justify-center items-end h-full">
                                                <div
                                                  style={{ height: `${bin.heightPct}%` }}
                                                  className={`w-full ${isOutlierPeak ? "bg-red-400/80" : "bg-[#107C41]/35"} rounded-t-[1px]`}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  }
                                } else if (colType === "category") {
                                  const catProfile = getCategoryProfile(selectedConfigCol);
                                  if (catProfile) {
                                    infoNode = (
                                      <div className="text-[10px] text-gray-500 font-mono space-y-1">
                                        <div className="flex justify-between">
                                          <span className="text-gray-400">Total Unique:</span>
                                          <span className="text-[#107C41] font-bold">{catProfile.uniqueClasses} Classes</span>
                                        </div>
                                        <div className="text-[9px] text-gray-400 italic">Categorical columns do not require quantitative scaling.</div>
                                      </div>
                                    );

                                    tinyVisualizer = (
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Majority Frequency</span>
                                        <div className="space-y-1 max-w-[200px]">
                                          {catProfile.sortedCategories.slice(0, 2).map(([catName, cnt]) => {
                                            const share = catProfile.totalCount ? Math.round((cnt / catProfile.totalCount) * 100) : 0;
                                            return (
                                              <div key={catName} className="space-y-0.5">
                                                <div className="flex justify-between text-[8px] font-mono text-gray-500 leading-none">
                                                  <span className="truncate max-w-[80px]">{catName}</span>
                                                  <span>{share}%</span>
                                                </div>
                                                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                                                  <div className="h-full bg-blue-400/40 rounded-full" style={{ width: `${share}%` }} />
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  }
                                } else if (colType === "datetime") {
                                  infoNode = (
                                    <div className="text-[10px] text-gray-500 font-mono space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Sifat Data:</span>
                                        <span className="text-purple-600 font-bold">Waktu & Tanggal</span>
                                      </div>
                                      <div className="text-[9px] text-gray-400 italic">Sumbu urutan longitudinal otomatis.</div>
                                    </div>
                                  );

                                  tinyVisualizer = (
                                    <div className="text-center p-1 bg-gray-50 rounded border border-gray-150/40 text-[8px] text-gray-400 font-mono w-[140px]">
                                      Sumbu Runtun Waktu
                                    </div>
                                  );
                                }

                                return (
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 h-full">
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-2xs font-extrabold text-gray-850 capitalize font-mono leading-none">
                                          {selectedConfigCol.replace(/_/g, " ")}
                                        </span>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold uppercase font-mono tracking-wider ${
                                          colType === "category" ? "bg-blue-50 text-blue-700" :
                                          colType === "datetime" ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-800"
                                        }`}>
                                          {colType}
                                        </span>
                                      </div>
                                      
                                      <div className="pt-1">
                                        {infoNode}
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex items-center justify-end sm:border-l border-gray-100 sm:pl-3 min-w-[150px]">
                                      {tinyVisualizer}
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="h-full flex items-center justify-center text-center py-4 text-gray-400 text-3xs italic font-sans">
                                Select a column in the left panel to display visual summaries & engineering rules.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RENDER INLINE STRATEGY FORM DIRECTLY BELOW THE SELECTOR FOR MAXIMUM SIMPLICITY */}
                        {selectedConfigCol && columnConfigs[selectedConfigCol] && !deletedColumns.includes(selectedConfigCol) && (
                          <div className="bg-[#107C41]/5 rounded-xl p-5 border border-[#107C41]/15 space-y-4 shadow-3xs animate-fade-in mt-4 border-t border-[#107C41]/20">
                            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#107C41]/10">
                              <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4.5 w-4.5 text-[#107C41]" />
                                <h4 className="text-xs font-bold text-gray-900 leading-none">
                                  Feature Engineering Configuration: <span className="capitalize text-[#107C41] font-mono">"{selectedConfigCol.replace(/_/g, " ")}"</span>
                                </h4>
                              </div>
                              <span className="text-[9px] font-mono bg-[#107C41]/10 text-[#107C41] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                Local Configurations
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              
                              {/* 1. IMPUTATION */}
                              <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-3xs space-y-2">
                                <label className="text-3xs font-extrabold text-gray-700 block uppercase tracking-wider">
                                  1. Missing Values Imputation
                                </label>
                                <select
                                  value={columnConfigs[selectedConfigCol].imputeStrategy}
                                  onChange={(e) => {
                                    const updated = { ...columnConfigs };
                                    updated[selectedConfigCol] = {
                                      ...updated[selectedConfigCol],
                                      imputeStrategy: e.target.value as any
                                    };
                                    setColumnConfigs(updated);
                                    setTimeout(() => triggerPipelineUpdate(deletedColumns, updated), 0);
                                  }}
                                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
                                >
                                  <option value="interpolate">Linear Interpolation</option>
                                  <option value="mean">Arithmetic Mean</option>
                                  <option value="median">Distribution Median</option>
                                  <option value="ffill">Forward Fill (ffill)</option>
                                </select>
                                <p className="text-[10px] text-gray-400 leading-snug">
                                  Impute and fill empty cells using mathematical strategies.
                                </p>
                              </div>

                              {/* 2. FORMAT ANOMALIES */}
                              <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-3xs space-y-2">
                                <label className="text-3xs font-extrabold text-gray-750 block uppercase tracking-wider">
                                  2. Format Anomalies Handling
                                </label>
                                <select
                                  value={columnConfigs[selectedConfigCol].invalidFormatAction}
                                  onChange={(e) => {
                                    const updated = { ...columnConfigs };
                                    updated[selectedConfigCol] = {
                                      ...updated[selectedConfigCol],
                                      invalidFormatAction: e.target.value as any
                                    };
                                    setColumnConfigs(updated);
                                    setTimeout(() => triggerPipelineUpdate(deletedColumns, updated), 0);
                                  }}
                                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white bg-amber-50/20 text-amber-900 border-amber-300/60 font-medium"
                                >
                                  <option value="extract_numeric">Salvage (Extract numbers & strip non-digit characters)</option>
                                  <option value="coerce_impute">Coerce to Null (Enforce value as null & impute)</option>
                                </select>
                                <p className="text-[10px] text-gray-400 leading-snug">
                                  Triggered when invalid non-numeric formats (e.g., <code>"180.50_USD"</code>, <code>"4_PCS"</code>) are found in numerical dimensions.
                                </p>
                              </div>

                              {/* 3. SCALING AND NORMALIZATION */}
                              <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-3xs space-y-2">
                                <label className="text-3xs font-extrabold text-gray-700 block uppercase tracking-wider">
                                  3. Standard Scale & Normalization (Scaling)
                                </label>
                                <select
                                  value={columnConfigs[selectedConfigCol].scalingStrategy}
                                  onChange={(e) => {
                                    const updated = { ...columnConfigs };
                                    updated[selectedConfigCol] = {
                                      ...updated[selectedConfigCol],
                                      scalingStrategy: e.target.value as any
                                    };
                                    setColumnConfigs(updated);
                                    setTimeout(() => triggerPipelineUpdate(deletedColumns, updated), 0);
                                  }}
                                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
                                >
                                  <option value="standard">StandardScaler (Mean=0, StdDev=1)</option>
                                  <option value="minmax">MinMaxScaler (Bound interval to 0..1)</option>
                                  <option value="none">Raw Scale (No Scaling - Keep Original)</option>
                                </select>
                                <p className="text-[10px] text-gray-400 leading-snug">
                                  Balances distribution intervals to facilitate comparative statistical modeling & training.
                                </p>
                              </div>

                            </div>

                            {/* OUTLIERS TREATMENT ZONE */}
                            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-3xs grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-gray-100">
                              
                              <div className="space-y-1">
                                <label className="text-3xs font-extrabold text-gray-700 block uppercase tracking-wider">
                                  4. Outlier Detection Formula
                                </label>
                                <select
                                  value={columnConfigs[selectedConfigCol].outlierStrategy}
                                  onChange={(e) => {
                                    const updated = { ...columnConfigs };
                                    updated[selectedConfigCol] = {
                                      ...updated[selectedConfigCol],
                                      outlierStrategy: e.target.value as any
                                    };
                                    setColumnConfigs(updated);
                                    setTimeout(() => triggerPipelineUpdate(deletedColumns, updated), 0);
                                  }}
                                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
                                >
                                  <option value="iqr">Interquartile Range (Boxplot IQR)</option>
                                  <option value="zscore">Standard Z-Score (Normal Gaussian)</option>
                                </select>
                                <p className="text-[10px] text-gray-400 leading-normal">
                                  IQR is highly robust against skewness, while Z-Score assumes a standard Gaussian distribution.
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-3xs font-extrabold text-gray-700 block uppercase tracking-wider">
                                  5. Outlier Sensitivity Threshold
                                </label>
                                <input
                                  type="range"
                                  min="1"
                                  max="3.5"
                                  step="0.1"
                                  value={columnConfigs[selectedConfigCol].outlierThreshold}
                                  onChange={(e) => {
                                    const updated = { ...columnConfigs };
                                    updated[selectedConfigCol] = {
                                      ...updated[selectedConfigCol],
                                      outlierThreshold: Number(e.target.value)
                                    };
                                    setColumnConfigs(updated);
                                    setTimeout(() => triggerPipelineUpdate(deletedColumns, updated), 0);
                                  }}
                                  className="w-full mt-2 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#107C41]"
                                />
                                <div className="flex justify-between items-center text-[10px] text-gray-550 mt-1 font-mono">
                                  <span>Strict (Narrow)</span>
                                  <span className="font-bold text-[#107C41] bg-[#107C41]/10 px-2 py-0.5 rounded">Multiplier: {columnConfigs[selectedConfigCol].outlierThreshold}x</span>
                                  <span>Loose (Wide)</span>
                                </div>
                              </div>

                              <div className="space-y-1 select-none">
                                <label className="text-3xs font-extrabold text-gray-750 block uppercase tracking-wider">
                                  6. Outlier Mitigation Action
                                </label>
                                <div className="flex flex-col gap-1">
                                  {[
                                    { key: "cap", title: "Winsorize / Capping (Truncate values to safe boundaries)" },
                                    { key: "nullify", title: "Coerce to Null & Impute (Replace with null & impute)" },
                                    { key: "remove", title: "Remove Rows Completely (Discard outlier rows)" }
                                  ].map((opt) => {
                                    const isSel = columnConfigs[selectedConfigCol].outlierAction === opt.key;
                                    return (
                                      <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => {
                                          const updated = { ...columnConfigs };
                                          updated[selectedConfigCol] = {
                                            ...updated[selectedConfigCol],
                                            outlierAction: opt.key as any
                                          };
                                          setColumnConfigs(updated);
                                          setTimeout(() => triggerPipelineUpdate(deletedColumns, updated), 0);
                                        }}
                                        className={`text-left text-[10px] p-2 rounded border font-medium transition-all cursor-pointer ${
                                          isSel
                                            ? "bg-[#107C41]/15 text-[#107C41] border-[#107C41]"
                                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                      >
                                        {opt.title}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                            </div>

                            {/* DYNAMIC RULES TRIGGER TO DIRECTLY EXECUTE PIPELINE & UPDATE HEALTH SCORES INLINE */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#107C41]/15 mt-3">
                              <div className="text-3xs text-gray-500 font-sans flex items-center gap-1.5 font-medium">
                                <ShieldCheck className="h-4 w-4 text-[#107C41] shrink-0" />
                                <span>Terapkan konfigurasi aturan kolom ini langsung untuk memperbarui metrik kualitas pembersihan.</span>
                              </div>
                              <button
                                type="button"
                                onClick={handleRunEngineering}
                                className="bg-[#107C41] hover:bg-[#0b592e] text-white text-xs px-5 py-2.5 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#107C41]/40 w-full sm:w-auto justify-center uppercase font-mono min-w-[240px]"
                              >
                                {isEngineering ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    <span>Running Pipeline...</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-3 w-3 fill-white" />
                                    <span>Execute Aturan Kolom "{selectedConfigCol.replace(/_/g, " ")}"</span>
                                  </>
                                )}
                              </button>
                            </div>

                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-gray-100 pt-4">
                    <div className="text-xs text-gray-500 flex items-center gap-1.5 font-sans">
                      <ShieldCheck className="h-4 w-4 text-[#107C41] shrink-0" />
                      <span>Semua perubahan preferensi per kolom disimpan secara dinamis dalam real-time state.</span>
                    </div>
                  </div>

                  {engineeringDiag && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-[#FAFBFD] p-5 rounded-lg border border-gray-200/80">
                          <span className="text-3xs font-bold text-gray-400 block uppercase tracking-wider mb-2 font-mono">Cleansing Quality Score</span>
                          <span className="text-3xl font-extrabold text-[#107C41] font-mono leading-none">
                            {engineeringDiag.engineering_health_score}%
                          </span>
                          <div className="mt-4 border-t border-gray-100 pt-2 text-xs text-gray-500">
                            Status: <span className="font-semibold text-gray-700">{engineeringDiag.rating}</span>
                          </div>
                        </div>

                        <div className="bg-[#FAFBFD] p-5 rounded-lg border border-gray-200/80 flex flex-col justify-between">
                          <div>
                            <span className="text-3xs font-bold text-gray-400 block uppercase tracking-wider mb-1 font-mono">Dataset Completeness</span>
                            <span className="text-2xl font-bold text-[#107C41] font-mono">
                              {engineeringDiag.completeness_score}%
                            </span>
                          </div>
                          <p className="text-3xs text-gray-500 leading-relaxed font-sans">Seluruh sel kosong diselesaikan menggunakan konfigurasi spesifik per kolom.</p>
                        </div>

                        <div className="bg-[#FAFBFD] p-5 rounded-lg border border-gray-200/80 flex flex-col justify-between">
                          <div>
                            <span className="text-3xs font-bold text-gray-400 block uppercase tracking-wider mb-1 font-mono">Distribution Consistency</span>
                            <span className="text-2xl font-bold text-[#107C41] font-mono">
                              {engineeringDiag.distribution_consistency_score}%
                            </span>
                          </div>
                          <p className="text-3xs text-gray-500 leading-relaxed font-sans font-medium">Kolmogorov-Smirnov evaluation delta checked.</p>
                        </div>
                      </div>

                      {/* Line graph comparing original and scaled values */}
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-widest font-mono">
                            Comparison metrics: {activeChartCol}
                          </span>
                          
                          <div className="flex flex-wrap gap-1">
                            {numericColumns.map(col => (
                              <button
                                key={col}
                                onClick={() => setActiveChartCol(col)}
                                className={`text-3xs px-2 py-1 rounded transition-all italic font-mono cursor-pointer capitalize ${
                                  activeChartCol === col
                                    ? "bg-[#107C41] text-white"
                                    : "bg-white hover:bg-gray-100 border text-gray-600"
                                }`}
                              >
                                {col.replace(/_/g, " ")}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Interactive bar lines comparing output heights */}
                        <div className="h-44 flex items-end justify-between gap-0.5 border-b border-l border-gray-350 pb-1 pl-1 bg-white relative">
                          <div className="absolute top-2 left-2 text-3xs font-mono text-gray-400 uppercase tracking-wider">Sequence Trace comparison</div>
                          
                          {engineeredData && engineeredData.slice(0, 75).map((row, idx) => {
                            const val = row[activeChartCol];
                            const rawRow = rawData[idx];
                            const rawVal = rawRow ? rawRow[activeChartCol] : null;

                            const heightFactor = 90;
                            let normH = 10;
                            
                            const validValues = ingestedData.map(r => Number(r[activeChartCol])).filter(v => !isNaN(v) && v !== null);
                            const minVal = validValues.length ? Math.min(...validValues) : 0;
                            const maxVal = validValues.length ? Math.max(...validValues) : 100;
                            const range = maxVal - minVal || 1.0;

                            if (val !== null && val !== undefined) {
                             const colScaling = columnConfigs[activeChartCol]?.scalingStrategy || "none";
                             const calculatedVal = colScaling !== "none" ? (Number(val) * range + minVal) : Number(val);
                              normH = Math.max(10, Math.min(100, ((calculatedVal - minVal) / range) * heightFactor));
                            }

                            // Flag highlight of extreme outlier values before cleaning
                            const bounds = customThresholds[activeChartCol] || { min: -999, max: 99999 };
                            const isOutlier = rawVal !== null && rawVal !== undefined && (Number(rawVal) < bounds.min || Number(rawVal) > bounds.max);

                            return (
                              <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                                <div
                                  style={{ height: `${normH}%` }}
                                  className={`w-full ${isOutlier ? "bg-red-500/85 hover:bg-red-600" : "bg-[#107C41]/70 hover:bg-[#107C41]"} transition-all`}
                                />
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded p-1.5 text-3xs font-mono z-50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                                  <div>Cleaned (Scaled): {val !== null && val !== undefined ? String(val) : "NaN"}</div>
                                  <div>Original: {rawVal !== null && rawVal !== undefined ? String(rawVal) : "NaN"}</div>
                                  <div>Row index: {idx}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center text-3xs text-gray-550 font-mono mt-1.5 px-1">
                          <span>Row 0 (Starts June 1st)</span>
                          <span className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 bg-[#107C41]/75 rounded-xs" /> Clean Processed Value
                            <span className="inline-block h-2.5 w-2.5 bg-red-400 rounded-xs" /> Dynamic Out-of-Bounds Outlier
                          </span>
                          <span>Row 75</span>
                        </div>
                      </div>

                      {/* Statistical warnings and alerts log panel */}
                      {engineeringDiag.warnings.length > 0 && (
                        <div className="bg-red-50/70 border border-red-200/60 p-4 rounded-xl space-y-2">
                          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-red-100">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <span className="text-xs font-bold text-red-900 uppercase tracking-wider font-mono">Statistical Deviation Alerts</span>
                            </div>
                            <span className="text-[9px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded font-mono">
                              {engineeringDiag.warnings.length} Alerts
                            </span>
                          </div>
                          <ul className="text-xs text-red-800 space-y-1 pl-4 list-disc font-mono leading-relaxed">
                            {(showAllEngWarnings ? engineeringDiag.warnings : engineeringDiag.warnings.slice(0, 5)).map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                          {engineeringDiag.warnings.length > 5 && (
                            <div className="pt-1.5 border-t border-red-100 flex">
                              <button
                                type="button"
                                onClick={() => setShowAllEngWarnings(!showAllEngWarnings)}
                                className="text-[10px] text-red-700 font-bold hover:text-red-900 hover:underline cursor-pointer transition-colors inline-flex items-center gap-1 font-mono focus:outline-none"
                              >
                                {showAllEngWarnings ? (
                                  <>Sembunyikan ({engineeringDiag.warnings.length - 5} Alerts)</>
                                ) : (
                                  <>Baca Selengkapnya (+{engineeringDiag.warnings.length - 5} Alerts Lagi)</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

              {/* Module 3: Dynamic Business EDA & Analytics */}
              {rawData && engineeredData && (
                <div style={{ display: activeModuleTab === "module3" ? "block" : "none" }}>
                  <section className="bg-white border border-[#E2E8F0] p-3.5 rounded-lg shadow-2xs space-y-3.5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-[#107C41]" />
                        <span>Module 3: Dynamic Business EDA & Correlation Analysis</span>
                      </h2>
                      <p className="text-3xs text-gray-500 mt-0.5">Defines feature alignments, triggers correlation engines, and produces automated insights.</p>
                    </div>

                    <button
                      id="btn-run-eda"
                      onClick={handleRunEda}
                      className="bg-[#107C41] hover:bg-[#0b592e] text-[#FAFBFD] text-3xs px-4 py-2 rounded-md font-bold tracking-wide transition-colors flex items-center gap-1 cursor-pointer shadow-3xs"
                    >
                      <span>Process Business Analytics</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  {edaDiag && (
                    <div className="space-y-4 pt-1">
                      {/* EDA Dashboard Main Tabs */}
                      <div className="flex border-b border-gray-200">
                        <button
                          type="button"
                          onClick={() => setActiveEdaTab("summary")}
                          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer -mb-[1px] ${
                            activeEdaTab === "summary"
                              ? "border-[#107C41] text-[#107C41] bg-[#107C41]/5 rounded-t-md"
                              : "border-transparent text-gray-500 hover:text-gray-900"
                          }`}
                        >
                          <span>1. Numerical Summary (The Hard Numbers)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveEdaTab("distribution")}
                          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer -mb-[1px] ${
                            activeEdaTab === "distribution"
                              ? "border-[#107C41] text-[#107C41] bg-[#107C41]/5 rounded-t-md"
                              : "border-transparent text-gray-500 hover:text-gray-900"
                          }`}
                        >
                          <span>2. Data Distribution (Seeing the Shape)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveEdaTab("relationship")}
                          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer -mb-[1px] ${
                            activeEdaTab === "relationship"
                              ? "border-[#107C41] text-[#107C41] bg-[#107C41]/5 rounded-t-md"
                              : "border-transparent text-gray-500 hover:text-gray-900"
                          }`}
                        >
                          <span>3. Relationship Validation (Pairplots)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveEdaTab("profiler")}
                          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer -mb-[1px] ${
                            activeEdaTab === "profiler"
                              ? "border-[#107C41] text-[#107C41] bg-[#107C41]/5 rounded-t-md"
                              : "border-transparent text-gray-500 hover:text-gray-900"
                          }`}
                        >
                          <span>4. Universal Unique Entity Profiler</span>
                        </button>
                      </div>

                      {/* TAB 1: Descriptive Stats (df.describe() Expanded) */}
                      {activeEdaTab === "summary" && (
                        <div className="bg-[#FAFBFD] p-3.5 rounded-lg border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-3xs font-extrabold text-[#107C41] uppercase tracking-wider font-mono">LIVE DESCRIBE WORKBOOK</span>
                              <h3 className="text-xs font-bold text-gray-800 font-sans">Statistik Deskriptif Sebaran Parameter</h3>
                            </div>
                            <span className="text-[10px] text-gray-500 font-sans italic">Klik sel mana saja untuk menelusuri formula Excel dan referensi sel.</span>
                          </div>

                          {/* Excel Mock Formula Bar */}
                          <div className="flex items-center bg-[#F3F3F3] border border-[#CBD5E1] rounded-t-md p-1 gap-1.5 select-none font-sans text-xs">
                            {/* Cell Address Name Box */}
                            <div className="bg-white border border-[#B0B0B0] px-3 py-0.5 rounded text-gray-800 font-bold min-w-[55px] text-center font-mono text-[11px] shadow-3xs">
                              {activeExcelCell?.ref || "A1"}
                            </div>
                            
                            {/* Status controls */}
                            <div className="h-4 w-[1px] bg-gray-300 mx-0.5" />
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <span className="text-gray-400 font-semibold px-0.5 select-none text-[11px] hover:text-red-500 cursor-not-allowed">×</span>
                              <span className="text-gray-400 font-semibold px-0.5 select-none text-[11px] hover:text-green-600 cursor-not-allowed">✓</span>
                              <span className="text-[#107C41] italic font-serif font-extrabold px-1 text-xs select-none">fₓ</span>
                            </div>
                            <div className="h-4 w-[1px] bg-gray-300 mx-0.5" />
                            
                            {/* Main Formula Input Bar */}
                            <div className="bg-white border border-[#CBD5E1] flex-1 px-2.5 py-0.5 rounded text-gray-800 font-mono text-[11px] truncate select-all">
                              {activeExcelCell?.val || "=DESCRIBE()"}
                            </div>
                          </div>

                          {/* Excel Spreadsheet Grid container */}
                          <div className="overflow-x-auto border-x border-b border-[#CBD5E1] rounded-b-md">
                            <table className="w-full text-left border-collapse font-sans text-[11px] select-text min-w-[900px]">
                              {/* Headers */}
                              <thead>
                                {/* Sub-header 1: Column letters A, B, C... */}
                                <tr className="bg-[#EFEFEF] text-gray-500 text-center font-normal font-mono h-5 select-none divide-x divide-[#D9D9D9] border-b border-[#D9D9D9]">
                                  <th className="w-9 bg-[#E3E3E3] border-b border-[#D9D9D9] text-center text-[9px] font-sans font-bold text-gray-600">ID</th>
                                  <th className="px-2">A</th>
                                  <th className="px-2">B</th>
                                  <th className="px-2">C</th>
                                  <th className="px-2">D</th>
                                  <th className="px-2">E</th>
                                  <th className="px-2">F</th>
                                  <th className="px-2">G</th>
                                  <th className="px-2">H</th>
                                  <th className="px-2">I</th>
                                  <th className="px-2">J</th>
                                  <th className="px-2">K</th>
                                  <th className="px-2">L</th>
                                </tr>
                                {/* Sub-header 2: Column labels (Variable, Count, Mean...) */}
                                <tr className="bg-[#F9FBF9] text-gray-700 font-semibold select-none divide-x divide-[#D9D9D9] border-b border-[#C0C0C0] h-7">
                                  <th className="w-9 bg-[#EBF0EB] text-center font-mono font-bold text-gray-500 border-r border-[#D9D9D9]"></th>
                                  <th className="px-2.5 text-left font-sans text-gray-800 text-[11px]">Variable</th>
                                  <th className="px-2.5 text-right font-sans text-gray-700 text-[11px]">Count</th>
                                  <th className="px-2.5 text-right font-sans text-[#107C41] text-[11px]">Mean</th>
                                  <th className="px-2.5 text-right font-sans text-gray-700 text-[11px]">Std Dev (σ)</th>
                                  <th className="px-2.5 text-right font-sans text-gray-750 text-[11px]">Min</th>
                                  <th className="px-2.5 text-right font-sans text-gray-700 text-[11px]">Q1 (25%)</th>
                                  <th className="px-2.5 text-right font-sans text-emerald-800 text-[11px]">Median (50%)</th>
                                  <th className="px-2.5 text-right font-sans text-gray-700 text-[11px]">Q3 (75%)</th>
                                  <th className="px-2.5 text-right font-sans text-gray-750 text-[11px]">Max</th>
                                  <th className="px-2.5 text-right font-sans text-amber-800 text-[11px]">Skewness</th>
                                  <th className="px-2.5 text-right font-sans text-indigo-800 text-[11px]">Kurtosis</th>
                                  <th className="px-3 text-left font-sans text-gray-700 text-[11px]">Distribution Profile</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#D9D9D9]">
                                {edaDiag.numerical_summary.map((row, idx) => {
                                  const rIdx = idx + 2; // Rows start at 2 (since header is row 1!)
                                  
                                  const absSkew = Math.abs(row.skewness);
                                  let skewText = "Simetris";
                                  let skewBadgeColor = "text-emerald-800 bg-emerald-50 border-emerald-100";
                                  if (absSkew > 1.0) {
                                    skewText = row.skewness > 0 ? "Highly Right-Skewed" : "Highly Left-Skewed";
                                    skewBadgeColor = "text-rose-800 bg-rose-50 border-rose-100";
                                  } else if (absSkew > 0.5) {
                                    skewText = row.skewness > 0 ? "Moderate Right-Skew" : "Moderate Left-Skew";
                                    skewBadgeColor = "text-amber-800 bg-amber-50 border-amber-100";
                                  }

                                  let kurtText = "Mesokurtik (Normal)";
                                  let kurtBadgeColor = "text-gray-700 bg-gray-50 border-gray-150";
                                  if (row.kurtosis > 0.8) {
                                    kurtText = "Leptokurtik (Ekor Tinggi)";
                                    kurtBadgeColor = "text-purple-800 bg-purple-50 border-purple-100";
                                  } else if (row.kurtosis < -0.8) {
                                    kurtText = "Platikurtik (Ekor Rata)";
                                    kurtBadgeColor = "text-blue-800 bg-blue-50 border-blue-100";
                                  }

                                  const colFmt = "General";

                                  // Excel cells references and dynamic formula values
                                  const cellA = { ref: `A${rIdx}`, val: row.col };
                                  const cellB = { ref: `B${rIdx}`, val: `=COUNT(data.${row.col}) -> ${row.count}` };
                                  const cellC = { ref: `C${rIdx}`, val: `=AVERAGE(data.${row.col}) -> ${formatExcelValue(row.mean, colFmt)}` };
                                  const cellD = { ref: `D${rIdx}`, val: `=STDEV.S(data.${row.col}) -> ${formatExcelValue(row.std, colFmt)}` };
                                  const cellE = { ref: `E${rIdx}`, val: `=MIN(data.${row.col}) -> ${formatExcelValue(row.min, colFmt)}` };
                                  const cellF = { ref: `F${rIdx}`, val: `=PERCENTILE.INC(data.${row.col}, 0.25) -> ${formatExcelValue(row.p25, colFmt)}` };
                                  const cellG = { ref: `G${rIdx}`, val: `=MEDIAN(data.${row.col}) -> ${formatExcelValue(row.p50, colFmt)}` };
                                  const cellH = { ref: `H${rIdx}`, val: `=PERCENTILE.INC(data.${row.col}, 0.75) -> ${formatExcelValue(row.p75, colFmt)}` };
                                  const cellI = { ref: `I${rIdx}`, val: `=MAX(data.${row.col}) -> ${formatExcelValue(row.max, colFmt)}` };
                                  const cellJ = { ref: `J${rIdx}`, val: `=SKEW(data.${row.col}) -> ${row.skewness.toFixed(4)}` };
                                  const cellK = { ref: `K${rIdx}`, val: `=KURT(data.${row.col}) -> ${row.kurtosis.toFixed(4)}` };
                                  const cellL = { ref: `L${rIdx}`, val: `Shape Profile: ${skewText} / ${kurtText}` };

                                  return (
                                    <tr 
                                      key={row.col} 
                                      className="hover:bg-[#E2F0D9]/30 transition-colors h-7 divide-x divide-[#D9D9D9]"
                                    >
                                      {/* Spreadsheet Row Index Label Column */}
                                      <td className="w-9 bg-[#EFEFEF] text-center font-mono text-[10px] text-gray-500 select-none font-semibold border-b border-[#D9D9D9]">
                                        {rIdx}
                                      </td>

                                      {/* Cell A: Variable name */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellA)}
                                        className={`px-2.5 py-1 text-left font-sans font-bold text-gray-900 capitalize cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellA.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        }`}
                                      >
                                        {row.col.replace(/_/g, " ")}
                                      </td>

                                      {/* Cell B: Count */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellB)}
                                        className={`px-2.5 py-1 text-right font-mono text-gray-600 cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellB.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        }`}
                                      >
                                        {row.count}
                                      </td>

                                      {/* Cell C: Mean */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellC)}
                                        className={`px-2.5 py-1 text-right font-mono text-gray-800 font-semibold cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellC.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#E1F1E7]"
                                            : ""
                                        }`}
                                      >
                                        {formatExcelValue(row.mean, colFmt)}
                                      </td>

                                      {/* Cell D: Std Dev */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellD)}
                                        className={`px-2.5 py-1 text-right font-mono text-gray-600 cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellD.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        }`}
                                      >
                                        {formatExcelValue(row.std, colFmt)}
                                      </td>

                                      {/* Cell E: Min */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellE)}
                                        className={`px-2.5 py-1 text-right font-mono text-rose-650 cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellE.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        }`}
                                      >
                                        {formatExcelValue(row.min, colFmt)}
                                      </td>

                                      {/* Cell F: 25% */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellF)}
                                        className={`px-2.5 py-1 text-right font-mono text-gray-600 cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellF.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        }`}
                                      >
                                        {formatExcelValue(row.p25, colFmt)}
                                      </td>

                                      {/* Cell G: 50% Median */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellG)}
                                        className={`px-2.5 py-1 text-right font-mono text-emerald-850 font-bold bg-[#107C41]/3 cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellG.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#E1F1E7]"
                                            : ""
                                        }`}
                                      >
                                        {formatExcelValue(row.p50, colFmt)}
                                      </td>

                                      {/* Cell H: 75% */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellH)}
                                        className={`px-2.5 py-1 text-right font-mono text-gray-600 cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellH.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        }`}
                                      >
                                        {formatExcelValue(row.p75, colFmt)}
                                      </td>

                                      {/* Cell I: Max */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellI)}
                                        className={`px-2.5 py-1 text-right font-mono text-[#107C41] font-semibold cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellI.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        }`}
                                      >
                                        {formatExcelValue(row.max, colFmt)}
                                      </td>

                                      {/* Cell J: Skewness */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellJ)}
                                        className={`px-2.5 py-1 text-right font-mono font-semibold cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellJ.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        } ${absSkew > 0.5 ? "text-amber-700" : "text-gray-600"}`}
                                      >
                                        {row.skewness > 0 ? `+${row.skewness.toFixed(3)}` : row.skewness.toFixed(3)}
                                      </td>

                                      {/* Cell K: Kurtosis */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellK)}
                                        className={`px-2.5 py-1 text-right font-mono text-gray-700 cursor-pointer border-b border-[#D9D9D9] transition-all ${
                                          activeExcelCell.ref === cellK.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        }`}
                                      >
                                        {row.kurtosis.toFixed(3)}
                                      </td>

                                      {/* Cell L: Distribution Profile badge */}
                                      <td 
                                        onClick={() => setActiveExcelCell(cellL)}
                                        className={`px-3 py-1 font-sans text-left cursor-pointer border-b border-[#D9D9D9] space-x-1.5 whitespace-nowrap transition-all ${
                                          activeExcelCell.ref === cellL.ref
                                            ? "outline outline-2 outline-[#107C41] -outline-offset-1 bg-[#107C41]/5"
                                            : ""
                                        }`}
                                      >
                                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border ${skewBadgeColor}`}>{skewText}</span>
                                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border ${kurtBadgeColor}`}>{kurtText}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Excel Mock Tab Bar / Ribbon Bottom */}
                          <div className="flex bg-[#F3F3F3] border border-[#CBD5E1] rounded-b-md p-1 px-3 items-center justify-between text-3xs font-sans text-gray-500 select-none">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase font-mono mr-1">Sheets:</span>
                              <div className="flex items-center gap-1">
                                <span className="bg-white px-2 py-0.5 font-bold text-[#107C41] border border-t-2 border-t-[#107C41] border-gray-300 rounded-b shadow-3xs cursor-pointer">
                                  descriptive_summary
                                </span>
                                <span className="px-2 py-0.5 hover:bg-gray-200 rounded cursor-pointer">
                                  Sheet2
                                </span>
                                <span className="text-gray-400 font-bold px-1 cursor-pointer hover:bg-gray-200 rounded">+</span>
                              </div>
                            </div>
                            <span className="font-mono text-[9px]">Selesai • 100% Zoom</span>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: Data Distribution Analysis (Box & Histogram Simultaneous) */}
                      {activeEdaTab === "distribution" && (
                        (() => {
                          const activeColName = distSelectedCol || numericColumns[0] || "purchase_amount";
                          const currentStats = edaDiag.numerical_summary.find(s => s.col === activeColName) || {
                            col: activeColName, count: 0, mean: 0, std: 0, min: 0, p25: 0, p50: 0, p75: 0, max: 0, skewness: 0, kurtosis: 0
                          };

                          const rawVals = (engineeredData || [])
                            .map(r => Number(r[activeColName]))
                            .filter(v => !isNaN(v));

                          const defaultMin = currentStats.min;
                          const defaultMax = currentStats.max;

                          // Compute non-outliers for whiskers
                          const iqr = currentStats.p75 - currentStats.p25;
                          const lowBoundary = currentStats.p25 - 1.5 * iqr;
                          const highBoundary = currentStats.p75 + 1.5 * iqr;
                          const outlierDots = rawVals.filter(v => v < lowBoundary || v > highBoundary);
                          const nonOutliers = rawVals.filter(v => v >= lowBoundary && v <= highBoundary);
                          const whiskerMin = nonOutliers.length ? Math.min(...nonOutliers) : currentStats.min;
                          const whiskerMax = nonOutliers.length ? Math.max(...nonOutliers) : currentStats.max;

                          // Compute percentiles for options
                          const sortedVals = [...rawVals].sort((a, b) => a - b);
                          const getPercentile = (p: number) => {
                            if (sortedVals.length === 0) return 0;
                            const idx = Math.floor((sortedVals.length - 1) * p);
                            return sortedVals[idx];
                          };

                          // Determine active minimum & maximum bounds based on distRangeMode
                          let chosenMin = defaultMin;
                          let chosenMax = defaultMax;

                          if (distRangeMode === "iqr") {
                            chosenMin = lowBoundary;
                            chosenMax = highBoundary;
                          } else if (distRangeMode === "trim2") {
                            chosenMin = getPercentile(0.01);
                            chosenMax = getPercentile(0.99);
                          } else if (distRangeMode === "trim5") {
                            chosenMin = getPercentile(0.025);
                            chosenMax = getPercentile(0.975);
                          } else if (distRangeMode === "custom") {
                            const pMin = parseFloat(distCustomMin);
                            const pMax = parseFloat(distCustomMax);
                            chosenMin = !isNaN(pMin) ? pMin : defaultMin;
                            chosenMax = !isNaN(pMax) ? pMax : defaultMax;
                          }

                          // Prevent zero/negative range size
                          if (chosenMin >= chosenMax) {
                            chosenMax = chosenMin + 0.001;
                          }

                          // Filter data that fits within selected bounds
                          const filteredVals = rawVals.filter(v => v >= chosenMin && v <= chosenMax);
                          const keptPercentage = rawVals.length > 0 
                            ? Math.round((filteredVals.length / rawVals.length) * 100) 
                            : 0;

                          const displayMin = chosenMin;
                          const displayMax = chosenMax;
                          const rangeVal = displayMax - displayMin || 1;
                          const scaleX = (val: number) => {
                            // Clamp value to display boundaries so they stay visually aligned
                            const clampedVal = Math.max(displayMin, Math.min(displayMax, val));
                            return 45 + ((clampedVal - displayMin) / rangeVal) * 510;
                          };

                          // Divide into 15 bins of the display range
                          const binCount = 15;
                          const binSize = rangeVal / binCount;
                          const bins = Array.from({ length: binCount }, (_, idx) => {
                            const left = displayMin + idx * binSize;
                            const right = left + binSize;
                            return { left, right, count: 0 };
                          });

                          filteredVals.forEach(v => {
                            let placed = false;
                            for (let i = 0; i < binCount; i++) {
                              if (v >= bins[i].left && v < bins[i].right) {
                                bins[i].count++;
                                placed = true;
                                break;
                              }
                            }
                            if (!placed && v >= bins[binCount - 1].left) {
                              bins[binCount - 1].count++;
                            }
                          });

                          const maxBinCount = Math.max(...bins.map(b => b.count)) || 1;
                          const ticksNum = 6;
                          const tickVals = Array.from({ length: ticksNum }, (_, i) => displayMin + (rangeVal / (ticksNum - 1)) * i);

                          return (
                            <div className="bg-[#FAFBFD] p-3 rounded-md border border-gray-200 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
                                <div>
                                  <span className="text-3xs font-bold text-gray-400 uppercase block font-mono">Simultaneous Alignment View</span>
                                  <h3 className="text-sm font-bold text-gray-900 font-sans flex items-center gap-1.5 capitalize">
                                    <span>Distribusi Bentuk:</span>
                                    <span className="text-[#107C41] font-mono">{activeColName.replace(/_/g, " ")}</span>
                                  </h3>
                                </div>
                                
                                <div className="flex items-center gap-1.5">
                                  <span className="text-3xs text-gray-500 font-mono">Select Column:</span>
                                  <select
                                    value={activeColName}
                                    onChange={(e) => {
                                      setDistSelectedCol(e.target.value);
                                      setDistRangeMode("default");
                                      setDistCustomMin("");
                                      setDistCustomMax("");
                                    }}
                                    className="bg-white border border-gray-300 text-3xs px-2.5 py-1 rounded font-mono shadow-3xs cursor-pointer focus:ring-1 focus:ring-[#107C41] text-gray-700"
                                  >
                                    {numericColumns.map(col => (
                                      <option key={col} value={col}>{col.replace(/_/g, " ")}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Range Configurator Controls Row */}
                              <div className="bg-white p-3 rounded-md border border-gray-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3.5 select-text">
                                <div className="space-y-0.5">
                                  <span className="text-3xs font-extrabold text-[#107C41] uppercase tracking-wider block font-mono">
                                    ATURAN RANGE DATA HISTOGRAM
                                  </span>
                                  <p className="text-3xs text-gray-500 font-sans leading-relaxed max-w-md">
                                    Pilih batasan data di bawah untuk memfokuskan visualisasi bins, membuang data pencilan ekstrem (outlier), atau menetapkan rentang kustom Anda sendiri.
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                                  <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setDistRangeMode("default")}
                                      className={`text-[9px] font-mono font-bold px-2 py-1 rounded-sm cursor-pointer transition-all ${
                                        distRangeMode === "default"
                                          ? "bg-[#107C41] text-white shadow-3xs"
                                          : "text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      Default Val
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDistRangeMode("iqr")}
                                      className={`text-[9px] font-mono font-bold px-2 py-1 rounded-sm cursor-pointer transition-all ${
                                        distRangeMode === "iqr"
                                          ? "bg-[#107C41] text-white shadow-3xs"
                                          : "text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      Batas IQR
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDistRangeMode("trim2")}
                                      className={`text-[9px] font-mono font-bold px-2 py-1 rounded-sm cursor-pointer transition-all ${
                                        distRangeMode === "trim2"
                                          ? "bg-[#107C41] text-white shadow-3xs"
                                          : "text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      Trim 2%
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDistRangeMode("trim5")}
                                      className={`text-[9px] font-mono font-bold px-2 py-1 rounded-sm cursor-pointer transition-all ${
                                        distRangeMode === "trim5"
                                          ? "bg-[#107C41] text-white shadow-3xs"
                                          : "text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      Trim 5%
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDistRangeMode("custom");
                                        const parsedMin = isNaN(parseFloat(distCustomMin)) ? defaultMin : parseFloat(distCustomMin);
                                        const parsedMax = isNaN(parseFloat(distCustomMax)) ? defaultMax : parseFloat(distCustomMax);
                                        setDistCustomMin(parsedMin.toFixed(2));
                                        setDistCustomMax(parsedMax.toFixed(2));
                                      }}
                                      className={`text-[9px] font-mono font-bold px-2 py-1 rounded-sm cursor-pointer transition-all ${
                                        distRangeMode === "custom"
                                          ? "bg-[#107C41] text-white shadow-3xs"
                                          : "text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      Kustom
                                    </button>
                                  </div>

                                  {distRangeMode === "custom" && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <input
                                        type="number"
                                        placeholder="Min"
                                        value={distCustomMin}
                                        onChange={(e) => setDistCustomMin(e.target.value)}
                                        className="w-16 text-3xs font-mono font-bold bg-white border border-gray-300 rounded px-1.5 py-0.5 text-center text-gray-700 hover:border-[#107C41] focus:ring-1 focus:ring-[#107C41] focus:outline-none"
                                      />
                                      <span className="text-[10px] text-gray-400 font-mono">sd</span>
                                      <input
                                        type="number"
                                        placeholder="Max"
                                        value={distCustomMax}
                                        onChange={(e) => setDistCustomMax(e.target.value)}
                                        className="w-16 text-3xs font-mono font-bold bg-white border border-gray-300 rounded px-1.5 py-0.5 text-center text-gray-700 hover:border-[#107C41] focus:ring-1 focus:ring-[#107C41] focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDistCustomMin(defaultMin.toFixed(2));
                                          setDistCustomMax(defaultMax.toFixed(2));
                                        }}
                                        className="text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-600 font-mono font-bold border border-gray-300 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                                        title="Reset ke nilai minimum dan maksimum default kolom"
                                      >
                                        ↺ Reset
                                      </button>
                                    </div>
                                  )}

                                  <span className="text-[9px] font-bold font-mono px-2 py-1 bg-[#107C41]/10 text-[#107C41] border border-[#107C41]/20 rounded shrink-0">
                                    Proporsi Data: {keptPercentage}% ({filteredVals.length}/{rawVals.length} titik)
                                  </span>
                                </div>
                              </div>

                              {/* Small Metrics grid */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white p-2 border border-gray-200 rounded-md">
                                  <span className="text-3xs text-gray-550 font-sans block uppercase font-extrabold font-mono">Nilai Tengah Sebaran</span>
                                  <div className="mt-1 text-sm font-sans flex items-baseline gap-1">
                                    <span className="text-3xs text-gray-500 font-medium">Mean:</span>
                                    <span className="font-extrabold text-[#107C41] font-mono">{currentStats.mean}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Median: {currentStats.p50}</div>
                                </div>
                                <div className="bg-white p-2 border border-gray-200 rounded-md">
                                  <span className="text-3xs text-gray-550 font-sans block uppercase font-extrabold font-mono">Standar Deviasi / IQR</span>
                                  <div className="mt-1 text-sm font-sans flex items-baseline gap-1">
                                    <span className="text-3xs text-gray-500 font-medium">Std:</span>
                                    <span className="font-extrabold text-blue-700 font-mono">{currentStats.std}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Rentang IQR: {iqr.toFixed(3)}</div>
                                </div>
                                <div className="bg-white p-2 border border-gray-200 rounded-md">
                                  <span className="text-3xs text-gray-550 font-sans block uppercase font-extrabold font-mono">Kemencengan (Skewness)</span>
                                  <div className="mt-1 text-sm font-sans flex items-baseline gap-1">
                                    <span className="text-3xs text-gray-500 font-medium">Skew:</span>
                                    <span className={`font-extrabold font-mono ${Math.abs(currentStats.skewness) > 0.5 ? "text-amber-600" : "text-emerald-700"}`}>{currentStats.skewness}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Kurtosis: {currentStats.kurtosis}</div>
                                </div>
                                <div className="bg-white p-2 border border-gray-200 rounded-md">
                                  <span className="text-3xs text-gray-550 font-sans block uppercase font-extrabold font-mono">Boxplot Outliers Detected</span>
                                  <div className="mt-1 text-sm font-sans flex items-baseline gap-1">
                                    <span className="text-3xs text-gray-500 font-medium">Pencilan:</span>
                                    <span className={`font-extrabold font-mono ${outlierDots.length > 0 ? "text-red-500" : "text-emerald-700"}`}>{outlierDots.length} titik</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">IQR Bounds: [{lowBoundary.toFixed(2)}, {highBoundary.toFixed(2)}]</div>
                                </div>
                              </div>

                              {/* Render SVG simultaneous canvas */}
                              <div className="bg-white p-3.5 border border-gray-200 rounded-md shadow-3xs leading-none">
                                <div className="h-[215px] w-full overflow-x-auto select-none">
                                  <svg viewBox="0 0 600 215" className="w-full min-w-[560px] h-full mx-auto">
                                    <rect width={600} height={215} fill="#FAFBFD" rx={4} />

                                    {/* Boxplot Frame */}
                                    <text x={10} y={24} className="text-[8px] font-bold fill-gray-400 font-mono uppercase">BOXPLOT OUTLIERS</text>
                                    
                                    {/* Whiskers line */}
                                    <line x1={scaleX(whiskerMin)} y1={25} x2={scaleX(whiskerMax)} y2={25} stroke="#94A3B8" strokeWidth={1.2} />
                                    <line x1={scaleX(whiskerMin)} y1={18} x2={scaleX(whiskerMin)} y2={32} stroke="#64748B" strokeWidth={1.2} />
                                    <line x1={scaleX(whiskerMax)} y1={18} x2={scaleX(whiskerMax)} y2={32} stroke="#64748B" strokeWidth={1.2} />

                                    {/* Interquartile Box (25% to 75%) */}
                                    <rect 
                                      x={scaleX(currentStats.p25)} 
                                      y={12} 
                                      width={Math.max(3, scaleX(currentStats.p75) - scaleX(currentStats.p25))} 
                                      height={26} 
                                      fill="#107C41" 
                                      fillOpacity={0.12} 
                                      stroke="#107C41" 
                                      strokeWidth={1.5} 
                                      rx={1.5}
                                    />

                                    {/* Median (50%) line */}
                                    <line x1={scaleX(currentStats.p50)} y1={12} x2={scaleX(currentStats.p50)} y2={38} stroke="#107C41" strokeWidth={2.5} />
                                    
                                    {/* Mean line */}
                                    <line x1={scaleX(currentStats.mean)} y1={10} x2={scaleX(currentStats.mean)} y2={40} stroke="#3B82F6" strokeWidth={1} strokeDasharray="3,3" />

                                    {/* Outlier Dots */}
                                    {outlierDots.filter(out => out >= displayMin && out <= displayMax).map((out, idx) => (
                                      <circle 
                                        key={idx} 
                                        cx={scaleX(out)} 
                                        cy={25} 
                                        r={3.2} 
                                        fill="#EF4444" 
                                        stroke="#DC2626" 
                                        strokeWidth={1} 
                                        fillOpacity={0.8}
                                      />
                                    ))}

                                    {/* Axis divider line */}
                                    <line x1={30} y1={52} x2={570} y2={52} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="2,2" />

                                    {/* Histogram Bins */}
                                    <text x={10} y={64} className="text-[8px] font-bold fill-gray-400 font-mono uppercase">HISTOGRAM ({binCount} BINS)</text>
                                    
                                    {/* Gridlines back */}
                                    <line x1={45} y1={175} x2={555} y2={175} stroke="#CBD5E1" strokeWidth={1.2} />
                                    <line x1={45} y1={115} x2={555} y2={115} stroke="#F1F5F9" strokeWidth={0.8} />

                                    {bins.map((b, idx) => {
                                      const barHt = (b.count / maxBinCount) * 105;
                                      const xPos = scaleX(b.left);
                                      const wPos = Math.max(1, scaleX(b.right) - scaleX(b.left) - 1.2);
                                      const yPos = 175 - barHt;

                                      return (
                                        <g key={idx} className="group cursor-help">
                                          <rect 
                                            x={xPos} 
                                            y={yPos} 
                                            width={wPos} 
                                            height={barHt} 
                                            fill="#107C41" 
                                            fillOpacity={0.7} 
                                            stroke="#0b592e" 
                                            strokeWidth={0.5} 
                                            className="hover:fill-opacity-95 transition-all duration-100"
                                          />
                                          <title>
                                            Rentang Baris: {b.left.toFixed(2)} - {b.right.toFixed(2)}
                                            Frekuensi: {b.count} ({((b.count / rawVals.length) * 100).toFixed(1)}%)
                                          </title>
                                        </g>
                                      );
                                    })}

                                    {/* X-axis scale labels and tick marks */}
                                    {tickVals.map((tick, idx) => {
                                      const tickX = scaleX(tick);
                                      return (
                                        <g key={idx}>
                                          <line x1={tickX} y1={175} x2={tickX} y2={180} stroke="#64748B" strokeWidth={1} />
                                          <text x={tickX} y={193} textAnchor="middle" className="text-[9px] fill-gray-500 font-mono font-bold">
                                            {tick.toFixed(1)}
                                          </text>
                                        </g>
                                      );
                                    })}
                                  </svg>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 mt-2 px-3 text-[9px] text-gray-400 font-mono leading-none">
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block h-2.5 w-2.5 bg-[#107C41]/12 border border-[#107C41]/50 rounded-xs" /> IQR Rentang (25%-75%)
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Outer Outliers Batas Boxplot
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block h-1 w-3 border-t border-dashed border-blue-505" /> Rata-Rata (Mean)
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      )}

                      {/* TAB 3: Relationship Validation (Multiselect Correlations & Scatter Pairplot Regression Matrix) */}
                      {activeEdaTab === "relationship" && (
                        (() => {
                          const activeRelCols = selectedRelCols.filter(c => !deletedColumns.includes(c));
                          const K = activeRelCols.length;

                          // Helper coordinates scaler inside 100x100 grid cell
                          const getCellCoords = (xVal: number, yVal: number, xMin: number, xMax: number, yMin: number, yMax: number) => {
                            const xRange = xMax - xMin || 1;
                            const yRange = yMax - yMin || 1;
                            const px = 10 + ((xVal - xMin) / xRange) * 80;
                            const py = 90 - ((yVal - yMin) / yRange) * 80; // invert for SVG
                            return { x: px, y: py };
                          };

                          // Regression trend line helper
                          const getTrendLine = (pts: {x: number, y: number}[], xMin: number, xMax: number, yMin: number, yMax: number) => {
                            const n = pts.length;
                            if (n < 2) return null;
                            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                            for (let i = 0; i < n; i++) {
                              sumX += pts[i].x;
                              sumY += pts[i].y;
                              sumXY += pts[i].x * pts[i].y;
                              sumXX += pts[i].x * pts[i].x;
                            }
                            const denom = n * sumXX - sumX * sumX;
                            if (denom === 0) return null;
                            const slope = (n * sumXY - sumX * sumY) / denom;
                            const intercept = (sumY - slope * sumX) / n;

                            const yAtMin = slope * xMin + intercept;
                            const yAtMax = slope * xMax + intercept;

                            const pt1 = getCellCoords(xMin, yAtMin, xMin, xMax, yMin, yMax);
                            const pt2 = getCellCoords(xMax, yAtMax, xMin, xMax, yMin, yMax);
                            return { x1: pt1.x, y1: pt1.y, x2: pt2.x, y2: pt2.y };
                          };

                          return (
                            <div className="bg-[#FAFBFD] p-3.5 rounded-lg border border-gray-200 space-y-3.5">
                              {/* Selection panel header */}
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-3">
                                <div>
                                  <span className="text-3xs font-extrabold text-[#107C41] uppercase block font-mono">Bivariate Validation Workbench</span>
                                  <h3 className="text-xs font-bold text-gray-800 font-sans">
                                    Pairplot Matrix & Heatmap Korelasi Parametrik
                                  </h3>
                                </div>

                                {/* Active parameters toggle buttons (unlimited) */}
                                <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-md border border-[#D9D9D9] shadow-3xs max-w-full">
                                  <span className="text-[10px] text-gray-500 font-bold font-sans px-1 border-r border-gray-200 mr-1.5">Kolom Aktif:</span>
                                  {numericColumns.map(col => {
                                    const isSelected = activeRelCols.includes(col);
                                    return (
                                      <button
                                        key={col}
                                        type="button"
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedRelCols(activeRelCols.filter(c => c !== col));
                                          } else {
                                            setSelectedRelCols([...activeRelCols, col]);
                                          }
                                        }}
                                        className={`px-2.5 py-0.5 rounded text-[10px] font-sans font-medium transition-all border flex items-center gap-1 cursor-pointer ${
                                          isSelected
                                            ? "bg-[#107C41]/10 text-[#107C41] border-[#107C41]/45 font-semibold"
                                            : "bg-gray-50 text-gray-400 hover:bg-gray-100 border-gray-200 opacity-60 hover:opacity-100"
                                        }`}
                                      >
                                        <Check className={`h-2.5 w-2.5 transition-opacity ${isSelected ? "opacity-100 text-[#107C41]" : "opacity-0"}`} />
                                        <span className="capitalize">{col.replace(/_/g, " ")}</span>
                                      </button>
                                    );
                                  })}

                                  {/* Select All or Reset Helpers */}
                                  <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2.5 ml-1 select-none">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRelCols(numericColumns)}
                                      className="text-[10px] text-blue-700 font-bold hover:underline cursor-pointer transition-colors"
                                    >
                                      Select All
                                    </button>
                                    <span className="text-gray-300 text-xxs">|</span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRelCols([])}
                                      className="text-[10px] text-red-600 font-bold hover:underline cursor-pointer transition-colors"
                                    >
                                      Clear All
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* No columns selected empty state placeholder */}
                              {K === 0 ? (
                                <div className="bg-white p-8 rounded-md border border-dashed border-[#CBD5E1] text-center space-y-2 max-w-md mx-auto">
                                  <div className="h-9 w-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center mx-auto text-xs font-bold">!</div>
                                  <h4 className="text-xs font-extrabold text-gray-700">No Variables Selected</h4>
                                  <p className="text-3xs text-gray-400 leading-normal">
                                    Please select the variables above, or click <strong className="text-blue-700 cursor-pointer" onClick={() => setSelectedRelCols(numericColumns)}>Select All</strong> to render the parametric correlation matrices.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-4 select-text">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-150 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-2xs font-extrabold text-gray-500 block uppercase tracking-wider font-sans">
                                        Interactive Scatter Matrix & Regression Curves (Pairplots)
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setShowPairplot(!showPairplot)}
                                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-black transition-all border cursor-pointer hover:bg-gray-100 flex items-center gap-1 ${
                                          showPairplot 
                                            ? "bg-amber-100/75 text-amber-800 border-amber-300"
                                            : "bg-gray-100 text-gray-600 border-gray-300"
                                        }`}
                                      >
                                        <span>{showPairplot ? "HIDE" : "SHOW"}</span>
                                      </button>
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-sans text-right">
                                      *Matriks memiliki label sumbu kolom (Top) & baris (Left). Sel bergaris kuning dengan lencana <strong className="text-amber-600">🔥 HIGH CORR</strong> menandakan korelasi kuat (|r| &ge; 0.40).
                                    </span>
                                  </div>
                                  
                                  {showPairplot ? (
                                    /* Scrollable grid layer preventing squeezed aspect ratio for high K */
                                    <div className="overflow-x-auto border border-[#CBD5E1] rounded-md bg-white p-2 shadow-3xs">
                                    <div 
                                      className="grid divide-x divide-y divide-gray-200 border-t border-l border-gray-200"
                                      style={{ 
                                        gridTemplateColumns: `100px repeat(${K}, minmax(0, 1fr))`,
                                        minWidth: K > 4 ? `${100 + K * 125}px` : "100%" 
                                      }}
                                    >
                                      {/* Row 0: Column Headers (Header Top) */}
                                      {/* Top-Left empty/label corner */}
                                      <div className="bg-gray-100/80 p-2 flex flex-col items-center justify-center text-center border-b border-r border-gray-200 select-none">
                                        <span className="text-[9px] font-black text-[#107C41] font-mono leading-none tracking-wider">FITUR</span>
                                        <span className="text-[7px] text-gray-400 font-mono mt-1 select-none">Y \ X Axis</span>
                                      </div>
                                      
                                      {activeRelCols.map((colCol) => (
                                        <div key={`col-header-${colCol}`} className="bg-gray-50/95 p-2 flex flex-col items-center justify-center text-center border-b border-gray-200 select-none min-h-[48px] leading-tight">
                                          <span className="text-[9px] font-extrabold text-gray-800 capitalize tracking-tight px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-3xs truncate max-w-full" title={colCol}>
                                            {colCol.replace(/_/g, " ")}
                                          </span>
                                          <span className="text-[8px] text-gray-450 block mt-0.5 font-mono">(Sumbu X)</span>
                                        </div>
                                      ))}

                                      {/* Row 1..K: Features Rows */}
                                      {activeRelCols.map((rowCol) => {
                                        const rowStats = edaDiag.numerical_summary.find(s => s.col === rowCol) || { min: 0, max: 100 };
                                        
                                        return (
                                          <React.Fragment key={`row-group-${rowCol}`}>
                                            {/* Left-most Header for this row */}
                                            <div className="bg-gray-50/95 p-2 flex flex-col items-end justify-center text-right pr-2.5 border-r border-gray-200 select-none leading-tight min-h-[105px]">
                                              <span className="text-[9px] font-extrabold text-gray-800 capitalize tracking-tight px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-3xs truncate max-w-full" title={rowCol}>
                                                {rowCol.replace(/_/g, " ")}
                                              </span>
                                              <span className="text-[8px] text-gray-450 block mt-0.5 font-mono">(Sumbu Y)</span>
                                            </div>

                                            {/* Each column cell in this row */}
                                            {activeRelCols.map((colCol) => {
                                              const colStats = edaDiag.numerical_summary.find(s => s.col === colCol) || { min: 0, max: 100 };
                                              const isDiag = rowCol === colCol;

                                              if (isDiag) {
                                                return (
                                                  <div 
                                                    key={`${rowCol}::${colCol}`} 
                                                    className="bg-gray-100/40 p-3.5 flex flex-col items-center justify-center text-center aspect-square select-none leading-normal border-b border-r border-gray-200"
                                                    title={`Variabel Mandiri: ${rowCol.replace(/_/g, " ")}`}
                                                  >
                                                    <span className="text-[9px] font-black capitalize text-[#107C41] px-1.5 py-0.5 bg-white border border-gray-150 rounded shadow-3xs truncate max-w-full" title={rowCol}>
                                                      {rowCol.replace(/_/g, " ")}
                                                    </span>
                                                    <div className="mt-2">
                                                      <span className="text-[7.5px] text-gray-450 block font-mono uppercase tracking-wider">Rentang Nilai:</span>
                                                      <span className="text-[9px] text-[#107C41] font-mono font-bold block">
                                                        [{rowStats.min.toFixed(0)}, {rowStats.max.toFixed(0)}]
                                                      </span>
                                                    </div>
                                                  </div>
                                                );
                                              }

                                              const pts = (engineeredData || []).map(r => {
                                                const xV = Number(r[colCol]);
                                                const yV = Number(r[rowCol]);
                                                return { x: xV, y: yV };
                                              }).filter(p => !isNaN(p.x) && !isNaN(p.y));

                                              const trend = getTrendLine(pts, colStats.min, colStats.max, rowStats.min, rowStats.max);
                                              const rValue = edaDiag.correlation_matrix[colCol]?.[rowCol] ?? 0.0;
                                              const isHighCorr = Math.abs(rValue) >= 0.40;

                                              return (
                                                <div 
                                                  key={`${rowCol}::${colCol}`} 
                                                  className={`relative aspect-square group transition-all border-b border-r border-gray-200 ${
                                                    isHighCorr 
                                                      ? "bg-amber-50/15 ring-2 ring-amber-400 ring-inset" 
                                                      : "bg-[#FAFBFD]/30 hover:bg-[#FAFBFD]/80"
                                                  }`}
                                                  title={`Korelasi [R] = ${rValue.toFixed(4)} (${isHighCorr ? "Korelasi Tinggi/Kuat!" : "Korelasi Lemah/Sedang"})\nSumbu X: ${colCol.replace(/_/g, " ")}\nSumbu Y: ${rowCol.replace(/_/g, " ")}`}
                                                >
                                                  {isHighCorr && (
                                                    <span className="absolute top-1 left-1 flex items-center gap-0.5 text-[7px] bg-amber-500 text-white font-extrabold px-1.5 py-0.5 rounded shadow-3xs uppercase tracking-wider font-mono z-10 leading-none">
                                                      🔥 {rValue > 0 ? "POS" : "NEG"} HIGH
                                                    </span>
                                                  )}

                                                  <svg viewBox="0 0 100 100" className="w-full h-full select-none">
                                                    <rect width={100} height={100} fill="none" />
                                                    {trend && (
                                                      <line 
                                                        x1={trend.x1} 
                                                        y1={trend.y1} 
                                                        x2={trend.x2} 
                                                        y2={trend.y2} 
                                                        stroke={isHighCorr ? "#D97706" : "#F59E0B"} 
                                                        strokeWidth={isHighCorr ? 2.2 : 1.3} 
                                                        strokeOpacity={0.9}
                                                      />
                                                    )}
                                                    {pts.slice(0, 80).map((pt, idx) => {
                                                      const coords = getCellCoords(pt.x, pt.y, colStats.min, colStats.max, rowStats.min, rowStats.max);
                                                      return (
                                                        <circle 
                                                          key={idx} 
                                                          cx={coords.x} 
                                                          cy={coords.y} 
                                                          r={1.6} 
                                                          fill={isHighCorr ? "#B45309" : "#1D4ED8"} 
                                                          fillOpacity={0.45}
                                                        />
                                                      );
                                                    })}
                                                  </svg>

                                                  <span 
                                                    className={`absolute bottom-1 right-1 text-[8.5px] font-black font-mono px-1 py-0.2 border rounded leading-none shadow-3xs select-none z-10 ${
                                                      isHighCorr 
                                                        ? "text-amber-900 bg-amber-100 border-amber-300 pointer-events-none" 
                                                        : "text-gray-600 bg-white border-gray-150 pointer-events-none"
                                                    }`}
                                                  >
                                                    r: {rValue > 0 ? `+${rValue.toFixed(2)}` : rValue.toFixed(2)}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </React.Fragment>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-gray-50/50 p-6 rounded-lg border border-dashed border-gray-200 text-center py-7">
                                    <p className="text-3xs text-gray-400 font-mono">
                                      Matrix Pairplots disembunyikan secara bawaan (Hidden by Default). Silakan klik tombol "SHOW" diatas untuk membukanya.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                              {/* Interactive Bivariate Relationship Advisor */}
                              {K >= 2 && (() => {
                                const currentX = bivariateVarX || activeRelCols[0] || "";
                                const currentY = bivariateVarY || (activeRelCols[1] && activeRelCols[1] !== currentX ? activeRelCols[1] : activeRelCols[0]) || "";
                                
                                const pts = (engineeredData || []).map(r => {
                                  const xVal = Number(r[currentX]);
                                  const yVal = Number(r[currentY]);
                                  return { x: xVal, y: yVal };
                                }).filter(p => !isNaN(p.x) && !isNaN(p.y));

                                const n = pts.length;
                                if (n === 0) return null;

                                const meanX = pts.reduce((s, p) => s + p.x, 0) / n;
                                const meanY = pts.reduce((s, p) => s + p.y, 0) / n;

                                let varX = 0;
                                let varY = 0;
                                let covXY = 0;
                                let sumXDiff3 = 0;
                                let sumYDiff3 = 0;

                                for (let i = 0; i < n; i++) {
                                  const dx = pts[i].x - meanX;
                                  const dy = pts[i].y - meanY;
                                  varX += dx * dx;
                                  varY += dy * dy;
                                  covXY += dx * dy;
                                  sumXDiff3 += dx * dx * dx;
                                  sumYDiff3 += dy * dy * dy;
                                }

                                const stdX = Math.sqrt(varX / n);
                                const stdY = Math.sqrt(varY / n);
                                const rCoef = stdX > 0 && stdY > 0 ? covXY / (n * stdX * stdY) : 0;
                                const rSq = rCoef * rCoef;
                                const skewX = stdX > 0 ? (sumXDiff3 / n) / Math.pow(stdX, 3) : 0;
                                const skewY = stdY > 0 ? (sumYDiff3 / n) / Math.pow(stdY, 3) : 0;

                                // Non-linearity heuristic
                                const sortedPts = [...pts].sort((a, b) => a.x - b.x);
                                const p1 = sortedPts.slice(0, Math.floor(n / 3));
                                const p2 = sortedPts.slice(Math.floor(n / 3), Math.floor(2 * n / 3));
                                const p3 = sortedPts.slice(Math.floor(2 * n / 3));

                                const getSlope = (arr: {x: number, y: number}[]) => {
                                  if (arr.length < 5) return 0;
                                  const mx = arr.reduce((sum, p) => sum + p.x, 0) / arr.length;
                                  const my = arr.reduce((sum, p) => sum + p.y, 0) / arr.length;
                                  let num = 0;
                                  let den = 0;
                                  for (let i = 0; i < arr.length; i++) {
                                    num += (arr[i].x - mx) * (arr[i].y - my);
                                    den += (arr[i].x - mx) * (arr[i].x - mx);
                                  }
                                  return den !== 0 ? num / den : 0;
                                };

                                const slope1 = getSlope(p1);
                                const slope2 = getSlope(p2);
                                const slope3 = getSlope(p3);

                                const sign1 = Math.sign(slope1);
                                const sign3 = Math.sign(slope3);
                                const isNonLinear = p1.length > 5 && p3.length > 5 && (
                                  (sign1 !== sign3 && Math.abs(slope1) > 0.05 && Math.abs(slope3) > 0.05) ||
                                  (Math.abs(slope1 - slope3) > Math.abs(slope2) * 2.0 && Math.abs(slope2) > 0.05)
                                );

                                // Decision strings
                                let rekomendasiSumbu = "";
                                let rekomendasiVisual = "";
                                let rekomendasiModel = "";
                                let interpretasiPola = "";

                                const absR = Math.abs(rCoef);
                                const arah = rCoef > 0 ? "Positif" : "Negatif";
                                if (absR >= 0.70) {
                                  interpretasiPola = `Hubungan antara '${currentX.replace(/_/g, " ")}' dan '${currentY.replace(/_/g, " ")}' tergolong SANGAT KUAT dan ${arah} (r = ${rCoef.toFixed(3)}). Hal ini mengindikasikan kecenderungan deterministik yang tinggi di mana kenaikan sumbu X hampir selalu diikuti dengan kenaikan/penurunan sumbu Y secara tegas.`;
                                } else if (absR >= 0.35) {
                                  interpretasiPola = `Hubungan tergolong SEDANG ke KUAT dan ${arah} (r = ${rCoef.toFixed(3)}). Terdapat tren yang jelas namun memiliki variansi acak/gangguan di sekeliling garis tren.`;
                                } else {
                                  interpretasiPola = `Hubungan linier tergolong LEMAH atau tidak signifikan (r = ${rCoef.toFixed(3)}). Sifat fluktuasi variabel X tidak memberikan pengaruh linier langsung pada variabel Y secara dominan.`;
                                }

                                if (isNonLinear) {
                                  rekomendasiVisual = `Kemiringan lokal berubah arah secara signifikan antara segmen nilai rendah dan tinggi (slope awal: ${slope1.toFixed(2)}, slope akhir: ${slope3.toFixed(2)}). Hubungan ini terdeteksi NON-LINIER (Melengkung/Kurva). Gunakan Scatter Plot dengan kurva polinomial kuadratik (Polynomial Orde-2) atau kurva lokal LOWESS agar lekukan tren terlihat optimal dibanding garis lurus OLS biasa.`;
                                  rekomendasiModel = "Disarankan menggunakan algoritma berbasis pohon keputusan (seperti Random Forest, Gradient Boosting) atau model polinomial regresi. Model linear standar akan menyisakan sisaan berpola dan melewatkan nilai optimum lokal.";
                                } else {
                                  rekomendasiVisual = "Pola hubungan cenderung linier (monoton) dengan kemiringan yang relatif konsisten. Gunakan Scatter Plot standar dengan garis regresi kuadrat terkecil (Standard OLS Linear Regression Line) untuk menangkap korelasi ini secara optimal.";
                                  rekomendasiModel = "Model Linear sederhana atau Generalized Linear Models (GLM) sangat cocok digunakan karena memiliki koefisien interpretasi yang tinggi tanpa resiko overfitting.";
                                }

                                const needLogX = Math.abs(skewX) > 1.2 && Math.min(...pts.map(p => p.x)) >= 0;
                                const needLogY = Math.abs(skewY) > 1.2 && Math.min(...pts.map(p => p.y)) >= 0;

                                if (needLogX && needLogY) {
                                  rekomendasiSumbu = `Kedua variabel memiliki kemiringan sebaran (skewness) positif yang tinggi (skew X: ${skewX.toFixed(1)}, Y: ${skewY.toFixed(1)}). Gunakan skala LOG-LOG (Logarithmic Scale pada kedua sumbu) untuk memampatkan pencilan ekstrem, agar konsentrasi data di daerah padat dapat dianalisis dengan lebih informatif.`;
                                } else if (needLogX) {
                                  rekomendasiSumbu = `Variabel '${currentX.replace(/_/g, " ")}' sangat miring (skewness: ${skewX.toFixed(1)}). Gunakan skala semi-log (X-axis Logarithmic) atau lakukan transformasi log1p (ln(x+1)) pada fitur X terlebih dahulu sebelum diregresikan.`;
                                } else if (needLogY) {
                                  rekomendasiSumbu = `Variabel '${currentY.replace(/_/g, " ")}' sangat miring (skewness: ${skewY.toFixed(1)}). Gunakan skala semi-log (Y-axis Logarithmic) atau lakukan transformasi Box-Cox/Log pada variabel target Y agar sisaan regresi berdistribusi normal.`;
                                } else {
                                  rekomendasiSumbu = "Sifat rentang data kedua variabel proporsional dan tidak didominasi pencilan asimetris ekstrem. Gunakan Skala Linier Standar (Standard Linear Axes Kartesian).";
                                }

                                return (
                                  <div className="bg-white p-4 rounded-lg border border-gray-150 shadow-3xs space-y-3.5 mt-3">
                                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                      <div className="p-1 px-1.5 rounded bg-[#107C41]/10 text-[#107C41]">
                                        <Sparkles className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <h4 className="text-2xs font-extrabold text-[#107C41] uppercase tracking-wider font-mono">
                                          🔬 Bivariate Relationship Optimizer & Advisor
                                        </h4>
                                        <p className="text-3xs text-gray-500 font-sans mt-0.5">
                                          Sistem memproses hubungan dinamis antara variabel terpilih dan memberikan arahan perlakuan model.
                                        </p>
                                      </div>
                                    </div>

                                    {/* Selector & Badges */}
                                    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                                      <div className="flex flex-wrap items-center gap-3.5 flex-1">
                                        <div className="space-y-1">
                                          <span className="text-[10px] font-bold text-gray-400 block font-sans">Variabel Independen (X):</span>
                                          <select
                                            value={currentX}
                                            onChange={(e) => setBivariateVarX(e.target.value)}
                                            className="text-2xs font-bold font-mono text-gray-800 bg-gray-50 border border-gray-250 rounded px-2.5 py-1 focus:ring-1 focus:ring-[#107C41] capitalize cursor-pointer focus:outline-none"
                                          >
                                            {activeRelCols.map(col => (
                                              <option key={col} value={col}>{col.replace(/_/g, " ")}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="space-y-1">
                                          <span className="text-[10px] font-bold text-gray-400 block font-sans">Variabel Dependen (Y):</span>
                                          <select
                                            value={currentY}
                                            onChange={(e) => setBivariateVarY(e.target.value)}
                                            className="text-2xs font-bold font-mono text-gray-800 bg-gray-50 border border-gray-250 rounded px-2.5 py-1 focus:ring-1 focus:ring-[#107C41] capitalize cursor-pointer focus:outline-none"
                                          >
                                            {activeRelCols.map(col => (
                                              <option key={col} value={col}>{col.replace(/_/g, " ")}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      {/* Key Indicators */}
                                      <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                                        <div className="text-center px-2.5 border-r border-gray-200">
                                          <div className="text-[9px] text-gray-400 font-mono">Pearson r</div>
                                          <div className={`text-2xs font-bold ${absR >= 0.4 ? "text-amber-700" : "text-gray-700"} font-mono`}>
                                            {rCoef > 0 ? `+${rCoef.toFixed(3)}` : rCoef.toFixed(3)}
                                          </div>
                                        </div>
                                        <div className="text-center px-2.5 border-r border-gray-200">
                                          <div className="text-[9px] text-gray-400 font-mono">R² (Fit)</div>
                                          <div className="text-2xs font-bold text-gray-700 font-mono">
                                            {rSq.toFixed(3)}
                                          </div>
                                        </div>
                                        <div className="text-center px-2.5">
                                          <div className="text-[9px] text-gray-400 font-mono">Sifat Pola</div>
                                          <div className={`text-[10px] font-black uppercase font-mono ${isNonLinear ? "text-amber-600" : "text-[#107C41]"}`}>
                                            {isNonLinear ? "NON-LINIER" : "LINIER"}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Actionable Recommendations list */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                                      <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-150 space-y-2">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700 font-mono uppercase tracking-wider">
                                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                          <span>1. Interpretasi Data & Pola</span>
                                        </div>
                                        <p className="text-[11px] text-gray-600 leading-relaxed font-sans">{interpretasiPola}</p>
                                      </div>

                                      <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-150 space-y-2">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700 font-mono uppercase tracking-wider">
                                          <span className="h-1.5 w-1.5 rounded-full bg-[#107C41]"></span>
                                          <span>2. Rekomendasi Skala Sumbu</span>
                                        </div>
                                        <p className="text-[11px] text-gray-600 leading-relaxed font-sans">{rekomendasiSumbu}</p>
                                      </div>

                                      <div className="bg-[#FAFBF9] p-3 rounded-lg border border-emerald-100/80 space-y-2">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#107C41] font-mono uppercase tracking-wider">
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                          <span>3. Rekomendasi Tipe Visualisasi</span>
                                        </div>
                                        <p className="text-[11px] text-[#1D5E2D] leading-relaxed font-sans">{rekomendasiVisual}</p>
                                      </div>

                                      <div className="bg-amber-50/20 p-3 rounded-lg border border-amber-150/40 space-y-2">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 font-mono uppercase tracking-wider">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                          <span>4. Pengaruh Pada Modeling ML</span>
                                        </div>
                                        <p className="text-[11px] text-amber-900 leading-relaxed font-sans">{rekomendasiModel}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()
                      )}

                      {/* TAB 4: Universal Unique Entity Profiler (Advanced Dataset Explorer) */}
                      {activeEdaTab === "profiler" && (
                        <DatasetExplorer
                          schema={schema}
                          engineeredData={engineeredData}
                          deletedColumns={deletedColumns}
                          formatExcelValue={formatExcelValue}
                        />
                      )}

                      {/* Automated Business diagnostics report list (Heuristics) */}
                      {(() => {
                        let activeInsights: string[] = [];
                        let tabTitleLabel = "Auto-Generated Analytics (analytics.py)";
                        if (activeEdaTab === "summary") {
                          activeInsights = edaDiag.summary_insights || edaDiag.insights || [];
                          tabTitleLabel = "WORKBOOK METRICS INSIGHTS (analytics_summary.py)";
                        } else if (activeEdaTab === "distribution") {
                          const activeColName = distSelectedCol || numericColumns[0] || "";
                          const rawColName = activeColName.toLowerCase();
                          const formattedColName = activeColName.replace(/_/g, " ").toLowerCase();
                          const allDistInsights = edaDiag.distribution_insights || edaDiag.insights || [];
                          activeInsights = allDistInsights.filter(insight => {
                            const lowInsight = insight.toLowerCase();
                            return lowInsight.includes(formattedColName) || lowInsight.includes(rawColName);
                          });
                          const niceColName = activeColName ? activeColName.replace(/_/g, " ") : "";
                          tabTitleLabel = niceColName 
                            ? `${niceColName.toUpperCase()} NORMALITY & PROFILE SHAPE INSIGHTS (analytics_distribution.py)`
                            : "NORMALITY & PROFILE SHAPE INSIGHTS (analytics_distribution.py)";
                        } else if (activeEdaTab === "relationship") {
                          activeInsights = edaDiag.relationship_insights || edaDiag.insights || [];
                          tabTitleLabel = "COVARIANCE & CO-DEPENDENCY INSIGHTS (analytics_relationship.py)";
                        } else {
                          activeInsights = edaDiag.insights || [];
                          const activeColName = profilerCol || (Object.keys(schema).length > 0 ? Object.keys(schema)[0] : "customer_id");
                          const formattedColName = activeColName.replace(/_/g, " ").toUpperCase();
                          const activeValStr = profilerVal ? `"${profilerVal}"` : "ID";
                          tabTitleLabel = `ANALISIS ENTITAS ${formattedColName}: ${activeValStr} (analytics_profiler.py)`;
                        }

                        if (activeInsights.length === 0) return null;

                        const displayedInsights = showAllEdaInsights ? activeInsights : activeInsights.slice(0, 5);

                        return (
                          <div className="bg-emerald-50/40 border-l-4 border-[#107C41] p-3 rounded-r-md space-y-1.5 transition-all">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-[#107C41]" />
                                <span className="text-3xs font-extrabold text-emerald-800 uppercase tracking-wider font-mono">
                                  {tabTitleLabel}
                                </span>
                              </div>
                              <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded font-mono">
                                {activeInsights.length} Items
                              </span>
                            </div>
                            <ul className="text-3xs text-emerald-950 space-y-1 pl-4 list-disc font-sans leading-relaxed font-semibold">
                              {displayedInsights.map((insight, idx) => (
                                <li key={idx} className="transition-opacity duration-300">{insight}</li>
                              ))}
                            </ul>
                            {activeInsights.length > 5 && (
                              <div className="pt-1.5 border-t border-emerald-100/40 flex">
                                <button
                                  type="button"
                                  onClick={() => setShowAllEdaInsights(!showAllEdaInsights)}
                                  className="text-[10px] text-[#107C41] font-bold hover:text-emerald-850 hover:underline cursor-pointer transition-colors inline-flex items-center gap-1 font-mono focus:outline-none"
                                >
                                  {showAllEdaInsights ? (
                                    <>Hide ({activeInsights.length - 5} Insights)</>
                                  ) : (
                                    <>Read More (+{activeInsights.length - 5} More Insights)</>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </section>
              </div>
            )}

              {/* Module 4: Live Data Science Sandbox */}
              {rawData && (
                <div style={{ display: activeModuleTab === "module4" ? "block" : "none" }}>
                  <DataScienceSandbox
                    rawData={rawData}
                    engineeredData={engineeredData}
                    ingestedData={ingestedData}
                    schema={schema}
                    deletedColumns={deletedColumns}
                  />
                </div>
              )}

              {/* Step Export Downloader */}
              {completedStep >= 2 && engineeredData && (
                <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-2xs text-center space-y-3">
                  <div className="h-8 w-8 rounded-full bg-[#107C41]/10 text-[#107C41] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-4.5 w-4.5 text-[#107C41]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-xs">Pipeline Validation Finished Successfully</h3>
                    <p className="text-3xs text-gray-500 mt-0.5 max-w-lg mx-auto leading-normal">
                      All logical conditions and statistical drift metrics conform to standard models. Download the treated dataset file or inspect python scripts.
                    </p>
                  </div>

                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      id="btn-download-csv"
                      onClick={handleDownloadCSV}
                      className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-3xs px-3 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1.5 shadow-3xs cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download Cleaned CSV Dataset</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("source")}
                      className="bg-[#107C41] hover:bg-[#0b592e] text-white text-3xs px-3 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1.5 shadow-3xs cursor-pointer"
                    >
                      <Code className="h-3 w-3" />
                      <span>Inspect Python Workspace Code</span>
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      <footer className="bg-white border-t border-[#E2E8F0] py-6 text-center text-xs text-gray-500 mt-auto font-mono">
        Designed with Excel Green Theme &bull; Data Science Workspace System v1.2
      </footer>
    </div>
  );
}
