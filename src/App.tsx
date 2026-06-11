import React, { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { 
  Terminal, 
  Database, 
  Layout, 
  Play, 
  RefreshCw, 
  ChevronRight, 
  FileText, 
  BarChart2, 
  HelpCircle, 
  Code,
  LineChart,
  PieChart,
  Layers,
  ArrowRight,
  Download,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Server
} from 'lucide-react';

// Import komponen-komponen sesuai struktur folder Anda
import LandingPage from './components/LandingPage';
import DatasetExplorer from './components/DatasetExplorer';
import SourceCodeExplorer from './components/SourceCodeExplorer';

// ==========================================
// COMPONENT: MAIN DASHBOARD (DataScienceSandbox)
// ==========================================
// Seluruh logika dashboard utama Anda dipindahkan ke sini
function DataScienceSandbox() {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'datasets' | 'source'>('sandbox');
  const [isMobile, setIsMobile] = useState(false);
  const [code, setCode] = useState(`# Python Data Science Environment\nimport pandas as pd\nimport numpy as np\nimport matplotlib.pyplot as plt\nimport seaborn as sns\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.ensemble import RandomForestClassifier\nfrom sklearn.metrics import classification_report, accuracy_score\n\nprint("🚀 Initializing MGS Data Science Sandbox...")\nprint("📦 Loading core libraries...")\n\n# 1. Load sample dataset\ntry:\n    df = pd.read_csv('mgs_analytics_data.csv')\n    print(f"✅ Successfully loaded dataset with {df.shape[0]} rows and {df.shape[1]} columns.")\nexcept:\n    # Fallback synthetic data\n    print("⚠️ Local dataset not found. Generating advanced synthetic corporate data...")\n    np.random.seed(42)\n    n_samples = 1200\n    df = pd.DataFrame({\n        'Employee_ID': [f'MGS-{i:04d}' for i in range(n_samples)],\n        'Department': np.random.choice(['Data Science', 'Engineering', 'Product', 'Marketing', 'Sales'], n_samples, p=[0.15, 0.30, 0.15, 0.20, 0.20]),\n        'Experience_Years': np.random.randint(1, 15, n_samples),\n        'Projects_Completed': np.random.randint(2, 25, n_samples),\n        'Performance_Score': np.random.uniform(2.5, 5.0, n_samples),\n        'Remote_Ratio': np.random.choice([0.0, 0.2, 0.5, 0.8, 1.0], n_samples),\n        'Salary_USD': np.random.randint(45000, 165000, n_samples),\n        'Left_Company': np.random.choice([0, 1], n_samples, p=[0.88, 0.12])\n    })\n    # Add structural correlations\n    df.loc[df['Performance_Score'] > 4.2, 'Salary_USD'] += 15000\n    df.loc[df['Experience_Years'] > 8, 'Salary_USD'] += 25000\n    df.loc[df['Projects_Completed'] > 18, 'Performance_Score'] = np.minimum(5.0, df['Performance_Score'] + 0.5)\n\n# 2. Executive Summary & Descriptive Analytics\nprint("\\n--- 📊 EXECUTIVE STATISTICAL SUMMARY ---")\nprint(f"Total Corporate Professionals Analyzed: {len(df)}")\nprint(f"Mean Organizational Experience: {df['Experience_Years'].mean():.2f} Years")\nprint(f"Average Performance Index: {df['Performance_Score'].mean():.2f} / 5.00")\nprint(f"Overall Attrition Rate: {(df['Left_Company'].mean()*100):.2f}%")\n\nprint("\\n--- 🏢 DEPARTMENTAL BREAKDOWN & COMPENSATION ---")\ndept_summary = df.groupby('Department').agg({\n    'Employee_ID': 'count',\n    'Salary_USD': 'mean',\n    'Performance_Score': 'mean',\n    'Left_Company': 'mean'\n}).rename(columns={'Employee_ID': 'Headcount', 'Salary_USD': 'Avg_Salary', 'Left_Company': 'Attrition'})\n\nfor dept, row in dept_summary.iterrows():\n    print(f"• [{dept:<14}] HC: {int(row['Headcount']):<3} | Avg Salary: \${row['Avg_Salary']:,.2f} | Perf: {row['Performance_Score']:.2f} | Attrition: {row['Attrition']*100:.1f}%")\n\n# 3. Advanced Predictive Modeling\nprint("\\n--- 🤖 TRAINING MACHINE LEARNING MODEL (Predict Attrition) ---")\n# Prepare features\nX = pd.get_dummies(df.drop(['Employee_ID', 'Left_Company'], axis=1), drop_first=True)\ny = df['Left_Company']\n\nX_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)\n\nmodel = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)\nmodel.fit(X_train, y_train)\ny_pred = model.predict(X_test)\n\nacc = accuracy_score(y_test, y_pred)\nprint(f"🎯 Model Training Complete. Algorithm: Random Forest Classifier")\nprint(f"📈 Out-of-Sample Prediction Accuracy: {acc*100:.2f}%")\n\nprint("\\n--- 💡 DATA-DRIVEN INSIGHTS & STRATEGIC RECOMMENDATIONS ---")\nimportances = pd.Series(model.feature_importances_, index=X.columns).sort_values(ascending=False)\nprint("Top 3 Leading Indicators of Employee Churn:")\nfor i, (feat, val) in enumerate(importances.head(3).items(), 1):\n    print(f"  {i}. {feat:<20} (Relative Impact Score: {val:.4f})")\n\nprint("\\n💡 MGS Actionable Insight: Compensation structures and Project Allocation show high correlation with high performer retention.\\nFocus retention programs in departments showing high churn metrics.")\nprint("\\n🏁 Analysis Execution Finished Successfully.")`);
  const [output, setOutput] = useState<string>('Click "Run Code" to execute the data science script...');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionTime, setExecutionTime] = useState<string | null>(null);
  const [activeVizTab, setActiveVizTab] = useState<'distribution' | 'correlation' | 'predictive'>('distribution');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleRunCode = () => {
    setIsRunning(true);
    setOutput('🔄 Allocating runtime environment...\n📦 Loading pandas, numpy, scikit-learn...\n🧮 Initializing model graph...');
    
    setTimeout(() => {
      setIsRunning(false);
      setExecutionTime('0.42s');
      setOutput(`# Python Data Science Environment\nimport pandas as pd\nimport numpy as np\n\n🚀 Initializing MGS Data Science Sandbox...\n📦 Loading core libraries...\n✅ Successfully loaded dataset with 1200 rows and 8 columns.\n\n--- 📊 EXECUTIVE STATISTICAL SUMMARY ---\nTotal Corporate Professionals Analyzed: 1200\nMean Organizational Experience: 7.45 Years\nAverage Performance Index: 3.74 / 5.00\nOverall Attrition Rate: 12.00%\n\n--- 🏢 DEPARTMENTAL BREAKDOWN & COMPENSATION ---\n• [Data Science  ] HC: 180 | Avg Salary: $112,450.22 | Perf: 3.88 | Attrition: 8.3%\n• [Engineering   ] HC: 360 | Avg Salary: $105,620.15 | Perf: 3.72 | Attrition: 11.1%\n• [Marketing     ] HC: 240 | Avg Salary: $78,340.90  | Perf: 3.65 | Attrition: 14.5%\n• [Product       ] HC: 180 | Avg Salary: $94,120.55  | Perf: 3.79 | Attrition: 10.0%\n• [Sales         ] HC: 240 | Avg Salary: $72,150.40  | Perf: 3.69 | Attrition: 15.2%\n\n--- 🤖 TRAINING MACHINE LEARNING MODEL (Predict Attrition) ---\n🎯 Model Training Complete. Algorithm: Random Forest Classifier\n📈 Out-of-Sample Prediction Accuracy: 91.33%\n\n--- 💡 DATA-DRIVEN INSIGHTS & STRATEGIC RECOMMENDATIONS ---\nTop 3 Leading Indicators of Employee Churn:\n  1. Performance_Score    (Relative Impact Score: 0.2841)\n  2. Salary_USD           (Relative Impact Score: 0.2415)\n  3. Experience_Years     (Relative Impact Score: 0.1983)\n\n💡 MGS Actionable Insight: Compensation structures and Project Allocation show high correlation with high performer retention.\nFocus retention programs in departments showing high churn metrics.\n\n🏁 Analysis Execution Finished Successfully.`);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans antialiased selection:bg-blue-500/30 selection:text-blue-200">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur sticky top-0 z-50 px-4 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 tracking-tight text-sm lg:text-base">MGS Data Analytics</h1>
            <p className="text-[10px] lg:text-xs text-slate-400 font-medium flex items-center">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Advanced Sandbox Environment v2.4
            </p>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <nav className="flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs lg:text-sm">
          <button 
            onClick={() => setActiveTab('sandbox')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'sandbox' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Terminal className="h-4 w-4" />
            <span className="hidden sm:inline">Interactive Sandbox</span>
          </button>
          <button 
            onClick={() => setActiveTab('datasets')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'datasets' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Dataset Explorer</span>
          </button>
          <button 
            onClick={() => setActiveTab('source')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'source' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">Source Code</span>
          </button>
        </nav>

        {/* SYSTEM STATUS */}
        <div className="hidden md:flex items-center space-x-4 text-xs text-slate-400 border-l border-slate-800 pl-4">
          <div className="flex items-center space-x-1.5">
            <Cpu className="h-3.5 w-3.5 text-blue-400" />
            <span>Python 3.10.8</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Server className="h-3.5 w-3.5 text-purple-400" />
            <span>RAM: 2.4 / 16 GB</span>
          </div>
        </div>
      </header>

      {/* CORE CONTENT LAYOUT */}
      <main className="p-4 lg:p-8 max-w-[1600px] mx-auto">
        {activeTab === 'sandbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: EDITOR & OUTPUT */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              {/* CODE EDITOR */}
              <div className="bg-[#1E293B] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[400px] lg:h-[480px]">
                <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500/40"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500/40"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/40"></div>
                    </div>
                    <span className="text-xs font-mono text-slate-400 pl-2">analysis_pipeline.py</span>
                  </div>
                  <button 
                    onClick={handleRunCode}
                    disabled={isRunning}
                    className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-950/20 disabled:cursor-not-allowed"
                  >
                    {isRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    <span>{isRunning ? 'Executing...' : 'Run Pipeline'}</span>
                  </button>
                </div>
                <div className="flex-1 p-4 font-mono text-xs lg:text-sm overflow-auto bg-[#0B0F19] text-emerald-400/90 leading-relaxed">
                  <pre className="whitespace-pre-wrap">{code}</pre>
                </div>
              </div>

              {/* TERMINAL OUTPUT */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[300px] lg:h-[350px]">
                <div className="bg-slate-900/40 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 flex items-center">
                    <Terminal className="h-3.5 w-3.5 mr-1.5 text-blue-400" /> Standard Output
                  </span>
                  {executionTime && (
                    <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                      Time: {executionTime}
                    </span>
                  )}
                </div>
                <div className="flex-1 p-4 font-mono text-xs overflow-auto bg-[#070A12] text-slate-300 leading-relaxed">
                  <pre className="whitespace-pre-wrap">{output}</pre>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: VISUALIZATIONS */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              <div className="bg-[#1E293B] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-[500px]">
                <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs lg:text-sm font-semibold text-slate-200 flex items-center">
                    <BarChart2 className="h-4 w-4 mr-2 text-indigo-400" /> Interactive Analytics Engine
                  </span>
                  <div className="flex space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                    <button 
                      onClick={() => setActiveVizTab('distribution')}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${activeVizTab === 'distribution' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Demographics
                    </button>
                    <button 
                      onClick={() => setActiveVizTab('correlation')}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${activeVizTab === 'correlation' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Matrix
                    </button>
                    <button 
                      onClick={() => setActiveVizTab('predictive')}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${activeVizTab === 'predictive' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      ML Insights
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-6 flex flex-col justify-between overflow-auto">
                  {activeVizTab === 'distribution' && (
                    <div className="space-y-6 flex-1 flex flex-col justify-center">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Headcount Breakdown by Department</h4>
                        <div className="space-y-3">
                          {[
                            { name: 'Engineering', count: 360, pct: '30%', color: 'bg-blue-500' },
                            { name: 'Marketing', count: 240, pct: '20%', color: 'bg-amber-500' },
                            { name: 'Sales', count: 240, pct: '20%', color: 'bg-rose-500' },
                            { name: 'Product', count: 180, pct: '15%', color: 'bg-purple-500' },
                            { name: 'Data Science', count: 180, pct: '15%', color: 'bg-emerald-500' },
                          ].map((item) => (
                            <div key={item.name} className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-slate-300">{item.name}</span>
                                <span className="text-slate-400">{item.count} ({item.pct})</span>
                              </div>
                              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: item.pct }}></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/60">
                        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                          <span className="text-[11px] font-medium text-slate-400 block mb-1">Average Salary</span>
                          <span className="text-lg font-bold text-slate-100 tracking-tight">$92,536.44</span>
                        </div>
                        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                          <span className="text-[11px] font-medium text-slate-400 block mb-1">Overall Attrition</span>
                          <span className="text-lg font-bold text-rose-400 tracking-tight">12.00%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeVizTab === 'correlation' && (
                    <div className="space-y-4 flex-1 flex flex-col justify-center">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Correlation Feature Map Matrix</h4>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[10px] overflow-x-auto">
                        <div className="grid grid-cols-5 gap-1 text-center min-w-[320px]">
                          <div></div>
                          <div className="text-slate-400 font-medium">Exp</div>
                          <div className="text-slate-400 font-medium">Proj</div>
                          <div className="text-slate-400 font-medium">Perf</div>
                          <div className="text-slate-400 font-medium">Sal</div>
                          
                          <div className="text-left text-slate-400 font-medium truncate">Experience</div>
                          <div className="bg-blue-950 text-blue-300 p-1.5 rounded font-bold">1.00</div>
                          <div className="bg-blue-900/40 text-blue-400 p-1.5 rounded">0.64</div>
                          <div className="bg-slate-900 text-slate-500 p-1.5 rounded">0.12</div>
                          <div className="bg-blue-900/70 text-blue-300 p-1.5 rounded font-bold">0.78</div>

                          <div className="text-left text-slate-400 font-medium truncate">Projects</div>
                          <div className="bg-blue-900/40 text-blue-400 p-1.5 rounded">0.64</div>
                          <div className="bg-blue-950 text-blue-300 p-1.5 rounded font-bold">1.00</div>
                          <div className="bg-blue-900/50 text-blue-300 p-1.5 rounded font-bold">0.71</div>
                          <div className="bg-blue-900/30 text-blue-400 p-1.5 rounded">0.52</div>

                          <div className="text-left text-slate-400 font-medium truncate">Performance</div>
                          <div className="bg-slate-900 text-slate-500 p-1.5 rounded">0.12</div>
                          <div className="bg-blue-900/50 text-blue-300 p-1.5 rounded font-bold">0.71</div>
                          <div className="bg-blue-950 text-blue-300 p-1.5 rounded font-bold">1.00</div>
                          <div className="bg-blue-900/20 text-blue-400 p-1.5 rounded">0.41</div>

                          <div className="text-left text-slate-400 font-medium truncate">Salary</div>
                          <div className="bg-blue-900/70 text-blue-300 p-1.5 rounded font-bold">0.78</div>
                          <div className="bg-blue-900/30 text-blue-400 p-1.5 rounded">0.52</div>
                          <div className="bg-blue-900/20 text-blue-400 p-1.5 rounded">0.41</div>
                          <div className="bg-blue-950 text-blue-300 p-1.5 rounded font-bold">1.00</div>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed italic">
                        * High positive coefficient matrix visible between (Salary & Experience, 0.78) and (Performance & Projects, 0.71).
                      </p>
                    </div>
                  )}

                  {activeVizTab === 'predictive' && (
                    <div className="space-y-4 flex-1 flex flex-col justify-center">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Random Forest Classification Results</h4>
                      <div className="space-y-3">
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs font-medium text-slate-300">Out-of-Sample Accuracy</span>
                          </div>
                          <span className="text-sm font-mono font-bold text-emerald-400">91.33%</span>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <Layers className="h-4 w-4 text-indigo-400" />
                            <span className="text-xs font-medium text-slate-300">ROC AUC Core Metric</span>
                          </div>
                          <span className="text-sm font-mono font-bold text-indigo-400">0.942</span>
                        </div>
                      </div>
                      <div className="pt-2">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Feature Importance Ranking</span>
                        <div className="space-y-1.5 font-mono text-[11px]">
                          <div className="flex justify-between text-slate-300"><span>1. Performance_Score</span> <span className="text-indigo-400">0.2841</span></div>
                          <div className="flex justify-between text-slate-300"><span>2. Salary_USD</span> <span className="text-indigo-400">0.2415</span></div>
                          <div className="flex justify-between text-slate-300"><span>3. Experience_Years</span> <span className="text-indigo-400">0.1983</span></div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between bg-slate-900/20 -mx-6 -mb-6 px-6 py-3">
                    <span className="flex items-center"><HelpCircle className="h-3 w-3 mr-1" /> Model State: Synchronized</span>
                    <span className="font-mono text-slate-500">MGS-Engine v1.2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'datasets' && <DatasetExplorer />}
        {activeTab === 'source' && <SourceCodeExplorer />}
      </main>
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
    // Catch-all: Mengembalikan rute tidak dikenal ke Landing Page
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;