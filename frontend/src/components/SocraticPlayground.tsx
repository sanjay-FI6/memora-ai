"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Terminal, 
  Play, 
  RotateCcw, 
  HelpCircle, 
  BookOpen, 
  Lightbulb, 
  Sparkles, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  ThumbsUp, 
  AlertTriangle, 
  Code2, 
  Cpu, 
  Copy
} from "lucide-react";

type Language = "c" | "python" | "java" | "javascript";

const sampleFailingCode: Record<Language, string> = {
  c: `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int val;
    struct Node* left;
    struct Node* right;
} Node;

// FAILING CODE: Tree traversal dereferencing unvalidated root pointer
void printTreeInOrder(Node* root) {
    // 💥 Bug: Potential NULL pointer dereference
    printf("Visiting Node: %d\\n", root->val);
    
    if (root->left != NULL) {
        printTreeInOrder(root->left);
    }
    if (root->right != NULL) {
        printTreeInOrder(root->right);
    }
}`,
  python: `def process_user(user):
    # 💥 Bug: Potential AttributeError if user or profile is None
    profile = user.profile
    print("User Name: " + profile.name)
    
    db_conn = open_database()
    # 💥 Bug: Unclosed connection handle
    db_conn.query("SELECT * FROM users")`,
  java: `public class TreePrinter {
    public static void printInOrder(Node root) {
        // 💥 Bug: NullPointerException on empty subtree branches
        System.out.println("Node value: " + root.val);
        if (root.left != null) {
            printInOrder(root.left);
        }
    }
}`,
  javascript: `function processPayment(account) {
    // 💥 Bug: TypeError: Cannot read properties of undefined
    const balance = account.wallet.balance;
    if (balance < 10) {
        throw new Error("Insufficient funds");
    }
}`
};

