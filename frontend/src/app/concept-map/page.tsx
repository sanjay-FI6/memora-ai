"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Network, Search, Filter, Sparkles, Layers } from "lucide-react";
import ConceptGraph from "@/components/ConceptGraph";

export default function ConceptMapPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [conceptFilter, setConceptFilter] = useState("all");
  const [timeTravelDay, setTimeTravelDay] = useState(30);

  const handleSelectLesson = (lessonTitle: string) => {
    router.push("/dashboard");
  };

  const handleInspectDefect = (defectName: string) => {
    router.push("/analyze-code");
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col p-6 selection:bg-indigo-500/30">
      <div className="max-w-[1600px] w-full mx-auto space-y-5 flex-1 flex flex-col">
        
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Concept Knowledge Graph
                </h1>
                <p className="text-[10px] text-slate-400">
                  Click nodes to inspect code defects or use search to auto-pan and zoom.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Interactive Curriculum Mapping
          </div>
        </div>

        {/* Top Concept Search & Filters Bar */}
        <div className="bg-[#1E293B]/80 border border-slate-700/60 rounded-2xl p-3.5 flex items-center justify-between flex-wrap gap-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="concept-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search concepts (e.g. pointers, nameerror, arrays)..."
                className="bg-slate-900/80 border border-slate-700/50 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-72 shadow-inner"
              />
            </div>
          </div>

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

        {/* Full Height Interactive Graph Canvas */}
        <div className="flex-1 w-full min-h-[620px]">
          <ConceptGraph
            height="640px"
            timeTravelDay={timeTravelDay}
            onTimeTravelChange={setTimeTravelDay}
            externalSearchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            conceptFilter={conceptFilter}
            onSelectLesson={handleSelectLesson}
            onInspectDefect={handleInspectDefect}
          />
        </div>

      </div>
    </div>
  );
}
