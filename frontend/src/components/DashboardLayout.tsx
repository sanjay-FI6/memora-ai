"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Code2, 
  Network, 
  Milestone, 
  History, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  Sparkles, 
  Play, 
  BookOpen, 
  Clock, 
  ArrowUpRight, 
  Terminal, 
  CheckCircle2, 
  Search,
  Filter,
  Check,
  RotateCcw,
  Sliders,
  Database,
  Bot,
  Zap,
  ShieldCheck,
  Flame,
  Layers,
  ChevronDown,
  X
} from "lucide-react";
import { ReactFlow, Background, Controls, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CodeInspectorPanel from "./CodeInspectorPanel";
import ConceptGraph from "./ConceptGraph";
import type { AnalysisGraphData } from "./ConceptGraphView";
import { fetchWithFallback } from "@/lib/api";

// --- Types ---
type Language = "c" | "python" | "java" | "javascript";

interface ErrorCluster {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  attempts: number;
  description: string;
}

interface Recommendation {
  id: string;
  title: string;
  progress: number;
  duration: string;
  ctaText: string;
  color: string;
}

interface AnalysisResult {
  status: string;
  language: string;
  error_clusters: ErrorCluster[];
  socratic_hint: string;
  concept_gap: string[];
  recommendations: Recommendation[];
  error_lines?: number[];
}

// --- Sample Code Templates ---
const codeTemplates: Record<Language, string> = {
  javascript: `function processUser(user) {
  // Potential Null Pointer if user is undefined
  const profile = user.profile;
  console.log("Rendering: " + profile.name);
  
  let dbConnection = openDatabase();
  try {
    dbConnection.query("SELECT * FROM users");
  } finally {
    // Forgot to close connection! Leak!
  }
}`,
  python: `def process_user(user):
    # Potential AttributeError / Null dereference
    profile = user.profile
    print("Rendering: " + profile.name)
    
    db_conn = open_database()
    # Forgot close() or with-statement
    db_conn.query("SELECT * FROM users")`,
  java: `public void processUser(User user) {
    // NullPointerException if user or profile is null
    Profile profile = user.getProfile();
    System.out.println("Rendering: " + profile.getName());
    
    Connection conn = openDatabase();
    // Resource leak: Connection not closed in finally block
    conn.createQuery("SELECT * FROM users");
}`,
  c: `void process_user(User* user) {
    // Segmentation fault / Null dereference
    Profile* profile = user->profile;
    printf("Rendering: %s\\n", profile->name);
    
    FILE* file = fopen("log.txt", "w");
    // Leak: file never closed!
    fprintf(file, "Processing user...\\n");
}`
};

// --- Custom Nodes for React Flow ---
const ConceptNode = ({ data }: { data: { label: string; status: string; level: string } }) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
      case "Proficient":
        return "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
      case "active":
      case "Weakness":
        return "border-indigo-500 bg-indigo-500/15 text-indigo-200 shadow-[0_0_20px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/35";
      case "review":
      case "Gap":
        return "border-amber-500/50 bg-amber-500/10 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]";
      default:
        return "border-slate-700/50 bg-slate-800/40 text-slate-400 opacity-60";
    }
  };

  return (
    <div className={`px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-300 w-[170px] ${getStatusStyle(data.status)}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] uppercase font-semibold tracking-widest opacity-60">{data.level}</span>
        {(data.status === "completed" || data.status === "Proficient") && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
        {(data.status === "active" || data.status === "Weakness") && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
      </div>
      <div className="font-semibold text-xs leading-tight">{data.label}</div>
    </div>
  );
};

const nodeTypes = {
  concept: ConceptNode,
};

// --- Circular Progress Bar ---
const CircularProgress = ({ percentage, color = "stroke-indigo-500" }: { percentage: number; color?: string }) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-12 h-12">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          className="stroke-slate-700/40 fill-none"
          strokeWidth="3.5"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          className={`${color} fill-none transition-all duration-1000 ease-out`}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-slate-200">{percentage}%</span>
    </div>
  );
};

export default function DashboardLayout() {
  // Navigation State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [timeTravelDay, setTimeTravelDay] = useState(30);

  // Code editor states
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("javascript");
  const [codeContent, setCodeContent] = useState(codeTemplates.javascript);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [historicalAudit, setHistoricalAudit] = useState<{
    fileName: string;
    timestamp?: string;
    submissionId?: string;
    day?: number;
    severity?: string;
  } | null>(null);

  // Dynamic Concept Graph states
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);

  // Concept map filter & search
  const [conceptFilter, setConceptFilter] = useState("all");
  const [conceptSearchQuery, setConceptSearchQuery] = useState("");

  const graphAnalysis: AnalysisGraphData | undefined = analysisResult
    ? {
        errorType: analysisResult.error_clusters[0]?.title || "Unknown Defect",
        patternCluster: analysisResult.error_clusters[0]?.description || "Detected Pattern",
        conceptGaps: analysisResult.concept_gap,
      }
    : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync templates on language change
  useEffect(() => {
    setCodeContent(codeTemplates[selectedLanguage]);
  }, [selectedLanguage]);

  // Handle Code Analysis Button
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetchWithFallback(
        "/api/analyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submission_id: crypto.randomUUID(),
            user_code: codeContent,
            programming_language: selectedLanguage,
            stack_trace: "",
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "The code analysis request failed.");
      }

      setAnalysisResult(payload);
      if (payload.nodes && Array.isArray(payload.nodes)) {
        setNodes(payload.nodes);
      }
      if (payload.edges && Array.isArray(payload.edges)) {
        setEdges(payload.edges);
      }
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Unable to connect to the analysis service."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-Inspect Historical Submission Workflow
  const handleReInspectHistoryItem = async (item: typeof submissionHistory[0]) => {
    try {
      const res = await fetchWithFallback(`/api/history/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setCodeContent(data.code);
        setSelectedLanguage((data.language?.toLowerCase() as Language) || "c");
        setHistoricalAudit({
          fileName: data.file_name,
          timestamp: data.created_at,
          submissionId: data.submission_id,
          day: data.day,
          severity: data.severity
        });
        setAnalysisResult({
          status: "success",
          language: data.language,
          error_clusters: data.error_clusters || [
            {
              id: `err-${data.submission_id}`,
              title: data.defect_title,
              severity: (data.severity as "high" | "medium" | "low") || "high",
              attempts: data.attempts || 1,
              description: data.socratic_hint || data.defect_title
            }
          ],
          socratic_hint: data.socratic_hint || `Inspect identified logic flows in ${data.file_name}.`,
          concept_gap: data.concept_gaps || [data.concept_gap],
          recommendations: data.recommendations || recommendations,
          error_lines: data.error_lines || []
        });
        if (data.nodes) setNodes(data.nodes);
        if (data.edges) setEdges(data.edges);
        setActiveTab("Analyze Code");
        return;
      }
    } catch (err) {
      console.warn("Could not fetch history detail, falling back locally:", err);
    }

    // Local benchmark fallback
    setSelectedLanguage((item.language.toLowerCase() as Language) || "c");
    setHistoricalAudit({
      fileName: item.file,
      timestamp: item.timestamp,
      submissionId: item.id,
      day: item.day,
      severity: item.severity
    });
    setAnalysisResult({
      status: "success",
      language: item.language.toLowerCase(),
      error_clusters: [
        {
          id: `err-${item.id}`,
          title: item.error,
          severity: item.severity,
          attempts: item.attempts,
          description: `Historical recorded audit: ${item.status}`
        }
      ],
      socratic_hint: `Review memory and pointer contracts for ${item.file}.`,
      concept_gap: [item.conceptGap],
      recommendations: recommendations,
      error_lines: item.error.includes("Null") ? [12] : [7]
    });
    setActiveTab("Analyze Code");
  };

  // Mock Error Clusters
  const errorClusters: ErrorCluster[] = [
    {
      id: "err-1",
      title: "Null Pointer Dereference",
      severity: "high",
      attempts: 3,
      description: "Dereferencing object fields before confirming they exist in scope."
    },
    {
      id: "err-2",
      title: "Unclosed Resource Leak",
      severity: "medium",
      attempts: 1,
      description: "Database connection, file handle, or network socket not released on finish."
    },
    {
      id: "err-3",
      title: "Index Out of Bounds",
      severity: "high",
      attempts: 2,
      description: "Accessing structure indices exceeding upper constraints or below absolute zero."
    }
  ];

  // Mock Recommendations
  const recommendations: Recommendation[] = [
    {
      id: "rec-1",
      title: "Null Pointer Guardrails",
      progress: 65,
      duration: "15 mins",
      ctaText: "Continue Lesson",
      color: "stroke-indigo-500 text-indigo-400 border-indigo-500/20"
    },
    {
      id: "rec-2",
      title: "Garbage Collection & Leaks",
      progress: 35,
      duration: "25 mins",
      ctaText: "Unlock Lesson",
      color: "stroke-amber-500 text-amber-400 border-amber-500/20"
    },
    {
      id: "rec-3",
      title: "Defensive Struct Checks",
      progress: 90,
      duration: "10 mins",
      ctaText: "Review Concepts",
      color: "stroke-emerald-500 text-emerald-400 border-emerald-500/20"
    }
  ];

  // React Flow Elements
  const initialNodes: Node[] = [
    {
      id: "node-1",
      type: "concept",
      position: { x: 20, y: 150 },
      data: { label: "Memory Allocation", status: "completed", level: "Foundation" },
    },
    {
      id: "node-2",
      type: "concept",
      position: { x: 240, y: 80 },
      data: { label: "Null Safety Guard", status: "active", level: "Core Defect" },
    },
    {
      id: "node-3",
      type: "concept",
      position: { x: 240, y: 220 },
      data: { label: "Resource Lifecycle", status: "completed", level: "Foundation" },
    },
    {
      id: "node-4",
      type: "concept",
      position: { x: 460, y: 80 },
      data: { label: "Defensive Coding", status: "review", level: "Intermediate" },
    },
    {
      id: "node-5",
      type: "concept",
      position: { x: 460, y: 220 },
      data: { label: "Garbage Collection", status: "locked", level: "Advanced" },
    },
  ];

  const initialEdges: Edge[] = [
    { id: "e1-2", source: "node-1", target: "node-2", animated: true },
    { id: "e3-2", source: "node-3", target: "node-2", animated: true },
    { id: "e2-4", source: "node-2", target: "node-4", animated: false },
    { id: "e2-5", source: "node-2", target: "node-5", animated: false },
  ];

  // 30-Day Chronological Submission History Logs
  const submissionHistory = [
    {
      id: "sub-101",
      day: 2,
      file: "early_traversal.c",
      language: "C",
      timestamp: "Day 2 (28 days ago)",
      error: "Null Pointer Dereference",
      status: "Failed - Segmentation Fault",
      severity: "high" as const,
      attempts: 4,
      conceptGap: "Pointers & Memory"
    },
    {
      id: "sub-102",
      day: 6,
      file: "array_allocator.c",
      language: "C",
      timestamp: "Day 6 (24 days ago)",
      error: "Buffer Overflow / OOB",
      status: "Failed - Boundary Check Missing",
      severity: "high" as const,
      attempts: 3,
      conceptGap: "Boundary Checks"
    },
    {
      id: "sub-103",
      day: 12,
      file: "linked_list_chase.c",
      language: "C",
      timestamp: "Day 12 (18 days ago)",
      error: "Orphan Pointer Dereference",
      status: "Weakness - Step 2 Socratic",
      severity: "medium" as const,
      attempts: 2,
      conceptGap: "Linked Lists"
    },
    {
      id: "sub-104",
      day: 18,
      file: "user_repository.py",
      language: "Python",
      timestamp: "Day 18 (12 days ago)",
      error: "Unclosed Resource Leak",
      status: "Fixed via Context Manager",
      severity: "medium" as const,
      attempts: 1,
      conceptGap: "Resource Lifecycle"
    },
    {
      id: "sub-105",
      day: 24,
      file: "matrix_multiplication.java",
      language: "Java",
      timestamp: "Day 24 (6 days ago)",
      error: "Index Out of Bounds",
      status: "Resolved with Guardrail",
      severity: "low" as const,
      attempts: 1,
      conceptGap: "Defensive Coding"
    },
    {
      id: "sub-106",
      day: 29,
      file: "tree_traversal.c",
      language: "C",
      timestamp: "Day 29 (Yesterday)",
      error: "Null Pointer Dereference",
      status: "Resolved with Socratic Hint",
      severity: "high" as const,
      attempts: 3,
      conceptGap: "Null Safety Guardrails"
    },
    {
      id: "sub-107",
      day: 30,
      file: "safe_buffer_stream.c",
      language: "C",
      timestamp: "Day 30 (Today)",
      error: "Clean Code Audit",
      status: "Proficient - 100% Passed",
      severity: "low" as const,
      attempts: 1,
      conceptGap: "Memory Safety"
    }
  ];

  // Dynamically filtered submissions based on current scrubbed timeTravelDay
  const filteredSubmissions = submissionHistory.filter((item) => item.day <= timeTravelDay);

  // Learning Path Tracks Mock Data
  const learningTracks = [
    {
      id: "track-1",
      title: "Memory Safety & Pointer Invariants",
      description: "Master heap allocations, lifecycle invariants, and boundary null-checks in low-level systems.",
      progress: 68,
      totalModules: 8,
      completedModules: 5,
      activeModule: "Defensive Struct Dereferencing",
      duration: "4.5 hrs",
      color: "indigo"
    },
    {
      id: "track-2",
      title: "Resource Lifecycle & Exception Safety",
      description: "Prevent memory leaks, unclosed handles, and file descriptors with RAII patterns.",
      progress: 40,
      totalModules: 6,
      completedModules: 2,
      activeModule: "Auto-Closing Socket Managers",
      duration: "3.2 hrs",
      color: "amber"
    },
    {
      id: "track-3",
      title: "Defensive Coding & Boundary Verification",
      description: "Eliminate buffer overflows, off-by-one errors, and unchecked array access paths.",
      progress: 92,
      totalModules: 5,
      completedModules: 4,
      activeModule: "Safe Index Offset Guarantees",
      duration: "2.8 hrs",
      color: "emerald"
    }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#0F172A] text-slate-200">
      
      {/* --- Sidebar Container --- */}
      <motion.div
        animate={{ width: sidebarCollapsed ? 80 : 250 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="relative flex flex-col h-full bg-[#1E293B] border-r border-slate-800 shadow-2xl z-20 flex-shrink-0"
      >
        {/* Toggle Collapse Button */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-8 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 hover:bg-indigo-600 border border-slate-700 text-white shadow-lg transition-colors cursor-pointer"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Brand / Logo */}
        <div className="flex items-center gap-3 p-6 border-b border-slate-800/80">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25 flex-shrink-0 animate-pulse">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              <span className="font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
                Memora AI
              </span>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                v1.0-beta
              </span>
            </motion.div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {[
            { name: "Dashboard", icon: LayoutDashboard },
            { name: "Analyze Code", icon: Code2 },
            { name: "Concept Map", icon: Network },
            { name: "Learning Path", icon: Milestone },
            { name: "History", icon: History },
            { name: "Settings", icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;

            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`relative flex items-center w-full gap-4 px-3.5 py-3 rounded-xl text-sm font-medium transition-all group overflow-hidden cursor-pointer ${
                  isActive 
                    ? "text-indigo-400 bg-indigo-500/10 shadow-inner" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeGlow" 
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-indigo-400 to-purple-500 rounded-r-md"
                  />
                )}
                <Icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-105 duration-200 ${isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"}`} />
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="truncate"
                  >
                    {item.name}
                  </motion.span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border-2 border-indigo-500 shadow-md">
                <span className="font-extrabold text-indigo-300 text-sm">AL</span>
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>
            {!sidebarCollapsed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col min-w-0"
              >
                <span className="text-xs font-semibold text-slate-200 truncate">Alex Learner</span>
                <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">Active Learner</span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* --- Main Dashboard Container --- */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0F172A] relative">
        {/* Decorative Background Glows */}
        <div className="absolute top-0 right-1/4 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[250px] h-[250px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />

        {/* Header bar */}
        <header className="flex items-center justify-between p-6 border-b border-slate-800/80 bg-[#0F172A]/80 backdrop-blur-md z-10 sticky top-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {activeTab === "Dashboard" && "Workspace Overview"}
              {activeTab === "Analyze Code" && "Interactive Socratic Inspector"}
              {activeTab === "Concept Map" && "Concept Knowledge Graph"}
              {activeTab === "Learning Path" && "Personalized Learning Curriculum"}
              {activeTab === "History" && "Code Analysis History"}
              {activeTab === "Settings" && "Platform Configuration & AI Settings"}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {activeTab === "Dashboard" && "Select your environment language, write/upload buggy scripts, and inspect semantic AI resolutions."}
              {activeTab === "Analyze Code" && "Step through identified defects with line-by-line Socratic guidance, heap memory diagrams, and diff views."}
              {activeTab === "Concept Map" && "Explore multi-dimensional mastery nodes, weakness clusters, and linked conceptual dependencies."}
              {activeTab === "Learning Path" && "Follow structured milestone tracks designed dynamically from your detected error gaps."}
              {activeTab === "History" && "Review previous submissions, analyzed trace dumps, and resolved concept gaps."}
              {activeTab === "Settings" && "Manage LLM engine configurations, vector database endpoints, and workspace preferences."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] border border-slate-700 px-2 py-1 rounded bg-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              Connected: Node v1.0
            </span>
          </div>
        </header>

        {/* Dynamic Tab Views */}
        <AnimatePresence mode="wait">
          
          {/* ================= 1. TAB: DASHBOARD (OVERVIEW) ================= */}
          {activeTab === "Dashboard" && (
            <motion.div
              key="view-dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-12 gap-6 p-6 max-w-[1600px] mx-auto w-full z-10"
            >
              {/* Column 1 (Span 5) */}
              <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                
                {/* Code Upload/Paste Card */}
                <div className="glass-panel p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-indigo-400" />
                      Code Sandbox Analysis
                    </h2>
                    
                    {/* Language Selectors */}
                    <div className="flex gap-1.5 p-1 bg-slate-900/60 border border-slate-700/50 rounded-xl">
                      {(["c", "python", "java", "javascript"] as Language[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setSelectedLanguage(lang)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                            selectedLanguage === lang 
                              ? "bg-indigo-500 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {lang === "javascript" ? "JS" : lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Monaco-style Code Textarea */}
                  <div className="relative border border-slate-800/80 rounded-xl overflow-hidden mb-4 shadow-2xl">
                    <div className="flex bg-[#070b12] text-xs py-3 h-[250px] overflow-hidden">
                      <div className="flex flex-col text-right text-slate-600 font-mono px-3 select-none border-r border-slate-800/40 w-10">
                        {Array.from({ length: 11 }).map((_, i) => (
                          <span key={i} className="leading-6">{i + 1}</span>
                        ))}
                      </div>
                      <textarea
                        value={codeContent}
                        onChange={(e) => setCodeContent(e.target.value)}
                        className="flex-1 bg-transparent px-3 text-emerald-400/90 font-mono leading-6 resize-none focus:outline-none h-full overflow-y-auto"
                        spellCheck="false"
                      />
                    </div>
                  </div>

                  {/* Glow Button CTA */}
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="relative w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all overflow-hidden flex items-center justify-center gap-2 cursor-pointer border-t border-white/10 group"
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Analyzing Code Graph...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse group-hover:scale-110 transition-transform" />
                        Analyze Now
                      </>
                    )}
                  </button>
                </div>

                {analysisError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="h-4 w-4" /> Analysis failed
                    </div>
                    <p className="mt-1 text-rose-200/80">{analysisError}</p>
                    <p className="mt-2 text-[10px] text-rose-200/60">Make sure the backend is running on port 8010.</p>
                  </div>
                )}

                {/* Detected Error Clusters / Clean Code Panel */}
                <div className="glass-panel p-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-4">
                    {analysisResult?.error_clusters?.[0]?.title === "No error is found" ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Code Verification Result
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Detected Error Clusters
                      </>
                    )}
                  </h2>

                  {analysisResult?.error_clusters?.[0]?.title === "No error is found" ? (
                    <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-start gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Clean Code Verified
                          </span>
                          <span className="text-[10px] text-emerald-400 font-medium">0 Errors Found</span>
                        </div>
                        <h3 className="font-bold text-xs text-white">
                          Algorithm Logic & Syntax Validated
                        </h3>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {analysisResult.socratic_hint || "No logic flaws or index boundary issues detected. All loop boundaries and operations are verified and valid."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {(analysisResult?.error_clusters || errorClusters).map((cluster, index) => {
                        const isHigh = cluster.severity === "high";
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            key={cluster.id}
                            className="p-3.5 bg-slate-800/40 border border-slate-700/40 rounded-xl hover:border-slate-600/50 hover:bg-slate-800/60 transition-all flex items-start justify-between gap-4 group cursor-pointer"
                            onClick={() => setActiveTab("Analyze Code")}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                  isHigh 
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}>
                                  {cluster.severity}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {cluster.attempts} attempts
                                </span>
                              </div>
                              <h3 className="font-bold text-xs text-slate-200 group-hover:text-white transition-colors">
                                {cluster.title}
                              </h3>
                              <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                                {cluster.description}
                              </p>
                            </div>
                            <button className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-700 flex items-center justify-center border border-slate-600/30 text-slate-400 hover:text-slate-200 transition-all">
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {analysisResult && analysisResult.error_clusters?.[0]?.title !== "No error is found" && (
                    <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-slate-300">
                      <span className="font-bold text-indigo-300">Socratic hint: </span>
                      {analysisResult.socratic_hint}
                    </div>
                  )}
                </div>

              </div>

              {/* Column 2 (Span 7) */}
              <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">

                {/* Knowledge Graph Container */}
                <div className="glass-panel p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <Network className="w-4 h-4 text-purple-400" />
                        Concept Knowledge Map
                      </h2>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Click concepts to reveal linked sub-paths. Pulsing node signifies current weakness cluster.
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => setActiveTab("Concept Map")}
                      className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg px-2.5 py-1 text-[10px] font-bold text-indigo-300 transition-colors cursor-pointer"
                    >
                      <Layers className="w-3 h-3" />
                      Expand Graph
                    </button>
                  </div>

                  {/* Graph canvas */}
                  <ConceptGraph 
                    height="320px" 
                    dynamicNodes={nodes.length > 0 ? nodes : undefined}
                    dynamicEdges={edges.length > 0 ? edges : undefined}
                    analysis={graphAnalysis}
                    timeTravelDay={timeTravelDay}
                    onTimeTravelChange={setTimeTravelDay}
                    onSelectLesson={() => setActiveTab("Learning Path")} 
                  />
                </div>

                {/* Targeted Recommendations */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Targeted AI Recommendations
                    </h2>
                    <button 
                      onClick={() => setActiveTab("Learning Path")}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold tracking-wider uppercase cursor-pointer"
                    >
                      View All Paths →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(analysisResult?.recommendations || recommendations).map((rec) => (
                      <div 
                        key={rec.id} 
                        className="glass-panel p-4 flex flex-col justify-between border border-slate-700/40 relative hover:-translate-y-1 transition-all duration-300"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Clock className="w-3 h-3 text-indigo-400/80" />
                              {rec.duration}
                            </span>
                            <h3 className="font-bold text-xs text-slate-200 mt-1 leading-tight line-clamp-2">
                              {rec.title}
                            </h3>
                          </div>
                          
                          <CircularProgress 
                            percentage={rec.progress} 
                            color={rec.color.split(" ")[0]} 
                          />
                        </div>

                        <button 
                          onClick={() => setActiveTab("Learning Path")}
                          className={`w-full py-2 border rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            rec.progress < 50 
                              ? "bg-indigo-500/10 hover:bg-indigo-500 text-indigo-300 hover:text-white border-indigo-500/30" 
                              : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/60"
                          }`}
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          {rec.ctaText}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ================= 2. TAB: ANALYZE CODE (INSPECTOR) ================= */}
          {activeTab === "Analyze Code" && (
            <motion.div
              key="view-inspector"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-[1400px] mx-auto w-full z-10"
            >
              <CodeInspectorPanel 
                code={codeContent}
                language={selectedLanguage}
                fileName={historicalAudit?.fileName}
                historicalAudit={historicalAudit}
                analysisResult={analysisResult}
                onNavigateTab={setActiveTab}
                onClearHistoricalAudit={() => setHistoricalAudit(null)}
              />
            </motion.div>
          )}

          {/* ================= 3. TAB: CONCEPT MAP (EXPANDED) ================= */}
          {activeTab === "Concept Map" && (
            <motion.div
              key="view-concept-map"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-[1600px] mx-auto w-full z-10 flex flex-col gap-6"
            >
              {/* Concept Map Controls Bar */}
              <div className="glass-panel p-4 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={conceptSearchQuery}
                      onChange={(e) => setConceptSearchQuery(e.target.value)}
                      placeholder="Search concepts, pointers, nameerror, memory..."
                      className="bg-slate-900/60 border border-slate-700/50 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-72"
                    />
                    {conceptSearchQuery && (
                      <button 
                        onClick={() => setConceptSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Badges */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Filter:</span>
                  {[
                    { id: "all", label: "All (6)" },
                    { id: "proficient", label: "Proficient (4)", color: "text-emerald-400 border-emerald-500/30" },
                    { id: "weakness", label: "Weakness (1)", color: "text-amber-400 border-amber-500/30" },
                    { id: "gap", label: "Gap (1)", color: "text-rose-400 border-rose-500/30" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setConceptFilter(f.id)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        conceptFilter === f.id
                          ? "bg-slate-700 text-white border-slate-500"
                          : "bg-slate-900/40 text-slate-400 border-slate-700/40 hover:text-slate-200"
                      } ${f.color || ""}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Interactive Canvas */}
              <div className="glass-panel p-4 flex flex-col">
                <ConceptGraph 
                  height="560px" 
                  dynamicNodes={nodes.length > 0 ? nodes : undefined}
                  dynamicEdges={edges.length > 0 ? edges : undefined}
                  analysis={graphAnalysis}
                  timeTravelDay={timeTravelDay}
                  onTimeTravelChange={setTimeTravelDay}
                  externalSearchQuery={conceptSearchQuery}
                  onSearchChange={setConceptSearchQuery}
                  conceptFilter={conceptFilter}
                  onSelectLesson={() => setActiveTab("Learning Path")} 
                  onInspectDefect={() => setActiveTab("Analyze Code")}
                />
              </div>
            </motion.div>
          )}

          {/* ================= 4. TAB: LEARNING PATH ================= */}
          {activeTab === "Learning Path" && (
            <motion.div
              key="view-learning-path"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-[1400px] mx-auto w-full z-10 flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {learningTracks.map((track) => (
                  <div 
                    key={track.id}
                    className="glass-panel p-6 flex flex-col justify-between border border-slate-700/50 hover:border-indigo-500/40 transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {track.duration} Total
                        </span>
                        <CircularProgress percentage={track.progress} />
                      </div>

                      <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors mb-2">
                        {track.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        {track.description}
                      </p>

                      <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2 mb-4">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Current Lesson:</span>
                          <span className="font-semibold text-indigo-300">{track.activeModule}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${track.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>{track.completedModules} of {track.totalModules} modules completed</span>
                          <span>{track.progress}%</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab("Analyze Code")}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Resume Track
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ================= 5. TAB: HISTORY ================= */}
          {activeTab === "History" && (
            <motion.div
              key="view-history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-[1400px] mx-auto w-full z-10 flex flex-col gap-6"
            >
              {/* Time-Travel (30-Day History) Filter Bar */}
              <div className="glass-panel p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                      Time-Travel (30-Day History)
                    </h2>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      30-Day Limit
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      Showing <strong className="text-indigo-300 font-bold">{filteredSubmissions.length}</strong> of {submissionHistory.length} audits
                    </span>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Day {timeTravelDay} of 30
                    </span>
                  </div>
                </div>

                {/* Slider Input */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Day 1</span>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={timeTravelDay}
                    onChange={(e) => setTimeTravelDay(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                  />
                  <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">Day 30 (Today)</span>
                </div>
              </div>

              <div className="glass-panel p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-4">
                  <History className="w-4 h-4 text-indigo-400" />
                  Historical Submissions & Defect Audits (Filtered up to Day {timeTravelDay})
                </h2>

                {filteredSubmissions.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
                    No submissions recorded prior to Day {timeTravelDay}. Scrub the slider forward to reveal subsequent logs.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredSubmissions.map((item) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={item.id}
                        className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-all flex-wrap gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xs text-indigo-400 border border-slate-700">
                            {item.language}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-slate-200">{item.file}</h3>
                              <span className="text-[10px] text-slate-400">• {item.timestamp}</span>
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                Day {item.day}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                item.severity === "high"
                                  ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                  : item.severity === "medium"
                                  ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                  : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              }`}>
                                {item.error}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {item.status} ({item.attempts} attempt{item.attempts > 1 ? "s" : ""})
                              </span>
                              <span className="text-[10px] text-indigo-300/80 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                Concept: {item.conceptGap}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleReInspectHistoryItem(item)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700 hover:border-indigo-500/50 hover:text-white"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Re-inspect
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ================= 6. TAB: SETTINGS ================= */}
          {activeTab === "Settings" && (
            <motion.div
              key="view-settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-[1200px] mx-auto w-full z-10 flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* AI Configuration */}
                <div className="glass-panel p-6 flex flex-col gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    AI Engine & Model Preferences
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Active Reasoning Model</label>
                      <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
                        <option>OpenAI GPT-4 Turbo (Structured JSON)</option>
                        <option>OpenAI GPT-4o (High Speed)</option>
                        <option>Local Ollama / Llama 3</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Socratic Guidance Strictness</label>
                      <div className="grid grid-cols-3 gap-2">
                        {["Gentle Nudges", "Balanced Hints", "Direct Fixes"].map((mode, i) => (
                          <button 
                            key={mode} 
                            className={`py-2 rounded-lg text-[10px] font-bold border ${i === 1 ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" : "bg-slate-900 text-slate-400 border-slate-800"}`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vector Database & Infrastructure */}
                <div className="glass-panel p-6 flex flex-col gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Storage & Vector Endpoints
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Qdrant Vector DB Endpoint</label>
                      <input 
                        type="text" 
                        readOnly 
                        value="http://localhost:6333 (Collection: concept_embeddings)"
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">PostgreSQL Connection</label>
                      <input 
                        type="text" 
                        readOnly 
                        value="postgresql://postgres:***@localhost:5432/memoradb"
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-emerald-400 text-xs mt-2">
                      <ShieldCheck className="w-4 h-4" />
                      Database schemas synchronized and healthy
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

    </div>
  );
}
