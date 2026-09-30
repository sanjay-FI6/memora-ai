"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  getBezierPath,
  EdgeProps
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  Sparkles,
  X,
  Play,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  Layers,
  History,
  TrendingUp,
  Award,
  Search,
  FileCode,
  ArrowRight,
  Code2,
  Check,
  Zap,
  BookOpen
} from "lucide-react";

// --- Proficiency Types ---
export type ProficiencyState = "proficient" | "weakness" | "gap";

export interface NodeSubmissionOccurrence {
  submissionId: string;
  file: string;
  language: string;
  timestamp: string;
  snippet: string;
  line: number;
  attempts: number;
  errorDetail: string;
}

export interface ConceptNodeData extends Record<string, unknown> {
  label: string;
  category: string;
  shape?: "circle" | "pill";
  status?: ProficiencyState;
  proficiency?: ProficiencyState;
  progress?: number;
  description?: string;
  linkedSubmissions?: NodeSubmissionOccurrence[];
  recommendedLesson?: {
    title: string;
    duration: string;
    difficulty: string;
    focus: string;
  };
}

export interface AnalysisGraphData {
  errorType: string;
  patternCluster: string;
  conceptGaps: string[];
}

export interface ConceptGraphProps {
  nodes?: Node<ConceptNodeData>[];
  edges?: Edge[];
  dynamicNodes?: Node<ConceptNodeData>[];
  dynamicEdges?: Edge[];
  onSelectLesson?: (lessonTitle: string) => void;
  onInspectDefect?: (defectName: string) => void;
  analysis?: AnalysisGraphData;
  height?: string;
  timeTravelDay?: number;
  onTimeTravelChange?: (day: number) => void;
  externalSearchQuery?: string;
  onSearchChange?: (query: string) => void;
  conceptFilter?: string;
}

// --- Dynamic Layout Calculation Function ---
export function calculateDynamicLayout(
  inputNodes: Node<ConceptNodeData>[],
  inputEdges: Edge[]
): Node<ConceptNodeData>[] {
  if (!inputNodes || inputNodes.length === 0) return [];

  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  inputNodes.forEach((n) => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  inputEdges.forEach((e) => {
    if (inDegree[e.target] !== undefined) {
      inDegree[e.target]++;
    }
    if (adj[e.source]) {
      adj[e.source].push(e.target);
    }
  });

  const levels: Record<string, number> = {};
  const roots = inputNodes.filter((n) => !inDegree[n.id] || inDegree[n.id] === 0);
  const queue = roots.length > 0 ? [...roots.map((r) => r.id)] : [inputNodes[0]?.id].filter(Boolean);

  queue.forEach((id) => {
    levels[id] = 0;
  });

  const visited = new Set<string>(queue);
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const currLevel = levels[curr] || 0;
    (adj[curr] || []).forEach((next) => {
      levels[next] = Math.max(levels[next] || 0, currLevel + 1);
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    });
  }

  // Assign fallback levels for any disconnected nodes
  inputNodes.forEach((n) => {
    if (levels[n.id] === undefined) {
      levels[n.id] = 1;
    }
  });

  // Group nodes by computed level
  const levelGroups: Record<number, string[]> = {};
  Object.entries(levels).forEach(([id, lvl]) => {
    if (!levelGroups[lvl]) levelGroups[lvl] = [];
    levelGroups[lvl].push(id);
  });

  const levelXMap: Record<number, number> = {
    0: 30,
    1: 260,
    2: 560,
    3: 860,
  };

  return inputNodes.map((node) => {
    const lvl = levels[node.id] ?? 0;
    const group = levelGroups[lvl] || [node.id];
    const indexInGroup = group.indexOf(node.id);
    const totalInGroup = group.length;

    let y = 150;
    if (totalInGroup === 1) {
      y = 150;
    } else if (totalInGroup === 2) {
      y = indexInGroup === 0 ? 40 : 260;
    } else {
      const spacing = 110;
      y = 40 + indexInGroup * spacing;
    }

    const x = node.position?.x !== undefined && node.position.x > 0
      ? node.position.x
      : (levelXMap[lvl] || 30 + lvl * 280);

    const finalY = node.position?.y !== undefined && node.position.y > 0
      ? node.position.y
      : y;

    const currentStatus = (node.data.status || node.data.proficiency || "proficient") as ProficiencyState;
    const defaultProgress = currentStatus === "gap" ? 18 : currentStatus === "weakness" ? 52 : 95;

    return {
      ...node,
      type: "glowingConcept",
      position: { x, y: finalY },
      data: {
        ...node.data,
        status: currentStatus,
        proficiency: currentStatus,
        shape: node.data.shape || (lvl === 0 ? "circle" : "pill"),
        progress: node.data.progress ?? defaultProgress,
        description: node.data.description || `${node.data.label} concept domain analysis.`,
        recommendedLesson: node.data.recommendedLesson || {
          title: `${node.data.label} Remediation Module`,
          duration: "15 mins",
          difficulty: currentStatus === "gap" ? "Priority Fix" : currentStatus === "weakness" ? "Intermediate" : "Mastery",
          focus: "Core invariants and safety contracts."
        }
      }
    };
  });
}

