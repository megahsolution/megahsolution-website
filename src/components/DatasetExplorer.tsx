import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Filter as FilterIcon, 
  Calendar, 
  Layers, 
  Sparkles, 
  Check, 
  ChevronDown, 
  BarChart2, 
  LineChart as LineIcon, 
  PieChart as PieIcon, 
  Grid, 
  Layout, 
  Database,
  Search,
  Maximize2,
  Settings,
  SlidersHorizontal,
  RotateCcw,
  Download,
  Info,
  Tag,
  Hash,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet
} from "lucide-react";

interface DatasetExplorerProps {
  engineeredData: any[] | null;
  schema: Record<string, "datetime" | "float" | "int" | "category">;
  deletedColumns: string[];
  formatExcelValue: (val: any, fmt?: string) => string;
}

export function DatasetExplorer({ 
  engineeredData, 
  schema, 
  deletedColumns,
  formatExcelValue 
}: DatasetExplorerProps) {
  const allRows = useMemo(() => engineeredData || [], [engineeredData]);

  // Valid Column Options
  const columnOptions = useMemo(() => {
    return Object.keys(schema).filter(col => !deletedColumns.includes(col));
  }, [schema, deletedColumns]);

  // 1. Data Structure Classification
  const classifiedCols = useMemo(() => {
    const categories: Record<string, string[]> = {
      identifier: [],
      category: [],
      numeric: [],
      datetime: [],
      text: [],
      boolean: []
    };

    columnOptions.forEach(col => {
      const type = schema[col];
      const colLower = col.toLowerCase();
      
      // Compute unique values to analyze cardinality & boolean nature
      const uniqueSet = new Set(allRows.map(r => r[col]).filter(v => v !== undefined && v !== null && v !== ""));
      const uniqueVals = Array.from(uniqueSet);
      
      const isBoolValues = uniqueVals.length <= 2 && uniqueVals.length > 0 && uniqueVals.every(v => {
        const s = String(v).toLowerCase();
        return s === "true" || s === "false" || s === "0" || s === "1" || s === "yes" || s === "no" || s === "ya" || s === "tidak";
      });

      if (isBoolValues) {
        categories.boolean.push(col);
      } else if (type === "datetime") {
        categories.datetime.push(col);
      } else if (type === "float" || type === "int") {
        categories.numeric.push(col);
      } else if (colLower.endsWith("id") || colLower.endsWith("code") || colLower.endsWith("key") || colLower.includes("_id") || (type === "category" && uniqueVals.length > 50)) {
        categories.identifier.push(col);
      } else if (type === "category") {
        categories.category.push(col);
      } else {
        categories.text.push(col);
      }
    });

    return categories;
  }, [columnOptions, allRows, schema]);

  // States for query configuration (Fields Mapping Wells)
  const [measureCol, setMeasureCol] = useState<string>("");
  const [aggOp, setAggOp] = useState<string>("");
  const [groupByCols, setGroupByCols] = useState<string[]>([]);
  const [timeCol, setTimeCol] = useState<string>("");
  const [timeGranularity, setTimeGranularity] = useState<string>("month");
  
  // Custom states for filters & slicers
  const [filters, setFilters] = useState<{ col: string; op: string; val: string }[]>([]);
  const [chartOverride, setChartOverride] = useState<string>("auto");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Drill Down Filter (Interactive Cross-Filtering)
  const [drillFilter, setDrillFilter] = useState<{ col: string; val: any } | null>(null);

  // Interactive Quick Slicers selection
  const [activeQuickSlicers, setActiveQuickSlicers] = useState<Record<string, string>>({});

  // Pagination for drill down Raw Table
  const [rawPage, setRawPage] = useState<number>(1);
  const [rawSearchQuery, setRawSearchQuery] = useState<string>("");
  const itemsPerPage = 8;

  // Format column label with textual types instead of colorful emojis to keep UI looking pristine and clean
  const getColLabel = (col: string): string => {
    const label = col.replace(/_/g, " ");
    if (classifiedCols.category.includes(col)) return `[Category] ${label}`;
    if (classifiedCols.numeric.includes(col)) return `[Numeric] ${label}`;
    if (classifiedCols.datetime.includes(col)) return `[DateTime] ${label}`;
    if (classifiedCols.boolean.includes(col)) return `[Boolean] ${label}`;
    if (classifiedCols.identifier.includes(col)) return `[ID] ${label}`;
    return label;
  };

  // Auto-resolve reasonable configurations dynamically if empty or changed
  const activeMeasureCol = useMemo(() => {
    if (measureCol && columnOptions.includes(measureCol)) return measureCol;
    if (classifiedCols.numeric.length > 0) return classifiedCols.numeric[0];
    return "RowCount";
  }, [measureCol, columnOptions, classifiedCols]);

  const activeAggOp = useMemo(() => {
    if (aggOp) return aggOp;
    if (activeMeasureCol === "RowCount") return "count";
    // Check if the measure column has keywords indicating sum is best
    const lowCol = activeMeasureCol.toLowerCase();
    if (lowCol.includes("amount") || lowCol.includes("sales") || lowCol.includes("total") || lowCol.includes("price") || lowCol.includes("revenue")) {
      return "sum";
    }
    return "avg";
  }, [aggOp, activeMeasureCol]);

  const activeGroupByCols = useMemo(() => {
    const valid = groupByCols.filter(c => columnOptions.includes(c) && c !== "");
    if (valid.length > 0) return valid;
    // Suggest first available category column
    if (classifiedCols.category.length > 0) return [classifiedCols.category[0]];
    if (classifiedCols.boolean.length > 0) return [classifiedCols.boolean[0]];
    if (columnOptions.length > 0) return [columnOptions[0]];
    return [];
  }, [groupByCols, columnOptions, classifiedCols]);

  const activeTimeCol = useMemo(() => {
    if (timeCol !== "" && (timeCol === "None" || columnOptions.includes(timeCol))) return timeCol;
    if (classifiedCols.datetime.length > 0) return classifiedCols.datetime[0];
    return "None";
  }, [timeCol, columnOptions, classifiedCols]);

  // Reset function
  const handleResetFilters = () => {
    setFilters([]);
    setActiveQuickSlicers({});
    setDrillFilter(null);
    setRawPage(1);
  };

  const handleAddFilter = () => {
    if (columnOptions.length > 0) {
      const firstCol = columnOptions[0];
      const targetType = schema[firstCol] || "category";
      const isNumericCol = targetType === "float" || targetType === "int";
      setFilters(prev => [...prev, { col: firstCol, op: isNumericCol ? "=" : "contains", val: "" }]);
    }
  };

  const handleUpdateFilter = (idx: number, key: "col" | "op" | "val", value: string) => {
    setFilters(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  };

  const handleRemoveFilter = (idx: number) => {
    setFilters(prev => prev.filter((_, i) => i !== idx));
  };

  // Toggle quick slicer
  const handleToggleSlicer = (col: string, val: string) => {
    setRawPage(1);
    setDrillFilter(null); // Clear active visual drill-down is expected upon new slicer apply
    setActiveQuickSlicers(prev => {
      const updated = { ...prev };
      if (updated[col] === val) {
        delete updated[col];
      } else {
        updated[col] = val;
      }
      return updated;
    });
  };

  // Pre-aggregation Filter application
  const filteredData = useMemo(() => {
    let dataset = [...allRows];

    // 1. Apply user custom filters
    filters.forEach(f => {
      if (!f.col) return;
      const targetType = schema[f.col];
      const valComp = String(f.val).toLowerCase();
      
      dataset = dataset.filter(r => {
        const rawVal = r[f.col];
        if (rawVal === undefined || rawVal === null) return f.op === "is_empty";
        
        const itemValStr = String(rawVal);
        const itemValLower = itemValStr.toLowerCase();
        const itemNum = Number(rawVal);
        const filterNum = Number(f.val);

        switch (f.op) {
          case "=":
            return itemValLower === valComp;
          case "!=":
            return itemValLower !== valComp;
          case ">":
            return !isNaN(itemNum) && !isNaN(filterNum) && itemNum > filterNum;
          case "<":
            return !isNaN(itemNum) && !isNaN(filterNum) && itemNum < filterNum;
          case ">=":
            return !isNaN(itemNum) && !isNaN(filterNum) && itemNum >= filterNum;
          case "<=":
            return !isNaN(itemNum) && !isNaN(filterNum) && itemNum <= filterNum;
          case "contains":
            return itemValLower.includes(valComp);
          case "starts_with":
            return itemValLower.startsWith(valComp);
          case "ends_with":
            return itemValLower.endsWith(valComp);
          case "is_empty":
            return itemValLower.trim() === "";
          case "is_not_empty":
            return itemValLower.trim() !== "";
          default:
            return true;
        }
      });
    });

    // 2. Apply interactive dashboard Quick Slicers
    Object.entries(activeQuickSlicers).forEach(([col, val]) => {
      const valComp = String(val).toLowerCase();
      dataset = dataset.filter(r => {
        const rawVal = r[col];
        if (rawVal === undefined || rawVal === null) return false;
        return String(rawVal).toLowerCase() === valComp;
      });
    });

    return dataset;
  }, [allRows, filters, activeQuickSlicers, schema]);

  // Convert row time string to labels of granularity
  const formatTimeGranularityLabel = (valStr: any, gran: string): { label: string; sortKey: number } => {
    if (!valStr) return { label: "Unknown Date", sortKey: 0 };
    const d = new Date(valStr);
    if (isNaN(d.getTime())) return { label: "Invalid Date", sortKey: 0 };
    
    const year = d.getFullYear();
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = d.getHours();

    const startOfYear = new Date(year, 0, 1);
    const diff = d.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const week = Math.floor(diff / (oneDay * 7)) + 1;

    switch (gran) {
      case "year":
        return { label: `${year}`, sortKey: year };
      case "quarter":
        return { label: `${year} Q${quarter}`, sortKey: year * 10 + quarter };
      case "month": {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
        return { label: `${monthNames[month - 1]} ${year}`, sortKey: year * 100 + month };
      }
      case "week":
        return { label: `${year} W${week}`, sortKey: year * 100 + week };
      case "day":
        return { label: `${day}/${month}/${year}`, sortKey: d.getTime() };
      case "hour":
        return { label: `${day}/${month} ${String(hour).padStart(2, "0")}:00`, sortKey: d.getTime() };
      default:
        return { label: `${year}`, sortKey: year };
    }
  };

  // Group and Aggregate data
  const aggregatedData = useMemo(() => {
    const groups: Record<string, {
      keys: Record<string, string>;
      timeLabel?: string;
      timeSortKey?: number;
      vals: number[];
      raw: any[];
    }> = {};

    filteredData.forEach(row => {
      const keysObj: Record<string, string> = {};
      activeGroupByCols.forEach(col => {
        keysObj[col] = String(row[col] !== undefined && row[col] !== null ? row[col] : "N/A");
      });

      let timeLabel = "";
      let timeSortKey = 0;
      if (activeTimeCol !== "None") {
        const tFmt = formatTimeGranularityLabel(row[activeTimeCol], timeGranularity);
        timeLabel = tFmt.label;
        timeSortKey = tFmt.sortKey;
      }

      const groupKeyParts = activeGroupByCols.map(col => keysObj[col]);
      if (activeTimeCol !== "None") {
        groupKeyParts.push(timeLabel);
      }
      const finalGroupKey = groupKeyParts.join(" || ");

      if (!groups[finalGroupKey]) {
        groups[finalGroupKey] = {
          keys: keysObj,
          timeLabel: activeTimeCol !== "None" ? timeLabel : undefined,
          timeSortKey: activeTimeCol !== "None" ? timeSortKey : undefined,
          vals: [],
          raw: []
        };
      }

      if (activeMeasureCol !== "RowCount") {
        const mVal = Number(row[activeMeasureCol]);
        if (!isNaN(mVal)) {
          groups[finalGroupKey].vals.push(mVal);
        }
      }
      groups[finalGroupKey].raw.push(row);
    });

    const results = Object.values(groups).map((g, index) => {
      const count = g.raw.length;
      let aggVal = 0;

      if (activeMeasureCol === "RowCount") {
        aggVal = count;
      } else {
        switch (activeAggOp) {
          case "count":
            aggVal = count;
            break;
          case "distinct":
            aggVal = new Set(g.raw.map(r => r[activeMeasureCol]).filter(v => v !== undefined && v !== null)).size;
            break;
          case "sum":
            aggVal = g.vals.reduce((s, v) => s + v, 0);
            break;
          case "avg":
            aggVal = g.vals.length > 0 ? g.vals.reduce((s, v) => s + v, 0) / g.vals.length : 0;
            break;
          case "median": {
            if (g.vals.length === 0) {
              aggVal = 0;
            } else {
              const sorted = [...g.vals].sort((a, b) => a - b);
              const mid = Math.floor(sorted.length / 2);
              aggVal = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            }
            break;
          }
          case "min":
            aggVal = g.vals.length > 0 ? Math.min(...g.vals) : 0;
            break;
          case "max":
            aggVal = g.vals.length > 0 ? Math.max(...g.vals) : 0;
            break;
          case "frequency":
            aggVal = count; // default to count representing raw hits
            break;
          default:
            aggVal = count;
        }
      }

      return {
        id: index,
        keys: g.keys,
        timeLabel: g.timeLabel,
        timeSortKey: g.timeSortKey,
        rawRows: g.raw,
        aggValue: aggVal,
        count
      };
    });

    // Filter to keep only logically valid groups that have active records
    const withData = results.filter(r => r.count > 0 && r.aggValue !== null && r.aggValue !== undefined && !isNaN(r.aggValue));

    // Sort chronological for timelines, or descending aggregate value (highest first) for categorical metrics
    return withData.sort((a, b) => {
      if (activeTimeCol !== "None" && a.timeSortKey !== undefined && b.timeSortKey !== undefined) {
        return a.timeSortKey - b.timeSortKey;
      }
      return b.aggValue - a.aggValue; // Descending to naturally list highest count / volume first
    });
  }, [filteredData, activeGroupByCols, activeTimeCol, timeGranularity, activeMeasureCol, activeAggOp]);

  // Auto-Select Visualization
  const autoChartType = useMemo(() => {
    if (activeGroupByCols.length === 0 && activeTimeCol === "None") {
      return "kpi";
    }
    if (activeTimeCol !== "None") {
      return "line";
    }
    if (activeGroupByCols.length === 2) {
      return "heatmap";
    }
    if (activeGroupByCols.length > 2) {
      return "table";
    }
    
    // Exactly 1 group by, no time
    if (aggregatedData.length > 1 && aggregatedData.length <= 6) {
      return "pie";
    }
    return "bar";
  }, [activeGroupByCols, activeTimeCol, aggregatedData]);

  const activeChart = chartOverride === "auto" ? autoChartType : chartOverride;

  // Compute values for standard Categorical Quick Slicers top categories automatically
  const quickSlicerOptions = useMemo(() => {
    const list: { column: string; values: { val: string; count: number }[] }[] = [];
    
    // Pick first 2 category columns
    const colsToUse = classifiedCols.category.slice(0, 2);
    
    colsToUse.forEach(col => {
      const counts: Record<string, number> = {};
      allRows.forEach(r => {
        const val = r[col];
        if (val !== undefined && val !== null && val !== "") {
          const s = String(val);
          counts[s] = (counts[s] || 0) + 1;
        }
      });
      
      const sortedVals = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([val, count]) => ({ val, count }));
        
      if (sortedVals.length > 0) {
        list.push({ column: col, values: sortedVals });
      }
    });
    
    return list;
  }, [classifiedCols.category, allRows]);

  // Apply drill-down cross-filter if item is selected
  const detailData = useMemo(() => {
    let dataset = [...filteredData];
    
    // Apply drill-down filter if user clicked a specific visual element
    if (drillFilter) {
      dataset = dataset.filter(row => {
        const rowVal = row[drillFilter.col];
        return String(rowVal) === String(drillFilter.val);
      });
    }

    // Apply Live Table keyword search query
    if (rawSearchQuery.trim() !== "") {
      const q = rawSearchQuery.toLowerCase();
      dataset = dataset.filter(row => {
        return Object.values(row).some(v => String(v).toLowerCase().includes(q));
      });
    }

    return dataset;
  }, [filteredData, drillFilter, rawSearchQuery]);

  // Detail records for current page
  const totalPages = Math.max(1, Math.ceil(detailData.length / itemsPerPage));
  const pageItems = useMemo(() => {
    const startIdx = (rawPage - 1) * itemsPerPage;
    return detailData.slice(startIdx, startIdx + itemsPerPage);
  }, [detailData, rawPage]);

  // Export Active Filtered Data as CSV
  const exportToCSV = () => {
    if (detailData.length === 0) return;
    
    // Headers
    const headers = Object.keys(detailData[0]).filter(k => k !== "id");
    const csvRows = [headers.join(",")];
    
    detailData.forEach(row => {
      const values = headers.map(header => {
        const val = row[header];
        const stringified = val !== undefined && val !== null ? String(val) : "";
        // Clean Excel values (replace double quotes and escape commas)
        const escaped = stringified.replace(/"/g, '""');
        return escaped.includes(",") || escaped.includes("\n") || escaped.includes('"') 
          ? `"${escaped}"` 
          : escaped;
      });
      csvRows.push(values.join(","));
    });
    
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Analytics_Drill_Through_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Indonesian Dynamic Summary Insights (Formatted in Power BI theme style)
  const dynamicInsights = useMemo(() => {
    const list: string[] = [];
    if (allRows.length === 0) {
      return ["Mohon muat berkas dataset terlebih dahulu."];
    }
    if (filteredData.length === 0) {
      return ["Tidak ada data yang cocok dengan saringan aktif. Cobalah hapus saringan Anda."];
    }

    list.push(`Tipe struktur terdeteksi: **${columnOptions.length}** kolom aktif teranalisis.`);
    list.push(`Saringan aktif menyaring **${filteredData.length}** baris data (${Math.round((filteredData.length / allRows.length) * 100)}% dari total ${allRows.length} data).`);
    
    if (aggregatedData.length > 0) {
      const highest = aggregatedData[0];
      const lowest = aggregatedData[aggregatedData.length - 1];
      
      const formatVal = (v: number) => {
        if (activeAggOp === "avg" || activeAggOp === "median") return v.toFixed(2);
        return v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
      };

      const getGroupStr = (item: typeof highest) => {
        const parts = Object.entries(item.keys).map(([col, val]) => `${col.replace(/_/g, " ")}: "${val}"`);
        if (item.timeLabel) parts.push(`Periode: ${item.timeLabel}`);
        return parts.join(", ");
      };

      list.push(`**Kontribusi Tertinggi**: Kelompok [${getGroupStr(highest)}] mendominasi dengan nilai agregasi **${formatVal(highest.aggValue)}** (${activeAggOp.toUpperCase()}).`);
      
      if (highest !== lowest && aggregatedData.length > 1) {
        list.push(`**Nilai Terendah**: Sebaliknya, kelompok [${getGroupStr(lowest)}] mencatat nilai terkecil senilai **${formatVal(lowest.aggValue)}**.`);
      }

      if (activeTimeCol !== "None" && aggregatedData.length > 1) {
        const firstVal = aggregatedData[0].aggValue;
        const lastVal = aggregatedData[aggregatedData.length - 1].aggValue;
        const change = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;
        const trendDir = change >= 0 ? "kenaikan" : "penurunan";
        list.push(`**Analisis Tren**: Berdasarkan runtun waktu, tercatat arah ${trendDir} kumulatif sebesar **${Math.abs(change).toFixed(1)}%** dari periode awal ke akhir.`);
      }
    }
    return list;
  }, [allRows, filteredData, aggregatedData, activeTimeCol, activeAggOp, columnOptions]);

  // Color map representing interactive visual palettes (Green-themed and secondary accents)
  const colors = [
    "#107C41", // Primary Green
    "#2E7D32", // Dark Green
    "#F2C811", // Amber Yellow
    "#E65100", // Soft Orange
    "#8660a9", // Elegant Purple
    "#00A2E8", // Teal Cyan
    "#D94A1F", // Coral Red
    "#708090", // Cool Slate
    "#E21A1A", // Bright Red
    "#FF8C00"  // Dark Orange
  ];

  return (
    <div className="bg-[#FAF9F8] p-4 md:p-6 rounded-xl border border-[#E0DFDD] mt-4 space-y-5 select-text text-left font-sans text-xs text-[#252423]">
      
      {/* 1. TITLE BAR HEADLINE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DFDD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#107C41]/10 text-[#107C41] font-black px-2 py-0.5 rounded uppercase font-mono tracking-wider">
              Workspace Engine
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500 font-mono text-[10px]">Modul Analisis Internal</span>
          </div>
          <h3 className="text-sm font-bold text-[#252423] mt-1 flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-400 shrink-0" />
            <span>Analisis Segmentasi Interaktif & Visualisasi Pivot</span>
          </h3>
          <p className="text-gray-500 text-[11px] mt-0.5 font-sans leading-relaxed">
            Metode visualisasi data multi-level adaptif. Petakan variabel sumbu, definisikan operator agregasi cerdas, terapkan saringan manual, dan klik visual grafik untuk analisis telusur-rinci (drill-down).
          </p>
        </div>
      </div>

      {/* 2. DYNAMIC SLICERS BAR (INTERACTIVE CATEGORICAL SLICERS) */}
      {quickSlicerOptions.length > 0 && (
         <div className="bg-white p-4 rounded-lg border border-[#E0DFDD] shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#252423] uppercase tracking-wide flex items-center gap-1.5 font-sans">
              <FilterIcon className="h-3.5 w-3.5 text-gray-400" />
              <span>Saringan Dashboard Cepat (Interactive KPI Slicers)</span>
            </span>
            <span className="text-gray-450 text-[11px] italic">Klik badge nilai untuk memfilter seluruh laporan visualisasi secara instan</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickSlicerOptions.map(sliceGroup => {
              const activeVal = activeQuickSlicers[sliceGroup.column];
              return (
                <div key={sliceGroup.column} className="space-y-1.5 text-left border-l-2 border-[#107C41] pl-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
                    Slicers: {sliceGroup.column.replace(/_/g, " ")}
                  </span>
                  
                  <div className="flex flex-wrap gap-1 md:gap-1.5">
                    {sliceGroup.values.map(v => {
                      const isSelected = activeVal === v.val;
                      return (
                        <button
                          key={v.val}
                          type="button"
                          onClick={() => handleToggleSlicer(sliceGroup.column, v.val)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold leading-none border transition-all cursor-pointer active:scale-95 ${
                            isSelected 
                              ? "bg-[#107C41]/15 border-[#107C41] text-[#0b592e]" 
                              : "bg-[#F3F2F1] border-[#E0DFDD] text-[#323130] hover:bg-[#EDEBE9]"
                          }`}
                        >
                          <span className="capitalize">{v.val}</span>
                          <span className={`text-[10px] px-1 rounded-full ${isSelected ? "bg-[#107C41] text-white" : "bg-[#D2D0CE] text-[#323130]"}`}>
                            {v.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. REPORT WORKSPACE DESIGN (SIDEBAR + MAIN CANVAS) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        
        {/* ================= LEFT SIDEBAR PANEL: WORKSPACE FIELDS MANAGER ================= */}
        <div className="xl:col-span-3 bg-white rounded-lg border border-[#E0DFDD] shadow-sm p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Visual Type Palette Selector */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[#252423] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Layout className="h-4 w-4 text-gray-400" />
                <span>Visualizations Palette</span>
              </span>
              
              <div className="grid grid-cols-4 gap-1 bg-[#F3F2F1] p-1 rounded">
                {[
                  { id: "auto", icon: <Sparkles className="h-3.5 w-3.5" />, label: "Auto" },
                  { id: "bar", icon: <BarChart2 className="h-3.5 w-3.5" />, label: "Column" },
                  { id: "line", icon: <LineIcon className="h-3.5 w-3.5" />, label: "Trend" },
                  { id: "pie", icon: <PieIcon className="h-3.5 w-3.5" />, label: "Donut" },
                  { id: "kpi", icon: <SlidersHorizontal className="h-3.5 w-3.5" />, label: "Cards" },
                  { id: "heatmap", icon: <Grid className="h-3.5 w-3.5" />, label: "Matrix" },
                  { id: "table", icon: <Layers className="h-3.5 w-3.5" />, label: "Grid" },
                ].map(v => {
                  const isCur = visualMatch(v.id, activeChart, chartOverride);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setChartOverride(v.id);
                        setHoverIndex(null);
                        setDrillFilter(null);
                      }}
                      className={`p-1.5 rounded transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                        isCur
                          ? "bg-[#107C41] text-white shadow-sm font-bold" 
                          : "text-[#323130] hover:bg-[#EDEBE9]"
                      }`}
                      title={`Ubah format laporan menjadi: ${v.label}`}
                    >
                      {v.icon}
                      <span className="text-[8.5px] mt-0.5 leading-none font-mono block truncate w-full">{v.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field Wells Mapping */}
            <div className="space-y-4 pt-2 border-t border-[#E0DFDD]">
              <span className="text-[10px] font-bold text-[#252423] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-gray-400" />
                <span>Field Mapping Wells</span>
              </span>

              {/* Connected Relational Dimensions Group Container */}
              <div className="space-y-3.5 bg-white rounded-lg">
                
                {/* 1. Dimension 1: Sumbu Utama & Analisis Ringkasan */}
                <div className="space-y-1.5 text-left bg-[#FAF9F8] p-3 rounded border border-[#EDEBE9]">
                  <div className="flex items-center justify-between">
                    <label htmlFor="group-wells-select-1" className="text-[10px] font-bold text-[#107C41] uppercase tracking-wider">
                      Axis • Dimension 1 (Row)
                    </label>
                    {groupByCols.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setGroupByCols([]);
                          setMeasureCol("");
                          setAggOp("");
                        }} 
                        className="text-[9px] text-[#107C41] hover:underline font-bold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  <select
                    id="group-wells-select-1"
                    value={activeGroupByCols[0] || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const next = [
                        v,
                        activeGroupByCols[1] || ""
                      ];
                      setGroupByCols(next.filter(Boolean));
                      setDrillFilter(null);
                    }}
                    className="w-full text-xs font-semibold font-mono text-gray-800 bg-white border border-[#D2D0CE] rounded p-1 hover:border-[#107C41] focus:outline-none"
                  >
                    <option value="">-- No Grouping --</option>
                    {columnOptions.map(col => (
                      <option key={col} value={col}>
                        {getColLabel(col)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Dimension 2: Pecahan Kolom Pivot */}
                <div className="pl-4 border-l-2 border-dashed border-gray-200 space-y-1.5 text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-sans">
                      └── Dimension 2 (Broken Down By / Column)
                    </span>
                  </div>
                  
                  <div className="bg-[#FAF9F8] p-2 rounded border border-[#EDEBE9]">
                    <select
                      id="group-wells-select-2"
                      value={activeGroupByCols[1] || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = [
                          activeGroupByCols[0] || "",
                          v
                        ];
                        setGroupByCols(next.filter(Boolean));
                        setDrillFilter(null);
                      }}
                      className="w-full text-xs font-semibold font-mono text-gray-800 bg-white border border-[#D2D0CE] rounded p-1 hover:border-[#107C41] focus:outline-none"
                    >
                      <option value="">-- No Column Grouping (Optional) --</option>
                      {columnOptions.map(col => {
                        if (col === activeGroupByCols[0]) return null;
                        return (
                          <option key={col} value={col}>
                            {getColLabel(col)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* 3. Analysis On (Value to Measure) */}
                <div className="pl-4 border-l-2 border-dashed border-gray-200 space-y-2.5 text-left bg-emerald-50/25 p-2.5 rounded border border-emerald-100">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-[#107C41] uppercase tracking-wider font-sans">
                      └── Analysis On (Value to Measure)
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label htmlFor="measure-col-select" className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block font-sans">
                        Target Column / Metric
                      </label>
                      <select
                        id="measure-col-select"
                        value={activeMeasureCol}
                        onChange={(e) => {
                          setMeasureCol(e.target.value);
                          if (e.target.value === "RowCount") {
                            setAggOp("count");
                          }
                          setDrillFilter(null);
                        }}
                        className="w-full text-xs font-semibold font-mono text-gray-800 bg-white border border-[#D2D0CE] rounded p-1 hover:border-[#107C41] focus:outline-none"
                      >
                        <option value="RowCount">RowCount (Jumlah Baris Data)</option>
                        {columnOptions.map(col => (
                          <option key={col} value={col}>
                            {getColLabel(col)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="agg-op-select" className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block font-sans">
                        Task / Aggregation Operator (Fungsi Ringkasan)
                      </label>
                      <select
                        id="agg-op-select"
                        value={activeAggOp}
                        onChange={(e) => {
                          setAggOp(e.target.value);
                          setDrillFilter(null);
                        }}
                        disabled={activeMeasureCol === "RowCount"}
                        className="w-full text-xs font-semibold font-mono text-[#0b592e] bg-[#107C41]/5 border border-[#107C41]/25 rounded p-1 hover:border-[#107C41] focus:outline-none disabled:bg-[#EDEBE9] disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-[#D2D0CE]"
                      >
                        <option value="count">Count (Total Hitung Baris)</option>
                        <option value="distinct">Distinct Count (Nilai Unik Saja)</option>
                        {(activeMeasureCol === "RowCount" || classifiedCols.numeric.includes(activeMeasureCol)) && (
                          <>
                            <option value="sum">Sum (Hasil Penjumlahan)</option>
                            <option value="avg">Average (Rata-rata Mean)</option>
                            <option value="median">Median (Nilai Tengah)</option>
                            <option value="min">Min (Nilai Terendah)</option>
                            <option value="max">Max (Nilai Tertinggi)</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

              </div>

              {/* Active Selected Dimensions Summary Badges */}
              {activeGroupByCols.length > 0 && (
                <div className="flex flex-wrap gap-1 p-2 bg-[#FAF9F8] rounded border border-[#EDEBE9]">
                  {activeGroupByCols.map((col, index) => (
                    <span key={col} className="bg-[#107C41]/10 text-[#0b592e] text-[9.5px] px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                      <Tag className="h-2.5 w-2.5 shrink-0 text-gray-400" />
                      <span className="truncate max-w-[120px]">
                        D{index + 1}: {col}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Chronological Time Dimension well */}
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Timeline Time Axis
                </label>
                
                <div className="bg-[#FAF9F8] p-2 rounded border border-[#EDEBE9] space-y-1.5">
                  <select
                    value={activeTimeCol}
                    onChange={(e) => {
                      setTimeCol(e.target.value);
                      setDrillFilter(null);
                    }}
                    className="w-full text-xs font-semibold font-mono text-gray-800 bg-white border border-[#D2D0CE] rounded p-1 hover:border-[#107C41] focus:outline-none"
                  >
                    <option value="None">[Non-Aktifkan Domain Waktu]</option>
                    {columnOptions.map(col => {
                      const isDt = classifiedCols.datetime.includes(col);
                      const label = getColLabel(col);
                      return (
                        <option key={col} value={col}>
                          {isDt ? `[Date] ${col}` : label}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    value={timeGranularity}
                    onChange={(e) => {
                      setTimeGranularity(e.target.value);
                      setDrillFilter(null);
                    }}
                    disabled={activeTimeCol === "None"}
                    className="w-full text-xs font-semibold font-mono text-gray-800 bg-white border border-[#D2D0CE] rounded p-1 hover:border-[#107C41] focus:outline-none disabled:bg-[#EDEBE9] disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <option value="year">Tahun (Annual)</option>
                    <option value="quarter">Kuartal (Quarter)</option>
                    <option value="month">Siklus Bulanan</option>
                    <option value="week">Mingguan</option>
                    <option value="day">Harian</option>
                    <option value="hour">Siklus Jam</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          {/* Side Info badge */}
          <div className="bg-[#F3F2F1] p-3 rounded border border-[#E0DFDD]">
            <div className="flex gap-1.5 items-start">
              <Info className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-[10.5px] leading-relaxed text-gray-600 font-sans">
                <strong>Tips Sumbu</strong>: Ubah <em>Dimension</em> &amp; <em>Values</em> di atas untuk secara otomatis melakukan kalkulasi relasional pivot multi-metrik.
              </p>
            </div>
          </div>
        </div>

        {/* ================= RIGHT MAIN CANVAS: DASHBOARD AREA ================= */}
        <div className="xl:col-span-9 space-y-4">
          
          {/* Row of KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* KPI 1 */}
            {(() => {
              const totalSum = aggregatedData.reduce((s, r) => s + r.aggValue, 0);
              const totalAvg = totalSum / Math.max(1, aggregatedData.length);
              const metricLabel = activeMeasureCol === "RowCount" ? "Jumlah Baris" : activeMeasureCol.replace(/_/g, " ");
              const showVal = activeAggOp === "avg" || activeAggOp === "median" ? totalAvg : totalSum;
              
              return (
                <div className="bg-white p-3.5 rounded-lg border border-[#E0DFDD] shadow-sm flex flex-col justify-between hover:border-[#107C41]/60 transition-all">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
                    Total Volume ({activeAggOp.toUpperCase()})
                  </span>
                  <div className="text-lg font-bold text-[#252423] my-1 font-sans">
                    {formatExcelValue(showVal, "General")}
                  </div>
                  <span className="text-[10px] text-gray-400 truncate">
                    Hasil hitungan untuk <strong>{metricLabel}</strong>
                  </span>
                </div>
              );
            })()}

            {/* KPI 2 */}
            <div className="bg-white p-3.5 rounded-lg border border-[#E0DFDD] shadow-sm flex flex-col justify-between hover:border-[#107C41]/60 transition-all">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
                Kondisi Saringan Aktif
              </span>
              <div className="text-lg font-bold text-[#107C41] my-1 font-sans">
                {filteredData.length.toLocaleString("id-ID")} BARIS
              </div>
              <span className="text-[10px] text-gray-400 block">
                Sisa <strong>{Math.round((filteredData.length / Math.max(1, allRows.length)) * 100)}%</strong> dari total {allRows.length} data
              </span>
            </div>

            {/* KPI 3 */}
            <div className="bg-white p-3.5 rounded-lg border border-[#E0DFDD] shadow-sm flex flex-col justify-between hover:border-[#107C41]/60 transition-all">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
                Grup Segmentasi Pivot
              </span>
              <div className="text-lg font-bold text-[#107C41] my-1 font-sans">
                {aggregatedData.length} BUCKETS
              </div>
              <span className="text-[10px] text-gray-400 block">
                Struktur data terbagi menjadi {aggregatedData.length} kelompok
              </span>
            </div>
          </div>

          {/* ACTIVE FILTER / CUSTOM QUERY FILTERS CONTAINER */}
          <div className="bg-white p-4 rounded-lg border border-[#E0DFDD] shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-2">
              <span className="text-[11px] font-bold text-[#252423] uppercase tracking-wide flex items-center gap-1.5 font-sans">
                <SlidersHorizontal className="h-4 w-4 text-[#107C41]" />
                <span>Custom Query Filters</span>
              </span>
              
              <div className="flex items-center gap-2">
                {filters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters([])}
                    className="text-[11px] text-[#107C41] hover:text-[#0b592e] font-semibold hover:underline"
                  >
                    Hapus Semua ({filters.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddFilter}
                  className="bg-[#107C41] hover:bg-[#0b592e] text-white text-[11px] font-bold px-3 py-1 rounded shadow-sm flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Filter</span>
                </button>
              </div>
            </div>

            {filters.length === 0 ? (
              <p className="text-gray-400 italic py-2 text-center text-xs">
                Belum ada kriteria filter manual aktif. Data sepenuhnya utuh (100% density).
              </p>
            ) : (
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                {filters.map((filt, idx) => {
                  const targetType = schema[filt.col] || "category";
                  const isNumericCol = targetType === "float" || targetType === "int";
                  
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#F3F2F1] p-2 rounded border border-[#EDEBE9]">
                      {/* Select Column */}
                      <select
                        value={filt.col}
                        onChange={(e) => handleUpdateFilter(idx, "col", e.target.value)}
                        className="text-xs font-mono text-gray-800 border border-[#D2D0CE] bg-white rounded p-1 cursor-pointer w-full sm:w-[150px]"
                      >
                        {columnOptions.map(col => (
                          <option key={col} value={col}>
                            {col.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>

                      {/* Operator selection */}
                      <select
                        value={filt.op}
                        onChange={(e) => handleUpdateFilter(idx, "op", e.target.value)}
                        className="text-xs font-mono text-gray-800 border border-[#D2D0CE] bg-white rounded p-1 cursor-pointer w-full sm:w-[100px]"
                      >
                        {isNumericCol ? (
                          <>
                            <option value="=">=</option>
                            <option value="!=">!=</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                            <option value=">=">&gt;=</option>
                            <option value="<=">&lt;=</option>
                          </>
                        ) : (
                          <>
                            <option value="contains">Mengandung</option>
                            <option value="=">Sama Dengan</option>
                            <option value="starts_with">Diawali dng</option>
                            <option value="ends_with">Diakhiri dng</option>
                            <option value="is_empty">Is Empty (Kosong)</option>
                            <option value="is_not_empty">Is Not Empty</option>
                          </>
                        )}
                      </select>

                      {/* Literal value input */}
                      {filt.op !== "is_empty" && filt.op !== "is_not_empty" ? (
                        <input
                          type="text"
                          value={filt.val}
                          placeholder="Nilai pembanding..."
                          onChange={(e) => handleUpdateFilter(idx, "val", e.target.value)}
                          className="text-xs font-bold font-mono text-gray-800 bg-white border border-[#D2D0CE] rounded p-1.5 hover:border-[#107C41] focus:outline-none flex-1"
                        />
                      ) : (
                        <div className="flex-1 text-[11px] text-gray-400 italic pl-1 leading-none">Tidak membutuhkan nilai data</div>
                      )}

                      {/* Delete icon */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFilter(idx)}
                        className="text-[#A80017] hover:text-red-750 p-1.5 rounded hover:bg-red-50 cursor-pointer text-center"
                        title="Hapus filter ini"
                      >
                        <Trash2 className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visualization Board rendering Container */}
          <div className="bg-white p-4 rounded-lg border border-[#E0DFDD] shadow-sm space-y-3">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EDEBE9] pb-2.5">
              <div className="text-left font-sans">
                <span className="text-[10px] font-bold text-[#252423] uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-gray-400" />
                  <span>Interactive Visualization Board Report Canvas</span>
                </span>
                <p className="text-gray-400 text-[10.5px]">
                  Visualisasi otomatis terpilih berdasarkan konfigurasi Axis dan tipe data. {drillFilter ? "Saringan Klik Aktif - Gulir ke detail" : "Klik pada visual untuk mengaktifkan saringan telusur (Drill-Down)"}
                </p>
              </div>
              
              {drillFilter && (
                <div className="flex items-center gap-1.5 bg-[#107C41]/10 text-[#0b592e] border border-[#107C41]/30 px-2 py-1 rounded text-[10.5px] font-semibold font-sans">
                  <span>Drill Detail: [{drillFilter.col} = {drillFilter.val}]</span>
                  <button 
                    onClick={() => setDrillFilter(null)} 
                    className="hover:text-red-650 cursor-pointer text-xs font-black"
                    title="Kosongkan saringan telusur visual"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Render selected configuration chart view */}
            {aggregatedData.length === 0 ? (
              <div className="py-16 text-center text-gray-400 italic text-xs font-mono">
                Tidak ada hasil yang dapat diagregasi. Silakan ubah pengaturan saringan di atas.
              </div>
            ) : (
              (() => {
                switch (activeChart) {
                  // ==== 1. KPI SINGLE VALUE VIEW ====
                  case "kpi": {
                    const totalAggSum = aggregatedData.reduce((s, r) => s + r.aggValue, 0);
                    const averageAgg = totalAggSum / aggregatedData.length;
                    const valToRender = activeAggOp === "avg" || activeAggOp === "median" ? averageAgg : totalAggSum;
                    
                    return (
                      <div className="py-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#FAF9F8] p-6 rounded border border-[#EDEBE9] text-center space-y-1">
                          <span className="text-[11px] font-bold text-[#107C41] uppercase tracking-wider">Hasil Terkonsolidasi</span>
                          <div className="text-3xl font-extrabold text-[#252423] font-sans">
                            {formatExcelValue(valToRender, "General")}
                          </div>
                          <span className="text-gray-500 text-[11px] font-sans block pt-1">
                            Formula: {activeAggOp.toUpperCase()} de {activeMeasureCol.replace(/_/g, " ")}
                          </span>
                        </div>

                        <div className="bg-[#FAF9F8] p-6 rounded border border-[#EDEBE9] text-center space-y-1">
                          <span className="text-[11px] font-bold text-[#12A151] uppercase tracking-wider">Metrik Sebaran</span>
                          <div className="text-sm font-semibold font-mono text-gray-700 min-h-[44px] flex flex-col justify-center">
                            <div>Nilai Minimum: {formatExcelValue(Math.min(...aggregatedData.map(r => r.aggValue)), "General")}</div>
                            <div>Nilai Maksimum: {formatExcelValue(Math.max(...aggregatedData.map(r => r.aggValue)), "General")}</div>
                          </div>
                          <span className="text-gray-400 text-[11px] block pt-1">Tinjauan dari total {aggregatedData.length} kelompok</span>
                        </div>
                      </div>
                    );
                  }

                  // ==== 2. CLUSTERED COLUMN BAR CHART ====
                  case "bar": {
                    // Maximum 14 items shown for high design fidelity
                    const displayBars = aggregatedData.slice(0, 14);
                    const maxVal = Math.max(...displayBars.map(r => r.aggValue)) || 1;
                    
                    const width = 640;
                    const height = 280;
                    const paddingLeft = 70;
                    const paddingRight = 20;
                    const paddingTop = 30;
                    const paddingBottom = 55;
                    
                    const chartWidth = width - paddingLeft - paddingRight;
                    const chartHeight = height - paddingTop - paddingBottom;
                    
                    const barWidth = displayBars.length > 0 ? (chartWidth / displayBars.length) * 0.72 : 20;
                    const barSpacing = displayBars.length > 0 ? (chartWidth / displayBars.length) * 0.28 : 10;
                    
                    return (
                      <div className="space-y-2 text-left">
                        <div className="relative overflow-x-auto">
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[300px] select-none">
                            {/* Graphic Title */}
                            <text x={width / 2} y={15} textAnchor="middle" className="text-[10px] font-sans font-bold text-gray-700 fill-current uppercase tracking-wider">
                              {`Grafik Batang: Agregat ${activeAggOp.toUpperCase()} de ${activeMeasureCol.replace(/_/g, " ")} per ${activeGroupByCols[0] || "None"}`}
                            </text>

                            {/* Y-Axis Vertical Label */}
                            <text 
                              x={16} 
                              y={paddingTop + chartHeight / 2} 
                              transform={`rotate(-90, 16, ${paddingTop + chartHeight / 2})`} 
                              textAnchor="middle" 
                              className="text-[8.5px] font-sans font-extrabold text-gray-500 fill-current uppercase tracking-wider"
                            >
                              {`Sumbu Y (${activeAggOp.toUpperCase()} de ${activeMeasureCol.replace(/_/g, " ")})`}
                            </text>

                            {/* X-Axis Horizontal Label */}
                            <text 
                              x={paddingLeft + chartWidth / 2} 
                              y={height - 6} 
                              textAnchor="middle" 
                              className="text-[9.5px] font-sans font-extrabold text-gray-500 fill-current uppercase tracking-wider"
                            >
                              {`Sumbu X (Kategori: ${activeGroupByCols[0] || "None"})`}
                            </text>

                            {/* Grid ticks */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                              const val = ratio * maxVal;
                              const y = paddingTop + chartHeight * (1 - ratio);
                              return (
                                <g key={i} className="opacity-90">
                                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#EDEBE9" strokeWidth={1} strokeDasharray="3 3" />
                                  <text x={paddingLeft - 8} y={y + 3.5} className="text-[10px] font-mono font-bold text-gray-400 text-right fill-current" textAnchor="end">
                                    {formatExcelValue(val, "General")}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Render Bars */}
                            {displayBars.map((bar, idx) => {
                              const x = paddingLeft + idx * (barWidth + barSpacing) + barSpacing / 2;
                              const ratio = maxVal > 0 ? bar.aggValue / maxVal : 0;
                              const barHeight = chartHeight * ratio;
                              const y = paddingTop + chartHeight - barHeight;
                              
                              const labelParts = Object.values(bar.keys);
                              if (bar.timeLabel) labelParts.push(bar.timeLabel);
                              const fullLabel = labelParts.join(" | ");
                              
                              const isHovered = hoverIndex === idx;
                              
                              // Check if there is active drill filter
                              const colToMatch = activeGroupByCols[0] || "";
                              const valToMatch = bar.keys[colToMatch] || "";
                              const isSelectedInDrill = drillFilter && String(drillFilter.col) === String(colToMatch) && String(drillFilter.val) === String(valToMatch);

                              return (
                                <g 
                                  key={bar.id}
                                  onMouseEnter={() => setHoverIndex(idx)}
                                  onMouseLeave={() => setHoverIndex(null)}
                                  onClick={() => {
                                    if (colToMatch && valToMatch) {
                                      setDrillFilter({ col: colToMatch, val: valToMatch });
                                      setRawPage(1);
                                    }
                                  }}
                                  className="cursor-pointer"
                                >
                                  {/* Tooltip description */}
                                  <title>{`${fullLabel}: ${formatExcelValue(bar.aggValue)}`}</title>

                                  {/* Background highlight pill hover */}
                                  <rect
                                    x={x - barSpacing/2}
                                    y={paddingTop}
                                    width={barWidth + barSpacing}
                                    height={chartHeight}
                                    fill={isHovered ? "rgba(16, 124, 65, 0.05)" : "transparent"}
                                    rx={2}
                                  />

                                  {/* Bar Rectangle element */}
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={Math.max(2, barHeight)} // Minimum visual 2px bar height
                                    fill={isSelectedInDrill ? "#0b592e" : isHovered ? "#107C41" : colors[idx % colors.length]}
                                    rx={2}
                                    className="transition-all duration-150"
                                  />

                                  {/* Label ticks rotated */}
                                  <text
                                    x={x + barWidth / 2}
                                    y={height - paddingBottom + 14}
                                    className="text-[9.5px] font-mono leading-none text-gray-500 fill-current"
                                    textAnchor="end"
                                    transform={`rotate(-22, ${x + barWidth / 2}, ${height - paddingBottom + 14})`}
                                  >
                                    {fullLabel.length > 12 ? fullLabel.substring(0, 10) + ".." : fullLabel}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Baseline */}
                            <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#D2D0CE" strokeWidth={1} />
                          </svg>
                        </div>

                        {/* Interactive tooltip helper */}
                        <div className="bg-[#FAF9F8] p-2.5 rounded border border-[#EDEBE9] text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          {hoverIndex !== null && displayBars[hoverIndex] ? (
                            <>
                              <span className="text-[#323130]">
                                <strong>Grup Terpilih:</strong> {Object.entries(displayBars[hoverIndex].keys).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ")}
                                {displayBars[hoverIndex].timeLabel && ` (${displayBars[hoverIndex].timeLabel})`}
                              </span>
                              <span className="bg-[#107C41] text-white px-2 py-0.5 rounded font-bold shrink-0">
                                {formatExcelValue(displayBars[hoverIndex].aggValue)}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400 italic">Tips: Arahkan kursor pada batang untuk melihat info detail. Klik batang untuk filter telusur detail.</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // ==== 3. LINE TREND GRAPH VIEW ====
                  case "line": {
                    const maxVal = Math.max(...aggregatedData.map(r => r.aggValue)) || 1;
                    
                    const width = 640;
                    const height = 280;
                    const paddingLeft = 70;
                    const paddingRight = 25;
                    const paddingTop = 30;
                    const paddingBottom = 55;
                    
                    const chartWidth = width - paddingLeft - paddingRight;
                    const chartHeight = height - paddingTop - paddingBottom;

                    const stepX = aggregatedData.length > 1 ? chartWidth / (aggregatedData.length - 1) : chartWidth;

                    const points = aggregatedData.map((row, idx) => {
                      const x = paddingLeft + idx * stepX;
                      const ratio = maxVal > 0 ? row.aggValue / maxVal : 0;
                      const y = paddingTop + chartHeight - chartHeight * ratio;
                      return { x, y, row, idx };
                    });

                    const lineD = points.length > 0 
                      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
                      : "";

                    const areaD = points.length > 0
                      ? `${lineD} L ${points[points.length-1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
                      : "";

                    return (
                      <div className="space-y-2 text-left">
                        <div className="relative overflow-x-auto">
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[300px] select-none">
                            <defs>
                              <linearGradient id="workspaceLineGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#107C41" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#107C41" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Graphic Title */}
                            <text x={width / 2} y={15} textAnchor="middle" className="text-[10px] font-sans font-bold text-gray-700 fill-current uppercase tracking-wider">
                              {`Grafik Garis Tren: Agregat ${activeAggOp.toUpperCase()} de ${activeMeasureCol.replace(/_/g, " ")} per ${activeTimeCol !== "None" ? activeTimeCol : (activeGroupByCols[0] || "None")}`}
                            </text>

                            {/* Y-Axis Vertical Label */}
                            <text 
                              x={16} 
                              y={paddingTop + chartHeight / 2} 
                              transform={`rotate(-90, 16, ${paddingTop + chartHeight / 2})`} 
                              textAnchor="middle" 
                              className="text-[8.5px] font-sans font-extrabold text-gray-500 fill-current uppercase tracking-wider"
                            >
                              {`Sumbu Y (${activeAggOp.toUpperCase()} de ${activeMeasureCol.replace(/_/g, " ")})`}
                            </text>

                            {/* X-Axis Horizontal Label */}
                            <text 
                              x={paddingLeft + chartWidth / 2} 
                              y={height - 6} 
                              textAnchor="middle" 
                              className="text-[9.5px] font-sans font-extrabold text-gray-500 fill-current uppercase tracking-wider"
                            >
                              {`Sumbu X (${activeTimeCol !== "None" ? `Waktu: ${activeTimeCol}` : `Kategori: ${activeGroupByCols[0] || "None"}`})`}
                            </text>

                            {/* Area grid rules */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                              const val = ratio * maxVal;
                              const y = paddingTop + chartHeight * (1 - ratio);
                              return (
                                <g key={i} className="opacity-90">
                                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#EDEBE9" strokeWidth={1} strokeDasharray="3 3" />
                                  <text x={paddingLeft - 8} y={y + 3.5} className="text-[10px] font-mono font-bold text-gray-400 text-right fill-current" textAnchor="end">
                                    {formatExcelValue(val, "General")}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Sumbu trend area under shading */}
                            {points.length > 0 && (
                              <path d={areaD} fill="url(#workspaceLineGrad)" stroke="none" />
                            )}

                            {/* Solid path curve */}
                            {points.length > 0 && (
                              <path d={lineD} fill="none" stroke="#107C41" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                            )}

                            {/* Interactive Coordinate Node Circles */}
                            {points.map((pt, i) => {
                              const isHovered = hoverIndex === i;
                              const labelParts = Object.values(pt.row.keys);
                              if (pt.row.timeLabel) labelParts.push(pt.row.timeLabel);
                              const fullLabel = labelParts.join(" | ");

                              const colToMatch = activeGroupByCols[0] || activeTimeCol || "";
                              const valToMatch = pt.row.keys[colToMatch] || pt.row.timeLabel || "";

                              return (
                                <g 
                                  key={pt.row.id}
                                  onMouseEnter={() => setHoverIndex(i)}
                                  onMouseLeave={() => setHoverIndex(null)}
                                  onClick={() => {
                                    if (colToMatch && valToMatch) {
                                      setDrillFilter({ col: colToMatch, val: valToMatch });
                                      setRawPage(1);
                                    }
                                  }}
                                  className="cursor-pointer"
                                >
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={isHovered ? 7.5 : 4}
                                    fill="#107C41"
                                    stroke="#FFFFFF"
                                    strokeWidth={1.5}
                                    className="transition-all duration-150"
                                  />

                                  {/* Date timeline bottom axis or Category label if timeline absent */}
                                  {(pt.row.timeLabel || Object.values(pt.row.keys).length > 0) && (
                                    <text
                                      x={pt.x}
                                      y={height - paddingBottom + 14}
                                      className="text-[9.5px] font-mono text-gray-500 fill-current"
                                      textAnchor="end"
                                      transform={`rotate(-22, ${pt.x}, ${height - paddingBottom + 14})`}
                                    >
                                      {(() => {
                                        const labelText = pt.row.timeLabel || Object.values(pt.row.keys).join(" | ");
                                        return labelText.length > 12 ? labelText.substring(0, 10) + ".." : labelText;
                                      })()}
                                    </text>
                                  )}
                                </g>
                              );
                            })}

                            {/* Baseline rule */}
                            <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#D2D0CE" strokeWidth={1} />
                          </svg>
                        </div>

                        {/* Interactive tooltip helper */}
                        <div className="bg-[#FAF9F8] p-2.5 rounded border border-[#EDEBE9] text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          {hoverIndex !== null && points[hoverIndex] ? (
                            <>
                              <span className="text-[#323130]">
                                <strong>Suku Periode:</strong> {points[hoverIndex].row.timeLabel || "N/A"}{" | "}
                                {Object.entries(points[hoverIndex].row.keys).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ")}
                              </span>
                              <span className="bg-[#107C41] text-white px-2 py-0.5 rounded font-bold shrink-0">
                                {formatExcelValue(points[hoverIndex].row.aggValue)}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400 italic">Tips: Klik titik koordinat tren untuk memfilter rekaman detail di bawah secara langsung.</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // ==== 4. DONUT PIE PART-TO-WHOLE PLOT ====
                  case "pie": {
                    const items = [...aggregatedData];
                    const totalVal = items.reduce((s, r) => s + r.aggValue, 0) || 1;
                    
                    const slices: { label: string; value: number; share: number; color: string; originalKeys: any }[] = [];
                    const limit = 5;
                    
                    const topItems = items.slice(0, limit);
                    topItems.forEach((it, i) => {
                      const labelParts = Object.values(it.keys);
                      if (it.timeLabel) labelParts.push(it.timeLabel);
                      const labelStr = labelParts.join(" | ");
                      slices.push({
                        label: labelStr,
                        value: it.aggValue,
                        share: (it.aggValue / totalVal) * 100,
                        color: colors[i % colors.length],
                        originalKeys: it.keys
                      });
                    });

                    if (items.length > limit) {
                      const remainingVal = items.slice(limit).reduce((s, r) => s + r.aggValue, 0);
                      slices.push({
                        label: "Lain-lain",
                        value: remainingVal,
                        share: (remainingVal / totalVal) * 100,
                        color: "#A6A6A6",
                        originalKeys: null
                      });
                    }

                    let runningPct = 0;
                    const radius = 38;
                    const cx = 75;
                    const cy = 75;
                    const cVolume = 2 * Math.PI * radius; // 238.76

                    return (
                      <div className="space-y-4">
                        <div className="text-center font-sans text-xs font-bold text-gray-700 uppercase tracking-wider bg-gray-50/50 py-1.5 border-b border-[#EDEBE9] rounded">
                          {`Grafik Donat: Proporsi ${activeAggOp.toUpperCase()} de ${activeMeasureCol.replace(/_/g, " ")} per ${activeGroupByCols[0] || "None"}`}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center py-2">
                          {/* Radial graphic */}
                          <div className="flex justify-center">
                            <svg viewBox="0 0 150 150" className="w-full max-w-[170px] h-auto select-none">
                              {slices.map((slice, i) => {
                                const dashSize = (slice.share / 100) * cVolume;
                                const offset = -((runningPct / 100) * cVolume);
                                runningPct += slice.share;
                                
                                const isHovered = hoverIndex === i;
                                const colToMatch = activeGroupByCols[0] || "";
                                const valToMatch = slice.originalKeys ? slice.originalKeys[colToMatch] : "";

                                return (
                                  <circle
                                    key={i}
                                    cx={cx}
                                    cy={cy}
                                    r={radius}
                                    fill="none"
                                    stroke={slice.color}
                                    strokeWidth={isHovered ? 15 : 12}
                                    strokeDasharray={`${dashSize} ${cVolume}`}
                                    strokeDashoffset={offset}
                                    transform="rotate(-90 75 75)"
                                    className="transition-all duration-150 cursor-pointer stroke-current"
                                    style={{ stroke: slice.color, transformOrigin: "center" }}
                                    onMouseEnter={() => setHoverIndex(i)}
                                    onMouseLeave={() => setHoverIndex(null)}
                                    onClick={() => {
                                      if (colToMatch && valToMatch) {
                                        setDrillFilter({ col: colToMatch, val: valToMatch });
                                        setRawPage(1);
                                      }
                                    }}
                                  />
                                );
                              })}
                              
                              {/* Inner mask layout donut */}
                              <circle cx={cx} cy={cy} r={radius - 7} fill="#FFFFFF" />
                              
                              <text x={cx} y={cy - 2} className="text-[11px] font-bold text-gray-800 text-center fill-current" textAnchor="middle">
                                {aggregatedData.length}
                              </text>
                              <text x={cx} y={cy + 8} className="text-[8px] font-mono font-bold text-gray-400 text-center fill-current" textAnchor="middle">
                                Buckets
                              </text>
                            </svg>
                          </div>

                          {/* Legend specifications layout */}
                          <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                            {slices.map((slice, i) => {
                              const isHovered = hoverIndex === i;
                              return (
                                <div 
                                  key={i} 
                                  className={`flex items-start gap-2 p-1.5 rounded transition-all cursor-pointer ${
                                    isHovered ? "bg-[#FAF9F8]" : ""
                                  }`}
                                  onMouseEnter={() => setHoverIndex(i)}
                                  onMouseLeave={() => setHoverIndex(null)}
                                  onClick={() => {
                                    const colToMatch = activeGroupByCols[0] || "";
                                    const valToMatch = slice.originalKeys ? slice.originalKeys[colToMatch] : "";
                                    if (colToMatch && valToMatch) {
                                      setDrillFilter({ col: colToMatch, val: valToMatch });
                                      setRawPage(1);
                                    }
                                  }}
                                >
                                  <span className="h-3 w-3 rounded-sm shrink-0 mt-0.5" style={{ backgroundColor: slice.color }} />
                                  <div className="text-left font-mono flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-gray-800 truncate" title={slice.label}>
                                      {slice.label}
                                    </div>
                                    <div className="text-[9.5px] text-gray-400 mt-0.5 whitespace-nowrap">
                                      {formatExcelValue(slice.value)} ({slice.share.toFixed(1)}%)
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Interactive Info bottom banner */}
                        <div className="bg-[#FAF9F8] p-2 rounded border border-[#EDEBE9] text-gray-400 text-[10.5px] italic text-center">
                          Tips: Klik potongan donat / legend di atas untuk melakukan pemfilteran telusur rincian tabular secara dinamis.
                        </div>
                      </div>
                    );
                  }

                  // ==== 5. MATRIX RELATION HEATMAP VIEW ====
                  case "heatmap": {
                    if (activeGroupByCols.length < 2) {
                      return (
                        <div className="p-8 text-center text-gray-400 italic font-mono">
                          Pilihlah minimal 2 Kolom Dimensi pada Group By Wells di panel kontrol kiri untuk memicu visualisasi Matrix Heatmap.
                        </div>
                      );
                    }

                    const rowCol = activeGroupByCols[0];
                    const colCol = activeGroupByCols[1];

                    // Dynamically calculate aggregate sums per row & col to prioritize highest data rows/cols
                    const rowSums: Record<string, number> = {};
                    const colSums: Record<string, number> = {};
                    aggregatedData.forEach(r => {
                      const rv = r.keys[rowCol] || "N/A";
                      const cv = r.keys[colCol] || "N/A";
                      rowSums[rv] = (rowSums[rv] || 0) + r.aggValue;
                      colSums[cv] = (colSums[cv] || 0) + r.aggValue;
                    });

                    const rowVals = Array.from(new Set(aggregatedData.map(r => r.keys[rowCol] || "N/A")))
                      .sort((a, b) => (rowSums[b as string] || 0) - (rowSums[a as string] || 0))
                      .slice(0, 10) as string[];

                    const colVals = Array.from(new Set(aggregatedData.map(r => r.keys[colCol] || "N/A")))
                      .sort((a, b) => (colSums[b as string] || 0) - (colSums[a as string] || 0))
                      .slice(0, 8) as string[];

                    const maxVal = Math.max(...aggregatedData.map(r => r.aggValue)) || 1;

                    return (
                      <div className="space-y-4">
                        <div className="text-xs font-mono text-gray-650 bg-gray-50 p-2.5 border border-[#EDEBE9] rounded flex flex-wrap justify-between gap-2">
                          <div><strong>Sumbu Baris (Y-Axis):</strong> <span className="bg-[#107C41]/10 text-[#0b592e] px-1.5 py-0.5 rounded font-semibold capitalize">{rowCol.replace(/_/g, " ")}</span></div>
                          <div><strong>Sumbu Kolom (X-Axis):</strong> <span className="bg-[#107C41]/10 text-[#0b592e] px-1.5 py-0.5 rounded font-semibold capitalize">{colCol.replace(/_/g, " ")}</span></div>
                          <div><strong>Nilai Sel (Target):</strong> <span className="bg-[#107C41]/10 text-[#0b592e] px-1.5 py-0.5 rounded font-semibold">{activeAggOp.toUpperCase()} de {activeMeasureCol.replace(/_/g, " ")}</span></div>
                        </div>

                        <div className="overflow-x-auto rounded border border-[#EDEBE9]">
                          <table className="w-full text-center border-collapse text-xs font-mono leading-tight">
                            <thead>
                              <tr className="bg-[#F3F2F1]">
                                <th className="p-3 border-b border-r border-[#EDEBE9] text-[#252423] font-bold text-left capitalize">
                                  {rowCol.replace(/_/g, " ")} / {colCol.replace(/_/g, " ")}
                                </th>
                                {colVals.map(col => (
                                  <th key={col} className="p-3 border-b border-[#EDEBE9] text-gray-600 truncate max-w-[100px] font-bold" title={col}>
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rowVals.map(rowVal => (
                                <tr key={rowVal} className="hover:bg-gray-50/50">
                                  <td className="p-2.5 border-r border-b border-[#EDEBE9] font-bold text-gray-800 text-left capitalize bg-[#F3F2F1]/30">
                                    {rowVal}
                                  </td>
                                  {colVals.map(colVal => {
                                    const cellObj = aggregatedData.find(g => g.keys[rowCol] === rowVal && g.keys[colCol] === colVal);
                                    const cVal = cellObj ? cellObj.aggValue : 0;
                                    const ratio = maxVal > 0 ? cVal / maxVal : 0;
                                    
                                    // Workplace green scale
                                    let bgStyle = { backgroundColor: "transparent", color: "#111827" };
                                    if (cellObj) {
                                      bgStyle = {
                                        backgroundColor: `rgba(16, 124, 65, ${Math.max(0.04, ratio)})`,
                                        color: ratio > 0.58 ? "#FFFFFF" : "#252423"
                                      };
                                    }

                                    return (
                                      <td 
                                        key={colVal} 
                                        style={bgStyle}
                                        title={`${rowVal} & ${colVal}: ${formatExcelValue(cVal)}`}
                                        onClick={() => {
                                          if (cellObj) {
                                            setDrillFilter({ col: rowCol, val: rowVal });
                                            setRawPage(1);
                                          }
                                        }}
                                        className="p-3 border-b border-[#EDEBE9] font-bold transition-all cursor-pointer hover:underline"
                                      >
                                        {cellObj ? formatExcelValue(cVal, "General") : "-"}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="bg-[#FAF9F8] p-2 rounded border border-[#EDEBE9] text-gray-400 text-[10.5px] italic text-center">
                          Tips: Klik sel matrix di atas untuk memfokuskan daftar record tabel telusur rincian pada katagori baris bersangkutan.
                        </div>
                      </div>
                    );
                  }

                  // ==== 6. PIVOT MATRIX TABLE VIEW ====
                  case "table":
                  default: {
                    return (
                      <div className="space-y-4">
                        <div className="text-xs font-mono text-gray-650 bg-gray-50 p-2.5 border border-[#EDEBE9] rounded flex flex-wrap justify-between gap-2">
                          <div><strong>Nama Tabel Laporan:</strong> <span className="bg-[#107C41]/10 text-[#0b592e] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">Tabel Agregat Terkonsolidasi</span></div>
                          <div><strong>Dimensi Pengelompokkan:</strong> <span className="bg-[#107C41]/10 text-[#0b592e] px-1.5 py-0.5 rounded font-semibold capitalize">{activeGroupByCols.join(", ").replace(/_/g, " ") || "Tidak ada"}</span></div>
                          <div><strong>Metode Pengukuran (Target):</strong> <span className="bg-[#107C41]/10 text-[#0b592e] px-1.5 py-0.5 rounded font-semibold">{activeAggOp.toUpperCase()} de {activeMeasureCol.replace(/_/g, " ")}</span></div>
                        </div>

                        <div className="rounded border border-[#EDEBE9] overflow-hidden">
                          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                            <table className="w-full text-left font-mono text-[11px] leading-normal border-collapse">
                              <thead className="bg-[#F3F2F1] text-[#252423] font-bold border-b border-[#EDEBE9] sticky top-0 uppercase">
                                <tr>
                                  <th className="p-3 pl-4">No</th>
                                  {activeGroupByCols.map(col => (
                                    <th key={col} className="p-3">{col.replace(/_/g, " ")}</th>
                                  ))}
                                  {activeTimeCol !== "None" && (
                                    <th className="p-3">Periode ({activeTimeCol})</th>
                                  )}
                                  <th className="p-3 text-right">{activeAggOp.toUpperCase()} Agregat</th>
                                  <th className="p-3 text-right pr-4">Hit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#EDEBE9]">
                                {aggregatedData.map((row, idx) => {
                                  const colToMatch = activeGroupByCols[0] || "";
                                  const valToMatch = row.keys[colToMatch] || "";
                                  return (
                                    <tr 
                                      key={row.id} 
                                      className="hover:bg-[#FAF9F8] transition-colors cursor-pointer"
                                      onClick={() => {
                                        if (colToMatch && valToMatch) {
                                          setDrillFilter({ col: colToMatch, val: valToMatch });
                                          setRawPage(1);
                                        }
                                      }}
                                    >
                                      <td className="p-2.5 pl-4 text-gray-400 font-bold">{idx + 1}</td>
                                      {activeGroupByCols.map(col => (
                                        <td key={col} className="p-2.5 font-bold text-gray-800 capitalize">{row.keys[col] || "-"}</td>
                                      ))}
                                      {activeTimeCol !== "None" && (
                                        <td className="p-2.5 text-gray-600 font-semibold">{row.timeLabel || "N/A"}</td>
                                      )}
                                      <td className="p-2.5 text-right font-bold text-[#107C41]">
                                        {formatExcelValue(row.aggValue)}
                                      </td>
                                      <td className="p-2.5 text-right pr-4 text-gray-400 font-bold">{row.count}x</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  }
                }
              })()
            )}

          </div>

        </div>
      </div>

      {/* ================= DATA VIEW & TELUSUR DETIL GRID (DRILL DOWN TABLE) ================= */}
      <div className="bg-white p-4 rounded-lg border border-[#E0DFDD] shadow-sm space-y-3 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EDEBE9] pb-3">
          <div>
            <span className="text-[11px] font-bold text-[#252423] uppercase tracking-wide flex items-center gap-1.5 font-sans">
              <FileSpreadsheet className="h-4 w-4 text-gray-400" />
              <span>4. Sub-Dataset Telusur Rincian (Drill-Through Raw Records Row)</span>
            </span>
            <p className="text-gray-400 text-[10.5px]">
              Menampilkan {detailData.length.toLocaleString("id-ID")} rekaman individual terfilter. {drillFilter ? "Saringan visual aktif." : "Sesuaikan saringan di atas untuk mengisolasi list data di bawah."}
            </p>
          </div>

          {/* Search bar raw reports */}
          <div className="flex items-center gap-2 max-w-full sm:max-w-xs w-full">
            <div className="relative flex-1">
              <input
                type="text"
                value={rawSearchQuery}
                onChange={(e) => {
                  setRawSearchQuery(e.target.value);
                  setRawPage(1);
                }}
                placeholder="Telusuri kata kunci rekaman..."
                className="w-full text-xs bg-white text-gray-800 pl-8 pr-2 py-1.5 border border-[#D2D0CE] rounded hover:border-[#107C41] focus:outline-none placeholder-gray-400"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            </div>
            
            {rawSearchQuery && (
              <button
                onClick={() => {
                  setRawSearchQuery("");
                  setRawPage(1);
                }}
                className="text-xs text-gray-400 hover:text-gray-700 font-bold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Drill down table render */}
        {detailData.length === 0 ? (
          <div className="py-12 text-center text-gray-400 italic text-xs font-mono">
            Tidak ada kecocokan data transaksi rincian. Ubah kata kunci pencarian atau saringan di atas.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded border border-[#EDEBE9]">
              <table className="w-full text-left font-mono text-xs leading-normal border-collapse">
                <thead className="bg-[#FAF9F8] text-gray-700 font-bold border-b border-[#EDEBE9]">
                  <tr>
                    <th className="p-3 pl-4">No.</th>
                    {columnOptions.map(col => (
                      <th key={col} className="p-3 capitalize">{col.replace(/_/g, " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEBE9]">
                  {pageItems.map((row, idx) => {
                    const rowNum = (rawPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <tr key={idx} className="hover:bg-[#FAF9F8] transition-colors">
                        <td className="p-2.5 pl-4 text-gray-400 font-bold">{rowNum}</td>
                        {columnOptions.map(col => {
                          const originalVal = row[col];
                          const excelVal = formatExcelValue(originalVal, "General");
                          return (
                            <td key={col} className="p-2.5 max-w-[150px] truncate" title={excelVal}>
                              {excelVal}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-[#EDEBE9] pt-3">
              <span className="text-gray-500 text-[11px]">
                Menampilkan <strong>{(rawPage - 1) * itemsPerPage + 1}</strong> s.d. <strong>{Math.min(rawPage * itemsPerPage, detailData.length)}</strong> dari <strong>{detailData.length.toLocaleString("id-ID")}</strong> rekaman
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={rawPage === 1}
                  onClick={() => setRawPage(prev => Math.max(1, prev - 1))}
                  className="p-1.5 bg-white border border-[#D2D0CE] text-gray-700 hover:bg-[#F3F2F1] rounded disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <span className="text-xs font-mono px-2 text-[#252423]">
                  Halaman <strong>{rawPage}</strong> dari <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  disabled={rawPage === totalPages}
                  onClick={() => setRawPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1.5 bg-white border border-[#D2D0CE] text-gray-700 hover:bg-[#F3F2F1] rounded disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. NATIVE BRIEF AUTOMATED SUMMARY (INSIGHTS INSIGHTS REPORT) */}
      <div className="bg-[#107C41]/5 border-l-4 border-[#107C41] p-4 rounded-r-lg space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-gray-400" />
          <h5 className="text-[11px] font-bold text-[#0b592e] uppercase tracking-wider font-mono">
            Automated Executive Brief Insights Report
          </h5>
        </div>

        <div className="space-y-1.5 text-left text-xs font-sans text-gray-700 leading-relaxed max-h-[350px] overflow-y-auto pr-1">
          {dynamicInsights.map((ins, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[#107C41] shrink-0 font-bold select-none">•</span>
              <p dangerouslySetInnerHTML={{ __html: ins }} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// Inline helper for visualization matching logic
function visualMatch(btnId: string, active: string, override: string): boolean {
  if (btnId === "auto") {
    return override === "auto";
  }
  return active === btnId && override === btnId;
}
