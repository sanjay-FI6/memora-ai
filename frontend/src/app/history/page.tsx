"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  History, 
  RotateCcw, 
  Search, 
  Filter, 
  Sliders, 
  Calendar, 
  Code2, 
  ArrowRight,
  FileCode,
  X
} from "lucide-react";

import { fetchWithFallback } from "@/lib/api";

export interface HistoryItem {
  submission_id: string;
  file_name: string;
  language: string;
  code: string;
  defect_title: string;
  severity: "high" | "medium" | "low" | string;
  error_lines: number[];
  status: string;
  day: number;
  attempts: number;
  concept_gap: string;
  created_at: string;
}

const fallbackHistoryItems: HistoryItem[] = [
  {
    submission_id: "sub-101",
    file_name: "early_traversal.c",
    language: "c",
    code: `#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node {\n    int val;\n    struct Node* left;\n    struct Node* right;\n} Node;\n\nvoid printTreeInOrder(Node* root) {\n    printf("Node val: %d\\n", root->val);\n    if (root->left != NULL) printTreeInOrder(root->left);\n    if (root->right != NULL) printTreeInOrder(root->right);\n}`,
    defect_title: "Null Pointer Dereference",
    severity: "high",
    error_lines: [12],
    status: "Failed - Segmentation Fault",
    day: 2,
    attempts: 4,
    concept_gap: "Pointers & Memory",
    created_at: "Day 2 (28 days ago)"
  },
  {
    submission_id: "sub-102",
    file_name: "array_allocator.c",
    language: "c",
    code: `#include <stdio.h>\n#include <stdlib.h>\n\nint* createBuffer(int size) {\n    int* buf = (int*)malloc(size * sizeof(int));\n    for (int i = 0; i <= size; i++) {\n        buf[i] = i * 2;\n    }\n    return buf;\n}`,
    defect_title: "Buffer Overflow / OOB",
    severity: "high",
    error_lines: [7],
    status: "Failed - Boundary Check Missing",
    day: 6,
    attempts: 3,
    concept_gap: "Boundary Checks",
    created_at: "Day 6 (24 days ago)"
  },
  {
    submission_id: "sub-103",
    file_name: "linked_list_chase.c",
    language: "c",
    code: `#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct ListNode {\n    int data;\n    struct ListNode* next;\n} ListNode;\n\nint getThirdElement(ListNode* head) {\n    return head->next->next->data;\n}`,
    defect_title: "Orphan Pointer Dereference",
    severity: "medium",
    error_lines: [10],
    status: "Weakness - Step 2 Socratic",
    day: 12,
    attempts: 2,
    concept_gap: "Linked Lists",
    created_at: "Day 12 (18 days ago)"
  },
  {
    submission_id: "sub-104",
    file_name: "user_repository.py",
    language: "python",
    code: `def fetch_user_record(user_id):\n    db_conn = open_database()\n    cursor = db_conn.cursor()\n    result = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))\n    return result.fetchone()`,
    defect_title: "Unclosed Resource Leak",
    severity: "medium",
    error_lines: [2],
    status: "Fixed via Context Manager",
    day: 18,
    attempts: 1,
    concept_gap: "Resource Lifecycle",
    created_at: "Day 18 (12 days ago)"
  },
  {
    submission_id: "sub-105",
    file_name: "matrix_multiplication.java",
    language: "java",
    code: `public class MatrixMultiplier {\n    public static int getCorner(int[][] matrix) {\n        int rows = matrix.length;\n        int cols = matrix[0].length;\n        return matrix[rows][cols];\n    }\n}`,
    defect_title: "Index Out of Bounds",
    severity: "low",
    error_lines: [6],
    status: "Resolved with Guardrail",
    day: 24,
    attempts: 1,
    concept_gap: "Defensive Coding",
    created_at: "Day 24 (6 days ago)"
  },
  {
    submission_id: "sub-106",
    file_name: "tree_traversal.c",
    language: "c",
    code: `#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node {\n    int val;\n    struct Node* left;\n    struct Node* right;\n} Node;\n\nvoid printTreeInOrder(Node* root) {\n    printf("Node value: %d\\n", root->val);\n    if (root->left != NULL) {\n        printTreeInOrder(root->left);\n    }\n    if (root->right != NULL) {\n        printTreeInOrder(root->right);\n    }\n}`,
    defect_title: "Null Pointer Dereference",
    severity: "high",
    error_lines: [12],
    status: "Resolved with Socratic Hint",
    day: 29,
    attempts: 3,
    concept_gap: "Null Safety Guardrails",
    created_at: "Day 29 (Yesterday)"
  },
  {
    submission_id: "sub-107",
    file_name: "safe_buffer_stream.c",
    language: "c",
    code: `#include <stdio.h>\n#include <stdlib.h>\n\nint safeRead(const int* buffer, size_t len, size_t index) {\n    if (buffer == NULL || index >= len) {\n        return -1;\n    }\n    return buffer[index];\n}`,
    defect_title: "No error is found",
    severity: "low",
    error_lines: [],
    status: "Proficient - 100% Passed",
    day: 30,
    attempts: 1,
    concept_gap: "Memory Safety",
    created_at: "Day 30 (Today)"
  }
];

