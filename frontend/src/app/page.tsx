"use client";

import dynamic from "next/dynamic";

const DashboardLayout = dynamic(
  () => import("@/components/DashboardLayout"),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-[#0F172A] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-xs font-mono tracking-widest text-slate-300 uppercase">
            Loading Memora AI Workspace...
          </span>
        </div>
      </div>
    )
  }
);

export default function Home() {
  return <DashboardLayout />;
}
