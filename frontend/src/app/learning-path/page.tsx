"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Milestone, 
  Sparkles, 
  BookOpen, 
  Play, 
  RotateCcw, 
  Code2, 
  X
} from "lucide-react";
import { fetchWithFallback } from "@/lib/api";

interface CurriculumTrack {
  track_id?: string;
  id?: string;
  title: string;
  description: string;
  total_time?: string;
  duration?: string;
  completion_rate?: number;
  progress?: number;
  current_lesson?: string;
  activeModule?: string;
  completed_modules?: number;
  completedModules?: number;
  total_modules?: number;
  totalModules?: number;
  color?: string;
}

const baselineTracks: CurriculumTrack[] = [
  {
    track_id: "track-1",
    id: "track-1",
    title: "Memory Safety & Pointer Invariants",
    description: "Master heap allocations, lifecycle invariants, and boundary null-checks in low-level systems.",
    completion_rate: 68,
    progress: 68,
    total_modules: 8,
    totalModules: 8,
    completed_modules: 5,
    completedModules: 5,
    current_lesson: "Defensive Struct Dereferencing",
    activeModule: "Defensive Struct Dereferencing",
    total_time: "4.5 HRS TOTAL",
    duration: "4.5 hrs",
    color: "indigo"
  },
  {
    track_id: "track-2",
    id: "track-2",
    title: "Resource Lifecycle & Exception Safety",
    description: "Prevent memory leaks, unclosed handles, and file descriptors with RAII patterns.",
    completion_rate: 40,
    progress: 40,
    total_modules: 6,
    totalModules: 6,
    completed_modules: 2,
    completedModules: 2,
    current_lesson: "Auto-Closing Socket Managers",
    activeModule: "Auto-Closing Socket Managers",
    total_time: "3.2 HRS TOTAL",
    duration: "3.2 hrs",
    color: "amber"
  },
  {
    track_id: "track-3",
    id: "track-3",
    title: "Defensive Coding & Boundary Verification",
    description: "Eliminate buffer overflows, off-by-one errors, and unchecked array access paths.",
    completion_rate: 92,
    progress: 92,
    total_modules: 5,
    totalModules: 5,
    completed_modules: 4,
    completedModules: 4,
    current_lesson: "Safe Index Offset Guarantees",
    activeModule: "Safe Index Offset Guarantees",
    total_time: "2.8 HRS TOTAL",
    duration: "2.8 hrs",
    color: "emerald"
  }
];

function CircularProgress({ percentage }: { percentage: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-11 h-11 flex items-center justify-center">
      <svg className="w-11 h-11 transform -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          className="text-slate-800"
          fill="transparent"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-indigo-500 transition-all duration-1000 ease-out"
          fill="transparent"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-slate-200">
        {percentage}%
      </span>
    </div>
  );
}

export default function LearningPathPage() {
  const router = useRouter();
  const [tracks, setTracks] = useState<CurriculumTrack[]>(baselineTracks);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [activeDrillModal, setActiveDrillModal] = useState<CurriculumTrack | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("memora_curriculum_tracks");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTracks(parsed);
          setIsPersonalized(true);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not load stored curriculum tracks", e);
    }

    // Try fetching default/active curriculum from backend
    fetchWithFallback("/api/curriculum")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && data.curriculum_tracks && Array.isArray(data.curriculum_tracks)) {
          setTracks(data.curriculum_tracks);
        }
      })
      .catch((err) => {
        console.warn("API curriculum fallback to baseline", err);
      });
  }, []);

  const handleResetCurriculum = () => {
    try {
      localStorage.removeItem("memora_curriculum_tracks");
    } catch (e) {
      // ignore
    }
    setTracks(baselineTracks);
    setIsPersonalized(false);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col p-6 selection:bg-indigo-500/30">
      <div className="max-w-[1500px] w-full mx-auto space-y-6 flex-1 flex flex-col">
        
        {/* Header Bar */}
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
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Milestone className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Personalized Learning Curriculum
                </h1>
                <p className="text-[10px] text-slate-400">
                  Follow structured milestone tracks designed dynamically from your detected error gaps.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/analyze-code"
              className="flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              <Code2 className="w-3.5 h-3.5" />
              Analyze New Code
            </Link>
          </div>
        </div>

        {/* Dynamic Status Banner */}
        {isPersonalized ? (
          <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs shadow-lg shadow-indigo-950/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-slate-200">Personalized Curriculum Active</div>
                <div className="text-slate-400">Tracks tailored dynamically from your latest analyzed code algorithms and defect invariants.</div>
              </div>
            </div>
            <button
              onClick={handleResetCurriculum}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Baseline
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-indigo-400">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-slate-300">Showing recommended baseline tracks</div>
                <div className="text-slate-500">Analyze a code snippet in the workspace to personalize your curriculum.</div>
              </div>
            </div>
            <Link
              href="/analyze-code"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              Analyze Code Now
            </Link>
          </div>
        )}

        {/* Grid of Dynamic Track Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tracks.map((track, idx) => {
            const progressPct = track.completion_rate ?? track.progress ?? 0;
            const durationStr = track.total_time ?? track.duration ?? "1.5 HRS TOTAL";
            const activeLessonStr = track.current_lesson ?? track.activeModule ?? "Foundation Drill";
            const completedMods = track.completed_modules ?? track.completedModules ?? 0;
            const totalMods = track.total_modules ?? track.totalModules ?? 5;

            return (
              <div 
                key={track.track_id || track.id || `track-${idx}`}
                className="bg-[#1E293B]/80 border border-slate-700/60 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/40 transition-all group backdrop-blur-md shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {durationStr}
                    </span>
                    <CircularProgress percentage={progressPct} />
                  </div>

                  <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors mb-2">
                    {track.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    {track.description}
                  </p>

                  <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/80 space-y-2 mb-4">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Current Lesson:</span>
                      <span className="font-semibold text-indigo-300 truncate max-w-[200px]" title={activeLessonStr}>
                        {activeLessonStr}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{completedMods} of {totalMods} modules completed</span>
                      <span>{progressPct}%</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setActiveDrillModal(track)}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Resume Track
                </button>
              </div>
            );
          })}
        </div>

        {/* Interactive Module Drill Modal */}
        <AnimatePresence>
          {activeDrillModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-[#0F172A] p-6 max-w-xl w-full border border-indigo-500/30 rounded-2xl shadow-2xl relative flex flex-col gap-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 mb-1">
                      {activeDrillModal.total_time || activeDrillModal.duration || "1.5 HRS"} • {activeDrillModal.completion_rate ?? activeDrillModal.progress ?? 0}% COMPLETED
                    </div>
                    <h2 className="text-lg font-bold text-slate-100">
                      {activeDrillModal.title}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setActiveDrillModal(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeDrillModal.description}
                </p>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Active Learning Module
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-indigo-300">
                        {activeDrillModal.current_lesson || activeDrillModal.activeModule || "Invariant Analysis Drill"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Step {(activeDrillModal.completed_modules ?? 0) + 1} of {activeDrillModal.total_modules ?? 5} • Socratic Invariant Testing
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setActiveDrillModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setActiveDrillModal(null);
                      router.push("/analyze-code");
                    }}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Launch Interactive Drill
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
