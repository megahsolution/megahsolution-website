import React, { useState } from "react";
import * as XLSX from "xlsx";
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Star } from "lucide-react";

// Nullify ikon-ikon pendukung agar tidak konflik/error karena tidak di-import
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

// IMPORT KOMPONEN ANDA
import LandingPage from './components/LandingPage';
import DatasetExplorer from './components/DatasetExplorer';
import SourceCodeExplorer from './components/SourceCodeExplorer';

// ==========================================================
// COMPONENT: DATA SCIENCE SANDBOX (Pindahan dari App lama)
// ==========================================================
function DataScienceSandbox() {
  const [activeTab, setActiveTab] = useState<"sandbox" | "datasets" | "source">("sandbox");
  const [dataset, setDataset] = useState<DataRecord[]>([]);
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "📦 System initialized. Awaiting enterprise data payload...",
  ]);

  // Logika-logika simulasi Excel / Data Science Workspace Anda tetap berada di sini
  const addLog = (msg: string) => {
    setSystemLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleGenerateData = () => {
    const data = generateSyntheticCustomerData(500);
    setDataset(data);
    addLog(`✨ Synthetic core generation complete. Injected ${data.length} records.`);
  };

  const handleDownloadCSV = () => {
    if (dataset.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(dataset);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MGS_Clean_Data");
    XLSX.writeFile(workbook, "mgs_analytics_export.xlsx");
    addLog("💾 Structured pipeline spreadsheet compiled and downloaded.");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-gray-800 antialiased font-sans">
      {/* Top Professional Executive Header */}
      <header className="bg-gradient-to-r from-[#107C41] to-[#1B9A55] text-white px-6 py-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg backdrop-blur-3xs">
            <Star className="h-5 w-5 text-amber-300 fill-amber-300" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">MGS Data Analytics</h1>
            <p className="text-xs text-emerald-100 font-mono">Advanced Data Science Workspace v1.2</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-[#0d6435] p-1 rounded-lg border border-emerald-700/30">
          <button
            onClick={() => setActiveTab("sandbox")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === "sandbox" ? "bg-white text-[#107C41] shadow-xs" : "text-emerald-100 hover:bg-emerald-800/50"
            }`}
          >
            Data Workspace
          </button>
          <button
            onClick={() => setActiveTab("datasets")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === "datasets" ? "bg-white text-[#107C41] shadow-xs" : "text-emerald-100 hover:bg-emerald-800/50"
            }`}
          >
            Dataset Explorer
          </button>
          <button
            onClick={() => setActiveTab("source")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === "source" ? "bg-white text-[#107C41] shadow-xs" : "text-emerald-100 hover:bg-emerald-800/50"
            }`}
          >
            Source Files
          </button>
        </div>
      </header>

      {/* Workspace Area */}
      <div className="flex-1 flex flex-col">
        {activeTab === "datasets" ? (
          <DatasetExplorer />
        ) : activeTab === "source" ? (
          <SourceCodeExplorer />
        ) : (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-5 p-5 max-w-[1700px] mx-auto w-full">
            {/* KONTEN WORKSPACE UTAMA ANDA */}
            <main className="xl:col-span-8 flex flex-col gap-5">
              <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-6 flex flex-col justify-center items-center text-center h-64">
                <p className="text-sm text-gray-500 mb-4">
                  Welcome to the data science sandbox. Click below to initialize synthetic analytics engine.
                </p>
                <button 
                  onClick={handleGenerateData}
                  className="bg-[#107C41] hover:bg-[#0b592e] text-white font-bold text-xs px-5 py-2.5 rounded-md shadow-xs transition-colors cursor-pointer"
                >
                  Generate Core Enterprise Data
                </button>
              </div>

              {dataset.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-6 text-center space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Pipeline Distribution State</h3>
                    <p className="text-2xs text-gray-400 mt-1">
                      Dataset ready for downstream advanced analytics and dashboard models. Download the treated dataset file or inspect python scripts.
                    </p>
                  </div>

                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      id=\"btn-download-csv\"
                      onClick={handleDownloadCSV}
                      className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-3xs px-3 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1.5 shadow-3xs cursor-pointer"
                    >
                      <span>Download Cleaned CSV Dataset</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("source")}
                      className="bg-[#107C41] hover:bg-[#0b592e] text-white text-3xs px-3 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1.5 shadow-3xs cursor-pointer"
                    >
                      <span>Inspect Python Workspace Code</span>
                    </button>
                  </div>
                </div>
              )}
            </main>

            {/* LOG PANEL */}
            <aside className="xl:col-span-4 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs font-mono text-[11px] h-64 overflow-y-auto">
              <div className="text-gray-400 font-bold border-b pb-2 mb-2 uppercase tracking-wider">System Log Terminal</div>
              {systemLogs.map((log, i) => (
                <div key={i} className="text-gray-600 mb-1 leading-relaxed">{log}</div>
              ))}
            </aside>
          </div>
        )}
      </div>

      <footer className="bg-white border-t border-[#E2E8F0] py-6 text-center text-xs text-gray-500 mt-auto font-mono">
        Designed with Excel Green Theme &bull; Data Science Workspace System v1.2
      </footer>
    </div>
  );
}

// ==========================================
// MAIN APP ROUTING CONFIGURATION
// ==========================================
const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/app',
    element: <DataScienceSandbox />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}