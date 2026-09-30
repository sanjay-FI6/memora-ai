"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  Sparkles, 
  BrainCircuit, 
  RotateCcw, 
  Calendar, 
  X, 
  History, 
  FileCode,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import CodeInspectorPanel from "@/components/CodeInspectorPanel";
import { fetchWithFallback } from "@/lib/api";

interface HistoricalAuditData {
  submission_id: string;
  file_name: string;
  language: string;
  code: string;
  defect_title: string;
  severity: "high" | "medium" | "low" | string;
  error_lines: number[];
  status: string;
  day?: number;
  attempts?: number;
  concept_gap?: string;
  created_at: string;
  socratic_hint?: string;
  concept_gaps?: string[];
  error_clusters?: Array<{
    id: string;
    title: string;
    severity: "high" | "medium" | "low";
    attempts: number;
    description: string;
  }>;
}

function AnalyzeCodeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("id");

  const [historicalAudit, setHistoricalAudit] = useState<HistoricalAuditData | null>(null);
  const [loading, setLoading] = useState(Boolean(submissionId));

  useEffect(() => {
    if (!submissionId) {
      setHistoricalAudit(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function loadAudit() {
      // 1. Try reading from sessionStorage cache for instant restoration
      try {
        const cached = sessionStorage.getItem(`memora_history_${submissionId}`) || sessionStorage.getItem("memora_active_audit");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.submission_id === submissionId && isMounted) {
            setHistoricalAudit(parsed);
          }
        }
      } catch (e) {
        console.warn("Cache read error:", e);
      }

      // 2. Fetch fresh snapshot from backend API
      try {
        const res = await fetchWithFallback(`/api/history/${encodeURIComponent(submissionId || "")}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setHistoricalAudit(data);
          }
        }
      } catch (err) {
        console.warn("Error fetching historical snapshot:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAudit();

    return () => {
      isMounted = false;
    };
  }, [submissionId]);

  const handleClearAudit = () => {
    setHistoricalAudit(null);
    try {
      sessionStorage.removeItem("memora_active_audit");
    } catch (e) {
      // ignore
    }
    router.push("/analyze-code");
  };

  // Convert historicalAudit into the format expected by CodeInspectorPanel
  const analysisResult = historicalAudit ? {
    status: "success",
    language: historicalAudit.language,
    error_clusters: historicalAudit.error_clusters && historicalAudit.error_clusters.length > 0
      ? historicalAudit.error_clusters
      : [
          {
            id: `err-${historicalAudit.submission_id}`,
            title: historicalAudit.defect_title,
            severity: (historicalAudit.severity === "high" || historicalAudit.severity === "medium" || historicalAudit.severity === "low") 
              ? (historicalAudit.severity as "high" | "medium" | "low") 
              : "high",
            attempts: historicalAudit.attempts || 1,
            description: historicalAudit.socratic_hint || `Identified ${historicalAudit.defect_title} in ${historicalAudit.file_name}.`
          }
        ],
    socratic_hint: historicalAudit.socratic_hint || `Review memory access and boundaries in ${historicalAudit.file_name}.`,
    concept_gap: historicalAudit.concept_gaps || (historicalAudit.concept_gap ? [historicalAudit.concept_gap] : ["Defensive Programming"]),
    error_lines: historicalAudit.error_lines || []
  } : null;

  return (
    <div className="space-y-4">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>

          <Link
            href="/history"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-all"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            Audit History
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Socratic Code Inspector
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Adaptive Concept Discovery
          </div>
        </div>
      </div>

      {/* Historical Audit Banner Indicator */}
      {historicalAudit && (
        <div className="bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-purple-500/15 border border-amber-500/40 rounded-2xl p-3.5 flex items-center justify-between flex-wrap gap-3 shadow-lg shadow-amber-500/5 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-inner">
              <RotateCcw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono tracking-wider">
                  Re-Inspection Mode
                </span>
                <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Viewing Historical Audit:</span>
                  <span className="text-amber-300 font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                    {historicalAudit.file_name}
                  </span>
                </h2>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Recorded on {historicalAudit.created_at}</span>
                <span>•</span>
                <span>Defect: <strong className="text-rose-300">{historicalAudit.defect_title}</strong></span>
                {historicalAudit.error_lines && historicalAudit.error_lines.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-rose-300 font-mono">Line {historicalAudit.error_lines.join(", ")}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAudit}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer shadow-sm"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              Exit Historical Audit
            </button>
          </div>
        </div>
      )}

      {/* Main Inspector Container */}
      <div className="w-full">
        {loading ? (
          <div className="w-full h-[600px] bg-[#1E293B]/60 border border-slate-700/60 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs font-mono tracking-wider text-slate-300 uppercase">
              Restoring Historical Snapshot ({submissionId})...
            </span>
          </div>
        ) : (
          <CodeInspectorPanel 
            code={historicalAudit?.code}
            language={historicalAudit?.language}
            fileName={historicalAudit?.file_name}
            historicalAudit={historicalAudit ? {
              fileName: historicalAudit.file_name,
              timestamp: historicalAudit.created_at,
              submissionId: historicalAudit.submission_id,
              day: historicalAudit.day,
              severity: historicalAudit.severity
            } : null}
            analysisResult={analysisResult}
            errorLines={historicalAudit?.error_lines}
            onClearHistoricalAudit={handleClearAudit}
          />
        )}
      </div>
    </div>
  );
}

export default function AnalyzeCodePage() {
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col p-6 selection:bg-indigo-500/30">
      <div className="max-w-6xl w-full mx-auto">
        <Suspense fallback={
          <div className="flex h-[500px] w-full items-center justify-center text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        }>
          <AnalyzeCodeContent />
        </Suspense>
      </div>
    </div>
  );
}