// --- Custom Animated Flowing Edge ---
export const AnimatedDataFlowEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const targetProficiency = (data?.targetProficiency || data?.status) as ProficiencyState | undefined;
  const isGapTarget = targetProficiency === "gap" || data?.isGapTarget;
  const isWeaknessTarget = targetProficiency === "weakness";

  const strokeColor = isGapTarget 
    ? "#EF4444" 
    : isWeaknessTarget 
    ? "#F59E0B" 
    : (style?.stroke as string) || "#10B981";

  return (
    <>
      {/* Background glow path */}
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isGapTarget ? 6 : isWeaknessTarget ? 5 : 4}
        strokeOpacity={isGapTarget ? 0.35 : 0.15}
        className={isGapTarget ? "animate-pulse" : ""}
      />
      {/* Primary line with flowing directional dash animation */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isGapTarget ? 3 : 2}
        strokeDasharray={isGapTarget ? "6, 4" : "4, 4"}
        className="animate-[dash_1.5s_linear_infinite]"
        markerEnd={markerEnd}
        style={{
          strokeDashoffset: 20,
          ...style,
          stroke: strokeColor
        }}
      />
    </>
  );
};

// --- Custom Glowing Node Component ---
export const CustomGlowingConceptNode = ({ data, selected }: { data: ConceptNodeData; selected?: boolean }) => {
  const currentStatus = (data.status || data.proficiency || "proficient") as ProficiencyState;
  const isProficient = currentStatus === "proficient";
  const isWeakness = currentStatus === "weakness";
  const isGap = currentStatus === "gap";
  const isCircle = data.shape === "circle";
  const currentProgress = data.progress !== undefined ? data.progress : (isProficient ? 95 : isWeakness ? 52 : 18);

  const theme = useMemo(() => {
    if (isProficient) {
      return {
        glow: "rgba(16, 185, 129, 0.45)",
        border: "border-emerald-500",
        svgStroke: "#10B981",
        bg: "bg-emerald-950/40",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        text: "text-emerald-300",
        bar: "bg-emerald-500",
        badgeIcon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
        badgeText: "Proficient"
      };
    }
    if (isWeakness) {
      return {
        glow: "rgba(245, 158, 11, 0.45)",
        border: "border-amber-500",
        svgStroke: "#F59E0B",
        bg: "bg-amber-950/40",
        badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        text: "text-amber-300",
        bar: "bg-amber-500",
        badgeIcon: <AlertTriangle className="w-3 h-3 text-amber-400" />,
        badgeText: "Weakness"
      };
    }
    return {
      glow: "rgba(239, 68, 68, 0.65)",
      border: "border-rose-500",
      svgStroke: "#EF4444",
      bg: "bg-rose-950/50",
      badgeBg: "bg-rose-500/30 text-rose-200 border-rose-500/60",
      text: "text-rose-300",
      bar: "bg-rose-500",
      badgeIcon: <Flame className="w-3 h-3 text-rose-400 animate-bounce" />,
      badgeText: "Detected Gap"
    };
  }, [isProficient, isWeakness, isGap]);

  return (
    <div className="relative group cursor-pointer select-none">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-900 transition-transform group-hover:scale-125"
      />

      {isGap && (
        <span className="absolute -inset-2 rounded-3xl bg-rose-500/30 animate-ping duration-1000 -z-10 pointer-events-none" />
      )}

      <div
        className={`relative backdrop-blur-xl border transition-all duration-300 ${
          isCircle ? "w-28 h-28 rounded-full flex flex-col items-center justify-center p-2 text-center" : "w-56 rounded-2xl p-3.5"
        } ${theme.bg} ${theme.border} ${
          selected ? "ring-2 ring-indigo-400 scale-105 shadow-[0_0_35px_rgba(99,102,241,0.6)]" : "hover:scale-105"
        }`}
        style={{
          boxShadow: `0 0 25px ${theme.glow}, inset 0 0 15px ${theme.glow}`
        }}
      >
        {isCircle ? (
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="p-1.5 rounded-full bg-slate-900/60 border border-slate-700">
              {theme.badgeIcon}
            </div>
            <span className="text-[11px] font-black text-white leading-tight px-1 line-clamp-2">
              {data.label}
            </span>
            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${theme.badgeBg}`}>
              {Math.round(currentProgress)}%
            </span>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-slate-400 opacity-80">
                {data.category}
              </span>
              <span className={`flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${theme.badgeBg}`}>
                {theme.badgeIcon}
                <span>{theme.badgeText}</span>
              </span>
            </div>

            <div className="text-xs font-black text-white tracking-wide mb-2">
              {data.label}
            </div>

            <div className="w-full bg-slate-950/80 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
              <div
                className={`h-full rounded-full transition-all duration-300 ${theme.bar}`}
                style={{ width: `${Math.min(100, Math.max(0, Math.round(currentProgress)))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-900 transition-transform group-hover:scale-125"
      />
    </div>
  );
};

const nodeTypes = {
  glowingConcept: CustomGlowingConceptNode,
};

const edgeTypes = {
  dataFlow: AnimatedDataFlowEdge,
};

// --- Historical Timeline Trajectories ---
export const nodeTimelineMilestones: Record<string, Array<{ day: number; progress: number; proficiency: ProficiencyState }>> = {
  "data-structures": [
    { day: 1, progress: 40, proficiency: "weakness" },
    { day: 8, progress: 65, proficiency: "weakness" },
    { day: 16, progress: 85, proficiency: "proficient" },
    { day: 30, progress: 98, proficiency: "proficient" },
  ],
  "arrays": [
    { day: 1, progress: 35, proficiency: "gap" },
    { day: 7, progress: 60, proficiency: "weakness" },
    { day: 18, progress: 82, proficiency: "proficient" },
    { day: 30, progress: 94, proficiency: "proficient" },
  ],
  "linked-lists": [
    { day: 1, progress: 15, proficiency: "gap" },
    { day: 10, progress: 38, proficiency: "gap" },
    { day: 18, progress: 58, proficiency: "weakness" },
    { day: 26, progress: 76, proficiency: "proficient" },
    { day: 30, progress: 90, proficiency: "proficient" },
  ],
  "trees": [
    { day: 1, progress: 10, proficiency: "gap" },
    { day: 12, progress: 35, proficiency: "gap" },
    { day: 20, progress: 58, proficiency: "weakness" },
    { day: 28, progress: 78, proficiency: "proficient" },
    { day: 30, progress: 86, proficiency: "proficient" },
  ],
  "null-deref": [
    { day: 1, progress: 5, proficiency: "gap" },
    { day: 9, progress: 22, proficiency: "gap" },
    { day: 17, progress: 52, proficiency: "weakness" },
    { day: 25, progress: 78, proficiency: "proficient" },
    { day: 30, progress: 95, proficiency: "proficient" },
  ],
  "name-error": [
    { day: 1, progress: 10, proficiency: "gap" },
    { day: 11, progress: 28, proficiency: "gap" },
    { day: 19, progress: 55, proficiency: "weakness" },
    { day: 27, progress: 80, proficiency: "proficient" },
    { day: 30, progress: 92, proficiency: "proficient" },
  ]
};

export function computeNodeStateAtDay(
  nodeId: string,
  day: number
): { progress: number; proficiency: ProficiencyState } {
  const trajectory = nodeTimelineMilestones[nodeId] || nodeTimelineMilestones["null-deref"];
  if (day <= trajectory[0].day) {
    return { progress: trajectory[0].progress, proficiency: trajectory[0].proficiency };
  }
  const lastKeyframe = trajectory[trajectory.length - 1];
  if (day >= lastKeyframe.day) {
    return { progress: lastKeyframe.progress, proficiency: lastKeyframe.proficiency };
  }

  for (let i = 0; i < trajectory.length - 1; i++) {
    const start = trajectory[i];
    const end = trajectory[i + 1];
    if (day >= start.day && day <= end.day) {
      const ratio = (day - start.day) / (end.day - start.day);
      const interpolatedProgress = Math.round(start.progress + ratio * (end.progress - start.progress));
      
      let proficiency: ProficiencyState = "gap";
      if (interpolatedProgress >= 70) {
        proficiency = "proficient";
      } else if (interpolatedProgress >= 40) {
        proficiency = "weakness";
      } else {
        proficiency = "gap";
      }

      return { progress: interpolatedProgress, proficiency };
    }
  }

  return { progress: lastKeyframe.progress, proficiency: lastKeyframe.proficiency };
}

// --- Initial Concept Graph Topology with Linked Submissions ---
const initialNodesData: Node<ConceptNodeData>[] = [
  {
    id: "data-structures",
    type: "glowingConcept",
    position: { x: 30, y: 150 },
    data: {
      label: "Data Structures",
      category: "Foundation Hub",
      shape: "circle",
      proficiency: "proficient",
      progress: 98,
      description: "Foundational memory layouts, abstract data types, asymptotic space & time bounds.",
      linkedSubmissions: [
        {
          submissionId: "sub-101",
          file: "early_traversal.c",
          language: "C",
          timestamp: "Day 2",
          snippet: "typedef struct Node { int val; struct Node* left; } Node;",
          line: 4,
          attempts: 2,
          errorDetail: "Fundamental struct node allocation and reference verification."
        }
      ],
      recommendedLesson: {
        title: "ADT Invariants & Continuous Space Efficiency",
        duration: "10 mins",
        difficulty: "Introductory",
        focus: "Time vs Space tradeoffs in runtime memory.",
      },
    },
  },
  {
    id: "arrays",
    type: "glowingConcept",
    position: { x: 240, y: 40 },
    data: {
      label: "Arrays & Contiguous Memory",
      category: "Foundation",
      shape: "pill",
      proficiency: "proficient",
      progress: 94,
      description: "Cache line locality, indexing arithmetic, boundary contracts, and vector contiguous storage.",
      linkedSubmissions: [
        {
          submissionId: "sub-105",
          file: "matrix_multiplication.java",
          language: "Java",
          timestamp: "Day 24",
          snippet: "matrix[row][col + 1] = computeVal();",
          line: 31,
          attempts: 1,
          errorDetail: "IndexOutOfBoundsException: offset exceeds matrix column allocation."
        },
        {
          submissionId: "sub-102",
          file: "array_allocator.c",
          language: "C",
          timestamp: "Day 6",
          snippet: "buffer[index] = raw_input;",
          line: 14,
          attempts: 3,
          errorDetail: "Unchecked upper bound index write causing stack buffer corruption."
        }
      ],
      recommendedLesson: {
        title: "Boundary Verification & Array Contracts",
        duration: "15 mins",
        difficulty: "Intermediate",
        focus: "Precondition assertions and boundary limit verification.",
      },
    },
  },
  {
    id: "linked-lists",
    type: "glowingConcept",
    position: { x: 240, y: 260 },
    data: {
      label: "Linked Lists & Pointers",
      category: "Core Structure",
      shape: "pill",
      proficiency: "proficient",
      progress: 90,
      description: "Dynamic heap nodes, pointer chasing, memory chaining, and traversal lifecycle.",
      linkedSubmissions: [
        {
          submissionId: "sub-103",
          file: "linked_list_chase.c",
          language: "C",
          timestamp: "Day 12",
          snippet: "curr = curr->next; // without null guard",
          line: 19,
          attempts: 2,
          errorDetail: "Orphan pointer dereferencing when traversing past tail sentinel."
        }
      ],
      recommendedLesson: {
        title: "Defensive Pointer Linking & Sentinel Nodes",
        duration: "20 mins",
        difficulty: "Intermediate",
        focus: "Preventing orphan pointers during node deletion.",
      },
    },
  },
  {
    id: "trees",
    type: "glowingConcept",
    position: { x: 540, y: 40 },
    data: {
      label: "Trees & Recursive Graphs",
      category: "Core Structure",
      shape: "pill",
      proficiency: "proficient",
      progress: 86,
      description: "Hierarchical trees, recursive traversals, and leaf-null boundary termination guarantees.",
      linkedSubmissions: [
        {
          submissionId: "sub-106",
          file: "tree_traversal.c",
          language: "C",
          timestamp: "Day 29",
          snippet: "printTreeInOrder(root->left);",
          line: 15,
          attempts: 3,
          errorDetail: "Recursive descent without null base termination check."
        }
      ],
      recommendedLesson: {
        title: "Recursive Tree Base Case Guarantees",
        duration: "25 mins",
        difficulty: "Advanced",
        focus: "Handling null children safely in recursive traversal.",
      },
    },
  },
  {
    id: "null-deref",
    type: "glowingConcept",
    position: { x: 540, y: 260 },
    data: {
      label: "Null Pointer Dereference",
      category: "Memory Safety",
      shape: "pill",
      proficiency: "proficient",
      progress: 95,
      description: "Critical vulnerability caused by reading address 0x0 before validating base pointer invariants.",
      linkedSubmissions: [
        {
          submissionId: "sub-106",
          file: "tree_traversal.c",
          language: "C",
          timestamp: "Day 29",
          snippet: "printf(\"Node value: %d\\n\", root->val);",
          line: 12,
          attempts: 3,
          errorDetail: "Dereferencing node pointer without base null-check."
        },
        {
          submissionId: "sub-101",
          file: "early_traversal.c",
          language: "C",
          timestamp: "Day 2",
          snippet: "root->val = 42;",
          line: 11,
          attempts: 4,
          errorDetail: "SIGSEGV Crash: Reading offset 0 from NULL pointer."
        }
      ],
      recommendedLesson: {
        title: "Null Safety Guardrails & Defensive Contracts",
        duration: "15 mins",
        difficulty: "Priority Fix",
        focus: "Early exit checks and memory safety invariants.",
      },
    },
  },
  {
    id: "name-error",
    type: "glowingConcept",
    position: { x: 800, y: 150 },
    data: {
      label: "NameError & Scope",
      category: "Variable Scope",
      shape: "pill",
      proficiency: "gap",
      progress: 25,
      description: "Referencing variables or functions before definition or across out-of-scope lexicals.",
      linkedSubmissions: [
        {
          submissionId: "sub-104",
          file: "user_repository.py",
          language: "Python",
          timestamp: "Day 18",
          snippet: "db_conn = open_database(); conn.query(sql)",
          line: 14,
          attempts: 2,
          errorDetail: "NameError: 'conn' is referenced outside valid handle assignment."
        }
      ],
      recommendedLesson: {
        title: "Scope & Lexical Lifetime Resolution",
        duration: "15 mins",
        difficulty: "Fundamental",
        focus: "Variable declaration scopes and function closure lifetime.",
      },
    },
  }
];

const initialEdgesData: Edge[] = [
  {
    id: "e-ds-arrays",
    source: "data-structures",
    target: "arrays",
    type: "dataFlow",
    style: { stroke: "#10B981", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#10B981" },
    data: { targetProficiency: "proficient" }
  },
  {
    id: "e-ds-lists",
    source: "data-structures",
    target: "linked-lists",
    type: "dataFlow",
    style: { stroke: "#10B981", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#10B981" },
    data: { targetProficiency: "proficient" }
  },
  {
    id: "e-lists-trees",
    source: "linked-lists",
    target: "trees",
    type: "dataFlow",
    style: { stroke: "#10B981", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#10B981" },
    data: { targetProficiency: "proficient" }
  },
  {
    id: "e-lists-nullderef",
    source: "linked-lists",
    target: "null-deref",
    type: "dataFlow",
    style: { stroke: "#10B981", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#10B981" },
    data: { targetProficiency: "proficient" }
  },
  {
    id: "e-trees-nullderef",
    source: "trees",
    target: "null-deref",
    type: "dataFlow",
    style: { stroke: "#10B981", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#10B981" },
    data: { targetProficiency: "proficient" }
  },
  {
    id: "e-trees-nameerror",
    source: "trees",
    target: "name-error",
    type: "dataFlow",
    style: { stroke: "#EF4444", strokeWidth: 3 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#EF4444" },
    data: { targetProficiency: "gap", isGapTarget: true }
  }
];

// --- Internal Flow Renderer with Canvas Controls, Search Pan/Zoom & Side Drawer ---
function ConceptGraphInternal({
  nodes: propNodes,
  edges: propEdges,
  dynamicNodes,
  dynamicEdges,
  onSelectLesson,
  onInspectDefect,
  analysis,
  height = "520px",
  timeTravelDay: propTimeTravelDay,
  onTimeTravelChange: propOnTimeTravelChange,
  externalSearchQuery = "",
  onSearchChange,
  conceptFilter = "all"
}: ConceptGraphProps) {
  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();
  const [internalTimeTravelDay, setInternalTimeTravelDay] = useState(30);
  const [nodes, setNodes] = useState<Node<ConceptNodeData>[]>(initialNodesData);
  const [edges, setEdges] = useState<Edge[]>(initialEdgesData);
  const [selectedNode, setSelectedNode] = useState<ConceptNodeData | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  const activeDay = propTimeTravelDay !== undefined ? propTimeTravelDay : internalTimeTravelDay;
  const currentSearch = externalSearchQuery || localSearchQuery;

  // Synchronize dynamic nodes and edges when provided as props
  useEffect(() => {
    const rawNodes = dynamicNodes || propNodes;
    const rawEdges = dynamicEdges || propEdges;

    if (rawNodes && rawNodes.length > 0) {
      const incomingEdges = rawEdges || [];
      const computedNodes = calculateDynamicLayout(rawNodes, incomingEdges);

      // Build target node status lookup
      const nodeStatusMap: Record<string, ProficiencyState> = {};
      computedNodes.forEach((n) => {
        nodeStatusMap[n.id] = (n.data.status || n.data.proficiency || "proficient") as ProficiencyState;
      });

      const computedEdges: Edge[] = incomingEdges.map((edge) => {
        const targetStatus = nodeStatusMap[edge.target] || (edge.data?.targetProficiency as ProficiencyState) || "proficient";
        const isGap = targetStatus === "gap" || Boolean(edge.data?.isGapTarget) || Boolean(edge.animated);
        const isWeakness = targetStatus === "weakness";
        const strokeColor = isGap ? "#EF4444" : isWeakness ? "#F59E0B" : "#10B981";

        return {
          ...edge,
          type: edge.type || "dataFlow",
          animated: isGap || Boolean(edge.animated),
          style: {
            stroke: strokeColor,
            strokeWidth: isGap ? 3 : 2,
            ...edge.style,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
          },
          data: {
            ...edge.data,
            targetProficiency: targetStatus,
            isGapTarget: isGap,
          }
        };
      });

      setNodes(computedNodes);
      setEdges(computedEdges);

      setTimeout(() => {
        fitView({ padding: 0.2, duration: 500 });
      }, 50);
    }
  }, [dynamicNodes, propNodes, dynamicEdges, propEdges, fitView]);

  // Apply continuous visual state scrubbing to nodes and edges when activeDay changes
  const applyTimeTravelScrub = useCallback((day: number) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        const computed = computeNodeStateAtDay(node.id, day);
        return {
          ...node,
          data: {
            ...node.data,
            proficiency: computed.proficiency,
            status: computed.proficiency,
            progress: computed.progress,
          },
        };
      })
    );

    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        const targetComputed = computeNodeStateAtDay(edge.target, day);
        const isGap = targetComputed.proficiency === "gap";
        const isWeakness = targetComputed.proficiency === "weakness";
        const strokeColor = isGap ? "#EF4444" : isWeakness ? "#F59E0B" : "#10B981";

        return {
          ...edge,
          animated: isGap,
          style: {
            ...edge.style,
            stroke: strokeColor,
            strokeWidth: isGap ? 3 : 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
          },
          data: {
            ...edge.data,
            targetProficiency: targetComputed.proficiency,
            isGapTarget: isGap,
          },
        };
      })
    );
  }, []);

  useEffect(() => {
    // Only scrub if static/initial nodes or when activeDay changes
    if (!dynamicNodes && !propNodes) {
      applyTimeTravelScrub(activeDay);
    }
  }, [activeDay, dynamicNodes, propNodes, applyTimeTravelScrub]);

  // Synchronize fallback analysis result with the graph if explicit nodes aren't provided
  useEffect(() => {
    if (!analysis || dynamicNodes || propNodes) return;
    const hasError = analysis.errorType !== "No error is found" && analysis.errorType !== "Clean Code Check";
    
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.id === "null-deref") {
          if (hasError) {
            return {
              ...node,
              data: {
                ...node.data,
                label: analysis.errorType,
                category: analysis.patternCluster,
                status: "gap",
                proficiency: "gap",
                progress: 20,
                description: `Active defect identified: ${analysis.patternCluster}.`,
                recommendedLesson: {
                  title: `${analysis.errorType} Remediation Module`,
                  duration: "15 mins",
                  difficulty: "Priority Fix",
                  focus: analysis.conceptGaps.join(", ") || "Safety invariants"
                }
              }
            };
          } else {
            return {
              ...node,
              data: {
                ...node.data,
                label: "Memory & Bounds Safety",
                category: "Verified Clean",
                status: "proficient",
                proficiency: "proficient",
                progress: 98,
                description: "Clean code verified! All loop boundaries, indexing, and arithmetic are validated.",
                recommendedLesson: {
                  title: "Advanced Algorithm Optimization",
                  duration: "10 mins",
                  difficulty: "Mastery",
                  focus: "Time vs Space complexity"
                }
              }
            };
          }
        }
        return node;
      })
    );
  }, [analysis, dynamicNodes, propNodes]);

  // Auto-pan & zoom when typing into concept search bar
  const performSearch = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return;

      const matched = nodes.find((n) => {
        const label = n.data.label.toLowerCase();
        const cat = n.data.category.toLowerCase();
        const desc = (n.data.description || "").toLowerCase();
        const id = n.id.toLowerCase();
        return label.includes(q) || cat.includes(q) || desc.includes(q) || id.includes(q);
      });

      if (matched) {
        const centerX = matched.position.x + (matched.data.shape === "circle" ? 56 : 112);
        const centerY = matched.position.y + 50;
        setCenter(centerX, centerY, { zoom: 1.35, duration: 800 });
        setSelectedNode(matched.data);
      }
    },
    [nodes, setCenter]
  );

  useEffect(() => {
    if (currentSearch) {
      performSearch(currentSearch);
    }
  }, [currentSearch, performSearch]);

  const handleSliderChange = (newDay: number) => {
    if (propOnTimeTravelChange) {
      propOnTimeTravelChange(newDay);
    } else {
      setInternalTimeTravelDay(newDay);
    }
  };

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data as unknown as ConceptNodeData);
  };

  // Node proficiency summary counts
  const summaryCounts = useMemo(() => {
    let gaps = 0;
    let weaknesses = 0;
    let proficient = 0;

    nodes.forEach((n) => {
      const st = n.data.status || n.data.proficiency || "proficient";
      if (st === "gap") gaps++;
      else if (st === "weakness") weaknesses++;
      else proficient++;
    });

    return { gaps, weaknesses, proficient };
  }, [nodes]);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-slate-800/80 bg-gradient-to-br from-[#060913] via-[#0B1120] to-[#04060B] shadow-2xl flex flex-col"
      style={{ height }}
    >
      {/* 3D Grid & Particle Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

      {/* Top Search Bar (Integrated if external not provided) */}
      {!externalSearchQuery && onSearchChange === undefined && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => {
                setLocalSearchQuery(e.target.value);
                performSearch(e.target.value);
              }}
              placeholder="Search concepts (e.g. pointers, nameerror)..."
              className="bg-slate-900/85 backdrop-blur-xl border border-slate-700/60 rounded-xl pl-9 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64 shadow-xl transition-all"
            />
            {localSearchQuery && (
              <button
                onClick={() => setLocalSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* React Flow Core Graph Canvas */}
      <div className="relative flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          zoomOnScroll={true}
          panOnDrag={true}
          nodesDraggable={true}
          className="relative z-10"
        >
          <Background color="#1E293B" gap={20} size={1} />
        </ReactFlow>
      </div>

      {/* Floating Glassmorphic Top-Right Control Toolbar */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 shadow-xl">
        <button
          onClick={() => zoomIn({ duration: 300 })}
          title="Zoom In"
          className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoomOut({ duration: 300 })}
          title="Zoom Out"
          className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => fitView({ duration: 400, padding: 0.2 })}
          title="Fit View"
          className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-slate-700/80 mx-0.5" />

        <button
          onClick={() => setShowLegend(!showLegend)}
          title="Toggle Legend"
          className={`px-2.5 h-8 rounded-xl flex items-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer shadow-sm ${
            showLegend
              ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
              : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Legend</span>
        </button>
      </div>

      {/* Floating Glassmorphic Top-Left Legend Panel */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-14 left-3 z-30 p-2.5 rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-slate-700/60 shadow-xl flex flex-col gap-1.5"
          >
            <div className="text-[9px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1 px-1">
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>Proficiency Matrix</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold px-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
                Proficient (#10B981)
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_#F59E0B]" />
                Weakness (#F59E0B)
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_#EF4444]" />
                Detected Gap (#EF4444)
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dedicated Time-Travel (30-Day History) Footer Slider */}
      <div className="relative z-20 min-h-[96px] border-t border-slate-700/80 bg-slate-900/95 px-5 py-3 shadow-2xl flex flex-col gap-2 backdrop-blur-xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-black text-indigo-300">
            <History className="w-4 h-4 text-indigo-400 animate-spin-slow" />
            <span>Time-Travel (30-Day History)</span>
            <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              30-Day Limit
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold">
              {summaryCounts.gaps > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  {summaryCounts.gaps} Gap{summaryCounts.gaps > 1 ? "s" : ""}
                </span>
              )}
              {summaryCounts.weaknesses > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {summaryCounts.weaknesses} Weakness{summaryCounts.weaknesses > 1 ? "es" : ""}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {summaryCounts.proficient} Proficient
              </span>
            </div>

            <span className="text-[11px] font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm">
              Day {activeDay} of 30
            </span>
          </div>
        </div>

        {/* Range Slider Track */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Day 1</span>
          <div className="relative flex-1 flex items-center">
            <input
              id="time-travel-slider"
              type="range"
              min={1}
              max={30}
              value={activeDay}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
            />
          </div>
          <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">Day 30 (Today)</span>
        </div>
      </div>

      {/* --- Interactive Slide-In Side-Drawer for Selected Node --- */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 340 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 340 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-0 right-0 bottom-0 z-40 w-[380px] max-w-full bg-slate-900/95 border-l border-slate-700/80 backdrop-blur-2xl p-5 shadow-2xl flex flex-col justify-between overflow-y-auto"
          >
            <div className="space-y-4">
              {/* Drawer Top Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-indigo-400">
                    {selectedNode.category}
                  </span>
                  <h3 className="text-base font-extrabold text-white mt-0.5">
                    {selectedNode.label}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Badge & Mastery Bar */}
              {(() => {
                const nodeProficiency = (selectedNode.status || selectedNode.proficiency || "proficient") as ProficiencyState;
                const nodeProgress = selectedNode.progress ?? (nodeProficiency === "proficient" ? 95 : nodeProficiency === "weakness" ? 50 : 20);

                return (
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Concept Proficiency:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${
                        nodeProficiency === "proficient"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : nodeProficiency === "weakness"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      }`}>
                        {nodeProficiency.toUpperCase()} ({Math.round(nodeProgress)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          nodeProficiency === "proficient"
                            ? "bg-emerald-500"
                            : nodeProficiency === "weakness"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.round(nodeProgress)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedNode.description || `${selectedNode.label} foundational analysis.`}
              </p>

              {/* Exact Code Submissions Occurrence Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Associated Code Submissions:</span>
                </div>

                {selectedNode.linkedSubmissions && selectedNode.linkedSubmissions.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedNode.linkedSubmissions.map((sub, idx) => (
                      <div
                        key={idx}
                        className="bg-[#090e18] p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            {sub.file}
                          </span>
                          <span className="text-slate-500">{sub.timestamp} • {sub.attempts} attempts</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 font-mono text-[10px] text-rose-300 border border-rose-500/20 overflow-x-auto whitespace-pre">
                          <span className="text-slate-600 select-none mr-2">L{sub.line}:</span>
                          {sub.snippet}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          {sub.errorDetail}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400">
                    No active runtime defect logged for this node.
                  </div>
                )}
              </div>
            </div>

            {/* Direct Action Buttons Footer */}
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-2 mt-4">
              <button
                id="btn-start-remediation"
                onClick={() => {
                  if (onSelectLesson) onSelectLesson(selectedNode.recommendedLesson?.title || selectedNode.label);
                  setSelectedNode(null);
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/25 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Remediation Module
              </button>

              <button
                id="btn-inspect-socratic"
                onClick={() => {
                  if (onInspectDefect) onInspectDefect(selectedNode.label);
                  else if (onSelectLesson) onSelectLesson("Analyze Code");
                  setSelectedNode(null);
                }}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Inspect in Socratic Mode
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ConceptGraph(props: ConceptGraphProps) {
  return (
    <ReactFlowProvider>
      <ConceptGraphInternal {...props} />
    </ReactFlowProvider>
  );
}