export default function HistoryPage() {
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(fallbackHistoryItems);
  const [timeTravelDay, setTimeTravelDay] = useState<number>(30);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");

  // Fetch live submission history from backend
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetchWithFallback("/api/history");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setHistoryItems(data);
          }
        }
      } catch (err) {
        console.warn("Using fallback history data:", err);
      }
    }
    fetchHistory();
  }, []);

  // Filter items by time travel day, search query, language, severity
  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      // Time travel day filter (day <= scrubbed day)
      const itemDay = item.day || 30;
      if (itemDay > timeTravelDay) return false;

      // Language filter
      if (selectedLanguage !== "all" && item.language.toLowerCase() !== selectedLanguage.toLowerCase()) {
        return false;
      }

      // Severity filter
      if (selectedSeverity !== "all" && item.severity.toLowerCase() !== selectedSeverity.toLowerCase()) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchFile = item.file_name.toLowerCase().includes(q);
        const matchDefect = item.defect_title.toLowerCase().includes(q);
        const matchLang = item.language.toLowerCase().includes(q);
        const matchGap = item.concept_gap.toLowerCase().includes(q);
        return matchFile || matchDefect || matchLang || matchGap;
      }

      return true;
    });
  }, [historyItems, timeTravelDay, selectedLanguage, selectedSeverity, searchQuery]);

  // Handle Re-Inspect Navigation Workflow
  const handleReInspect = (item: HistoryItem) => {
    // 1. Cache the historical snapshot in sessionStorage for instant hydration
    try {
      sessionStorage.setItem(`memora_history_${item.submission_id}`, JSON.stringify(item));
      sessionStorage.setItem("memora_active_audit", JSON.stringify(item));
    } catch (e) {
      console.warn("sessionStorage cache error:", e);
    }

    // 2. Programmatically navigate to /analyze-code?id={submission_id}
    router.push(`/analyze-code?id=${encodeURIComponent(item.submission_id)}`);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col p-6 selection:bg-indigo-500/30">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <History className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Code Analysis &amp; Defect Audit History
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/analyze-code"
              className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg font-semibold transition-all"
            >
              <Code2 className="w-3.5 h-3.5" />
              Open Live Inspector
            </Link>
          </div>
        </div>

        {/* 30-Day Time-Travel History Scrubbing Control */}
        <div className="bg-[#1E293B]/80 border border-slate-700/60 backdrop-blur-md p-5 rounded-2xl shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span>30-Day Historical Time-Travel Scrubbing</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-semibold">
                    Day {timeTravelDay} of 30
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Drag slider to reconstruct chronological code submissions and see concept evolution.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Viewing Audits up to: </span>
              <strong className="text-indigo-300">
                {timeTravelDay === 30 ? "Day 30 (Present)" : `Day ${timeTravelDay} (${30 - timeTravelDay}d ago)`}
              </strong>
            </div>
          </div>

          {/* Time Slider */}
          <div className="flex items-center gap-4 pt-1">
            <span className="text-xs font-mono text-slate-400 w-12 text-right">Day 1</span>
            <input
              type="range"
              min={1}
              max={30}
              value={timeTravelDay}
              onChange={(e) => setTimeTravelDay(Number(e.target.value))}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
            />
            <span className="text-xs font-mono text-indigo-400 w-12 font-bold">Day 30</span>
          </div>
        </div>

        {/* Search & Filtering Bar */}
        <div className="bg-[#1E293B]/80 border border-slate-700/60 backdrop-blur-md p-4 rounded-2xl flex items-center justify-between flex-wrap gap-4">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file name, defect type, language, or concept gap..."
              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mr-1">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Language:</span>
            </div>
            {["all", "c", "python", "java"].map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold uppercase transition-all cursor-pointer border ${
                  selectedLanguage === lang
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                    : "bg-slate-900/80 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                {lang}
              </button>
            ))}

            <div className="h-4 w-[1px] bg-slate-700 mx-1" />

            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mr-1">
              <span>Severity:</span>
            </div>
            {["all", "high", "medium", "low"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold uppercase transition-all cursor-pointer border ${
                  selectedSeverity === sev
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                    : "bg-slate-900/80 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Historical Submissions List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Showing {filteredItems.length} Audited Submission{filteredItems.length === 1 ? "" : "s"}
            </span>
            <span className="text-[11px] text-slate-500">
              Click &quot;Re-inspect&quot; to restore the full historical Socratic debugging state
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-[#1E293B]/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <History className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No Historical Audits Match Current Filter</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try scrubbing the 30-day history slider to a higher day or clearing active search keywords.
              </p>
              <button
                onClick={() => {
                  setTimeTravelDay(30);
                  setSearchQuery("");
                  setSelectedLanguage("all");
                  setSelectedSeverity("all");
                }}
                className="px-4 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold hover:bg-indigo-600/30 transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredItems.map((item) => {
                const isHigh = item.severity === "high";
                const isMed = item.severity === "medium";
                const isClean = item.defect_title === "No error is found";

                return (
                  <motion.div
                    key={item.submission_id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="bg-[#1E293B]/80 hover:bg-[#1E293B] border border-slate-700/60 hover:border-indigo-500/40 rounded-2xl p-4 transition-all duration-200 shadow-md flex items-center justify-between flex-wrap gap-4 group"
                  >
                    {/* Left Details */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-slate-900/90 border border-slate-700/80 flex flex-col items-center justify-center font-bold text-xs text-indigo-400 flex-shrink-0 group-hover:border-indigo-500/50 group-hover:text-indigo-300 transition-colors shadow-inner">
                        <FileCode className="w-4 h-4 mb-0.5" />
                        <span className="text-[9px] uppercase font-mono">{item.language}</span>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-slate-100 group-hover:text-indigo-200 transition-colors">
                            {item.file_name}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-medium">
                            • {item.created_at}
                          </span>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700/60 font-semibold">
                            Day {item.day}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wide ${
                            isClean 
                              ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                              : isHigh
                              ? "text-rose-300 bg-rose-500/15 border-rose-500/30"
                              : isMed
                              ? "text-amber-300 bg-amber-500/15 border-amber-500/30"
                              : "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                          }`}>
                            {item.defect_title}
                          </span>

                          <span className="text-[11px] text-slate-300 font-medium">
                            {item.status} ({item.attempts} attempt{item.attempts > 1 ? "s" : ""})
                          </span>

                          {item.error_lines && item.error_lines.length > 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/40 font-semibold">
                              Line {item.error_lines.join(", ")}
                            </span>
                          )}

                          <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                            Concept: {item.concept_gap}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Re-Inspect Button CTA */}
                    <button
                      onClick={() => handleReInspect(item)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/35 transition-all flex items-center gap-2 cursor-pointer flex-shrink-0 group-hover:scale-105"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-inspect</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