export default function SocraticPlayground() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("c");
  const [userCode, setUserCode] = useState(sampleFailingCode.c);
  const [guidanceExpanded, setGuidanceExpanded] = useState(true);
  const [activeHintLevel, setActiveHintLevel] = useState<1 | 2 | 3>(1);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [votedFeedback, setVotedFeedback] = useState<"yes" | "no" | null>(null);

  const handleLanguageChange = (lang: Language) => {
    setSelectedLanguage(lang);
    setUserCode(sampleFailingCode[lang]);
    setExecutionOutput(null);
    setVotedFeedback(null);
  };

  const handleRunCode = () => {
    setIsRunning(true);
    setExecutionOutput(null);
    setTimeout(() => {
      setIsRunning(false);
      if (userCode.includes("root == NULL") || userCode.includes("user is None") || userCode.includes("!account")) {
        setExecutionOutput("✅ Program executed cleanly with 0 memory faults (Exit code: 0).");
      } else {
        setExecutionOutput("💥 Memory Fault / Exception Triggered:\nSegmentation fault (core dumped): Invalid memory access at address 0x00000000.");
      }
    }, 800);
  };

  const handleResetCode = () => {
    setUserCode(sampleFailingCode[selectedLanguage]);
    setExecutionOutput(null);
    setVotedFeedback(null);
  };

  return (
    <div className="w-full bg-[#1E293B]/70 border border-slate-700/50 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden flex flex-col gap-6 p-6 max-w-[1400px] mx-auto text-slate-200">
      
      {/* Top Header Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-700/50 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            Interactive Socratic Code Workspace
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Test your failing code, inspect runtime memory errors, and unlock progressive hints without spoiling the answer.
          </p>
        </div>

        {/* Language Selector Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-900/80 border border-slate-700/60 p-1 rounded-xl">
            {(["c", "python", "java", "javascript"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                  selectedLanguage === lang
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lang === "javascript" ? "JS" : lang}
              </button>
            ))}
          </div>

          <button
            onClick={handleResetCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Workspace Split (Editor Left, Terminal & Socratic Drawer Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Code Editor Viewport (Span 7) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="glass-panel p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                failing_program.{selectedLanguage === "c" ? "c" : selectedLanguage === "python" ? "py" : selectedLanguage === "java" ? "java" : "js"}
              </span>
              <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">
                1 Defect Detected
              </span>
            </div>

            {/* Monaco-like Editor Viewport */}
            <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-[#070b12] shadow-2xl">
              <div className="flex text-xs py-3 min-h-[380px]">
                {/* Line Numbers */}
                <div className="flex flex-col text-right text-slate-600 font-mono px-3 select-none border-r border-slate-800/60 w-10">
                  {userCode.split("\n").map((_, i) => (
                    <span key={i} className="leading-6">{i + 1}</span>
                  ))}
                </div>
                {/* Editable Code */}
                <textarea
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  className="flex-1 bg-transparent px-3 text-emerald-300 font-mono leading-6 resize-none focus:outline-none h-[380px] overflow-y-auto"
                  spellCheck="false"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px] text-slate-500 font-mono">
                Press Run to simulate compiler execution and memory trace.
              </span>
              <button
                onClick={handleRunCode}
                disabled={isRunning}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Run & Test Code
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Execution Output Window */}
          {executionOutput && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border font-mono text-xs ${
                executionOutput.startsWith("✅")
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="font-bold uppercase tracking-wider text-[10px] opacity-70 mb-1">
                Execution Output Terminal
              </div>
              <pre className="whitespace-pre-wrap">{executionOutput}</pre>
            </motion.div>
          )}
        </div>

        {/* Right Column: Expandable Socratic Guidance Tab (Span 5) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          <div className="glass-panel p-5 flex flex-col">
            
            {/* Header / Accordion Toggle */}
            <div 
              onClick={() => setGuidanceExpanded(!guidanceExpanded)}
              className="flex items-center justify-between cursor-pointer select-none pb-3 border-b border-slate-700/50"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                  AI Socratic Guidance
                </h3>
              </div>
              <button className="text-slate-400 hover:text-white transition-colors">
                {guidanceExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <AnimatePresence>
              {guidanceExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-4"
                >
                  {/* Progressive Tabs: Level 1, Level 2, Level 3 */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
                    {[
                      { level: 1, label: "1. Nudge", icon: HelpCircle },
                      { level: 2, label: "2. Rule", icon: BookOpen },
                      { level: 3, label: "3. Fix", icon: Lightbulb }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeHintLevel === tab.level;

                      return (
                        <button
                          key={tab.level}
                          onClick={() => setActiveHintLevel(tab.level as 1 | 2 | 3)}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
                            isActive
                              ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Level Content */}
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800/80 min-h-[200px]">
                    {activeHintLevel === 1 && (
                      <motion.div
                        key="nudge"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2.5"
                      >
                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                          <HelpCircle className="w-4 h-4" />
                          Level 1: Gentle Socratic Nudge
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Consider the traversal when an empty subtree or a leaf node's child is reached. What value does the pointer hold, and what happens when the processor reads its memory address?
                        </p>
                        <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/40 text-[11px] text-slate-400 italic">
                          "Can you check if the pointer exists before accessing any of its member properties?"
                        </div>
                      </motion.div>
                    )}

                    {activeHintLevel === 2 && (
                      <motion.div
                        key="rule"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2.5"
                      >
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                          <BookOpen className="w-4 h-4" />
                          Level 2: Concept Rule & Boundary Map
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          <strong>Memory Invariant:</strong> Struct field offsets are calculated relative to the base address. If the base address is <code className="text-rose-400 font-mono">0x0</code>, accessing member fields throws a hardware trap.
                        </p>
                        {/* ASCII Diagram */}
                        <div className="bg-[#070b12] p-3 rounded-lg border border-slate-800 font-mono text-[9px] text-slate-300 leading-tight">
                          <div>[Base Pointer] --&gt; NULL (0x00000000)</div>
                          <div className="text-indigo-400">  │</div>
                          <div className="text-rose-400">  └──► Dereferencing root-&gt;val</div>
                          <div className="text-rose-300 mt-1 font-bold">💥 SIGSEGV: Invalid Memory Access</div>
                        </div>
                      </motion.div>
                    )}

                    {activeHintLevel === 3 && (
                      <motion.div
                        key="fix"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2.5"
                      >
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                          <Lightbulb className="w-4 h-4" />
                          Level 3: Correct Code Fix
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Add a base condition check at the top of your function to immediately return when the pointer is null:
                        </p>
                        <div className="bg-[#070b12] p-3 rounded-lg border border-emerald-500/30 font-mono text-[10px] text-emerald-300">
                          <span className="text-indigo-400">if</span> (root == <span className="text-slate-400">NULL</span>) &#123;<br/>
                          &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-indigo-400">return</span>;<br/>
                          &#125;
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Feedback Rating Widget */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] text-slate-400">
                      Did this progressive hint resolve your concept gap?
                    </span>
                    <div className="flex gap-2">
                      {votedFeedback === null ? (
                        <>
                          <button
                            onClick={() => setVotedFeedback("yes")}
                            className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-900/60 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3 text-emerald-400" />
                            Yes
                          </button>
                          <button
                            onClick={() => setVotedFeedback("no")}
                            className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-900/60 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3 h-3 text-rose-400" />
                            No
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {votedFeedback === "yes" ? "Feedback Saved!" : "We'll adjust difficulty."}
                        </span>
                      )}
                    </div>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>

      </div>

    </div>
  );
}
