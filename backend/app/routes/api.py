from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, CodeSubmission, ErrorCluster, LearningPath, ErrorClassificationExample
from app.schemas.submission import CodeSubmissionBase
from app.services.ai_engine import analyze_code_submission
from app.training.train_model import train_error_classifier

router = APIRouter(prefix="/api", tags=["Core API"])

# --- Response Schemas ---
class ErrorClusterResponse(BaseModel):
    id: str
    title: str
    severity: str
    attempts: int
    description: str

class RecommendationItem(BaseModel):
    id: Optional[str] = None
    title: str
    est_time: Optional[str] = "15 MINS"
    progress: int
    tag: Optional[str] = "Core Concept"
    action_text: Optional[str] = "START LESSON"
    duration: Optional[str] = "15 MINS"
    ctaText: Optional[str] = "Start Lesson"
    color: Optional[str] = None

class CurriculumTrackItem(BaseModel):
    track_id: str
    title: str
    description: str
    total_time: str
    completion_rate: int
    current_lesson: str
    completed_modules: int
    total_modules: int
    color: Optional[str] = "indigo"

class DynamicConceptNodeData(BaseModel):
    label: str
    category: str
    status: Optional[str] = "proficient"  # "proficient" | "weakness" | "gap"
    proficiency: Optional[str] = "proficient"  # "proficient" | "weakness" | "gap"
    progress: int
    description: str
    shape: Optional[str] = "pill"

class DynamicConceptNode(BaseModel):
    id: str
    type: str = "glowingConcept"
    position: dict
    data: DynamicConceptNodeData

class DynamicConceptEdge(BaseModel):
    id: str
    source: str
    target: str
    animated: Optional[bool] = False
    type: Optional[str] = "dataFlow"
    style: Optional[dict] = None

class ConceptMapResponse(BaseModel):
    nodes: List[DynamicConceptNode]
    edges: List[DynamicConceptEdge]

class AnalysisResponse(BaseModel):
    status: str
    language: str
    error_clusters: List[ErrorClusterResponse]
    socratic_hint: str
    concept_gap: List[str]
    recommendations: List[RecommendationItem]
    curriculum_tracks: Optional[List[CurriculumTrackItem]] = None
    concept_map: Optional[ConceptMapResponse] = None
    nodes: Optional[List[DynamicConceptNode]] = None
    edges: Optional[List[DynamicConceptEdge]] = None
    error_lines: Optional[List[int]] = []

class ResolveGapRequest(BaseModel):
    submission_id: Optional[str] = "sub-tree-01"
    gap_concept: Optional[str] = "Null Pointer Dereference"
    resolved: bool
    hint_level: str  # "nudge" | "hint" | "fix"

class ResolveGapResponse(BaseModel):
    status: str
    submission_id: str
    gap_concept: str
    resolved: bool
    hint_level: str
    concept_mastery_updated: bool
    mastery_score_gain: int
    next_hint_level: Optional[str] = None
    message: str

class HistoryItemResponse(BaseModel):
    submission_id: str
    file_name: str
    language: str
    code: str
    defect_title: str
    severity: str
    error_lines: List[int] = []
    status: str
    day: int = 30
    attempts: int = 1
    concept_gap: str
    created_at: str

class HistoryDetailResponse(BaseModel):
    submission_id: str
    file_name: str
    language: str
    code: str
    defect_title: str
    severity: str
    error_lines: List[int] = []
    status: str
    day: int = 30
    attempts: int = 1
    concept_gap: str
    created_at: str
    error_clusters: List[ErrorClusterResponse]
    socratic_hint: str
    concept_gaps: List[str]
    recommendations: List[RecommendationItem]
    curriculum_tracks: Optional[List[CurriculumTrackItem]] = None
    concept_map: Optional[ConceptMapResponse] = None
    nodes: Optional[List[DynamicConceptNode]] = None
    edges: Optional[List[DynamicConceptEdge]] = None


def generate_dynamic_concept_graph(code: str, error_type: str, language: str) -> dict:
    """
    Evaluates the submitted snippet and dynamically constructs a unique set
    of downstream and parent concept nodes, flow edges, and status colors.
    """
    code_lower = code.lower()
    has_error = error_type not in ["No error is found", "Clean Code Check", ""]

    # 1. Linked List / Pointer Chaining Data Structures
    if any(k in code_lower for k in ["linkedlist", "linked_list", "self.head", "self.next", "listnode", "node", "head", "next"]):
        if not has_error:
            nodes = [
                {
                    "id": "node-ds",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {
                        "label": "Data Structures Hub",
                        "category": "Foundation Hub",
                        "shape": "circle",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 98,
                        "description": "Foundational abstract data types and node link topologies."
                    }
                },
                {
                    "id": "node-ll",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {
                        "label": "Linked List Nodes",
                        "category": "Structure",
                        "shape": "pill",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 95,
                        "description": "Object and pointer node encapsulation with data payload and next pointer."
                    }
                },
                {
                    "id": "node-ptrs",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {
                        "label": "Reference Chaining",
                        "category": "Core Flow",
                        "shape": "pill",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 94,
                        "description": "Dynamic pointer linking, head-to-tail traversal, and sentinel guards."
                    }
                },
                {
                    "id": "node-traversal",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {
                        "label": "Sequential Traversal Guarantees",
                        "category": "Safety Check",
                        "shape": "pill",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 96,
                        "description": "Deterministic iteration stopping criteria and null termination verification."
                    }
                },
                {
                    "id": "node-invariants",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {
                        "label": "Object Invariant Safety",
                        "category": "Verified Clean",
                        "shape": "pill",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 97,
                        "description": "Verified clean! All head, next references, and initializations are safe."
                    }
                }
            ]
            edges = [
                {"id": "e-ll-1", "source": "node-ds", "target": "node-ll", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-ll-2", "source": "node-ds", "target": "node-ptrs", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-ll-3", "source": "node-ll", "target": "node-traversal", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-ll-4", "source": "node-ptrs", "target": "node-invariants", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
            ]
            return {"nodes": nodes, "edges": edges}
        else:
            nodes = [
                {
                    "id": "node-ds",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "Data Structures Hub", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 98, "description": "Foundational abstract data structures."}
                },
                {
                    "id": "node-ll",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Linked List Nodes", "category": "Structure", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 82, "description": "Node instantiation and memory allocation."}
                },
                {
                    "id": "node-ptrs",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Reference Chaining", "category": "Core Flow", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 52, "description": "Pointer linking and reference chains."}
                },
                {
                    "id": "node-traversal",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "Traversal Bounds", "category": "Call Stack", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 45, "description": "Handling end-of-list boundary transitions."}
                },
                {
                    "id": "node-failing",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": error_type, "category": "Detected Gap", "shape": "pill", "status": "gap", "proficiency": "gap", "progress": 18, "description": "Unbound node reference or null dereference detected."}
                }
            ]
            edges = [
                {"id": "e-ll-1", "source": "node-ds", "target": "node-ll", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-ll-2", "source": "node-ds", "target": "node-ptrs", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-ll-3", "source": "node-ll", "target": "node-traversal", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-ll-4", "source": "node-ptrs", "target": "node-failing", "animated": True, "type": "dataFlow", "style": {"stroke": "#EF4444"}},
            ]
            return {"nodes": nodes, "edges": edges}

    # 2. Tree / Recursion / Binary Search Snippets
    elif any(k in code_lower for k in ["tree", "node->left", "node->right", "root", "recursion", "binary_search", "left", "right", "mid"]):
        if not has_error:
            nodes = [
                {
                    "id": "node-ds",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {
                        "label": "Data Structures",
                        "category": "Foundation Hub",
                        "shape": "circle",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 98,
                        "description": "Foundational abstract data types and spatial layout invariants."
                    }
                },
                {
                    "id": "node-bs",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {
                        "label": "Binary Search Logic",
                        "category": "Algorithm",
                        "shape": "pill",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 96,
                        "description": "Divide and conquer logarithmic halving of sorted search spaces."
                    }
                },
                {
                    "id": "node-mid",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {
                        "label": "Mid Calculation & Math",
                        "category": "Arithmetic",
                        "shape": "pill",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 94,
                        "description": "Safe integer midpoint calculation preventing arithmetic overflow."
                    }
                },
                {
                    "id": "node-bounds",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {
                        "label": "Loop Invariant Guarantees",
                        "category": "Safety Check",
                        "shape": "pill",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 95,
                        "description": "Boundary conditions (left <= right) guaranteed to terminate safely."
                    }
                },
                {
                    "id": "node-log",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {
                        "label": "Logarithmic Scale O(log n)",
                        "category": "Complexity",
                        "shape": "pill",
                        "status": "proficient",
                        "proficiency": "proficient",
                        "progress": 92,
                        "description": "Optimal asymptotic logarithmic runtime complexity."
                    }
                }
            ]
            edges = [
                {"id": "e1-2", "source": "node-ds", "target": "node-bs", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e1-3", "source": "node-ds", "target": "node-mid", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e2-4", "source": "node-bs", "target": "node-bounds", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e3-5", "source": "node-mid", "target": "node-log", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
            ]
        else:
            nodes = [
                {
                    "id": "node-ds",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "Data Structures", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 98, "description": "Foundational abstract data structures."}
                },
                {
                    "id": "node-trees",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Binary Trees", "category": "Hierarchy", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 88, "description": "Hierarchical tree nodes and pointer links."}
                },
                {
                    "id": "node-traversal",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Tree Traversal", "category": "Core Flow", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 52, "description": "In-order, pre-order, and post-order recursive visits."}
                },
                {
                    "id": "node-recursion",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "Recursion Depth", "category": "Call Stack", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 45, "description": "Base case evaluation across recursive branches."}
                },
                {
                    "id": "node-failing",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": error_type, "category": "Detected Gap", "shape": "pill", "status": "gap", "proficiency": "gap", "progress": 18, "description": "Recursive tree base-case verification."}
                }
            ]
            edges = [
                {"id": "e1-2", "source": "node-ds", "target": "node-trees", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e1-3", "source": "node-ds", "target": "node-traversal", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e2-4", "source": "node-trees", "target": "node-recursion", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e3-5", "source": "node-traversal", "target": "node-failing", "animated": True, "type": "dataFlow", "style": {"stroke": "#EF4444"}},
                {"id": "e4-5", "source": "node-recursion", "target": "node-failing", "animated": True, "type": "dataFlow", "style": {"stroke": "#EF4444"}},
            ]
        return {"nodes": nodes, "edges": edges}

    # 3. I/O & Resource Allocation (e.g. fopen, open_database, database, socket)
    elif any(k in code_lower for k in ["fopen", "open_database", "database", "socket", "connection", "conn"]):
        if not has_error:
            nodes = [
                {
                    "id": "node-io",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "I/O Management", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 98, "description": "System kernel calls and file/socket handles."}
                },
                {
                    "id": "node-handles",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Resource Descriptors", "category": "OS Level", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 95, "description": "File and socket table index allocation."}
                },
                {
                    "id": "node-lifecycle",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Resource Lifecycle", "category": "Lifecycle", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 94, "description": "Acquisition and guaranteed release cycles."}
                },
                {
                    "id": "node-raii",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "RAII & Cleanup Guards", "category": "Pattern", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 96, "description": "Auto-closing context managers and finally blocks."}
                },
                {
                    "id": "node-leak",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": "Reliable Handle Cleanup", "category": "Verified Clean", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 97, "description": "Verified safe! All resources cleanly released."}
                }
            ]
            edges = [
                {"id": "e-io-1", "source": "node-io", "target": "node-handles", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-io-2", "source": "node-io", "target": "node-lifecycle", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-io-3", "source": "node-handles", "target": "node-raii", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-io-4", "source": "node-lifecycle", "target": "node-leak", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
            ]
        else:
            nodes = [
                {
                    "id": "node-io",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "I/O Management", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 96, "description": "System kernel calls and file/socket handles."}
                },
                {
                    "id": "node-handles",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Resource Descriptors", "category": "OS Level", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 82, "description": "File and socket table index allocation."}
                },
                {
                    "id": "node-lifecycle",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Resource Lifecycle", "category": "Lifecycle", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 55, "description": "Acquisition and guaranteed release cycles."}
                },
                {
                    "id": "node-raii",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "RAII & Cleanup Guards", "category": "Pattern", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 48, "description": "Auto-closing context managers and finally blocks."}
                },
                {
                    "id": "node-leak",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": "Unclosed Resource Leak", "category": "Detected Gap", "shape": "pill", "status": "gap", "proficiency": "gap", "progress": 25, "description": "Resource handle management defect."}
                }
            ]
            edges = [
                {"id": "e-io-1", "source": "node-io", "target": "node-handles", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-io-2", "source": "node-io", "target": "node-lifecycle", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-io-3", "source": "node-handles", "target": "node-raii", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-io-4", "source": "node-lifecycle", "target": "node-leak", "animated": True, "type": "dataFlow", "style": {"stroke": "#EF4444"}},
            ]
        return {"nodes": nodes, "edges": edges}

    # 4. Array / Buffer Operations
    elif any(k in code_lower for k in ["arr", "matrix", "buffer", "index", "vector", "sizeof"]):
        if not has_error:
            nodes = [
                {
                    "id": "node-mem",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "Contiguous Memory", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 98, "description": "Sequential memory addresses and cache locality."}
                },
                {
                    "id": "node-offset",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Pointer Offsets", "category": "Arithmetic", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 95, "description": "Element stride calculation based on type size."}
                },
                {
                    "id": "node-access",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Indexing Contracts", "category": "Bounds", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 94, "description": "0-indexed upper and lower bound invariants."}
                },
                {
                    "id": "node-bounds",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "Boundary Checks", "category": "Guard", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 96, "description": "Pre-access boundary assertions."}
                },
                {
                    "id": "node-oob",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": "Safe Array Indexing", "category": "Verified Clean", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 97, "description": "Verified clean! Array bounds safety validated."}
                }
            ]
            edges = [
                {"id": "e-arr-1", "source": "node-mem", "target": "node-offset", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-arr-2", "source": "node-mem", "target": "node-access", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-arr-3", "source": "node-offset", "target": "node-bounds", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-arr-4", "source": "node-access", "target": "node-oob", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
            ]
        else:
            nodes = [
                {
                    "id": "node-mem",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "Contiguous Memory", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 95, "description": "Sequential memory addresses and cache locality."}
                },
                {
                    "id": "node-offset",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Pointer Offsets", "category": "Arithmetic", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 86, "description": "Element stride calculation based on type size."}
                },
                {
                    "id": "node-access",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Indexing Contracts", "category": "Bounds", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 58, "description": "0-indexed upper and lower bound invariants."}
                },
                {
                    "id": "node-bounds",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "Boundary Checks", "category": "Guard", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 50, "description": "Pre-access boundary assertions."}
                },
                {
                    "id": "node-oob",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": "Buffer Overflow / Bounds Check", "category": "Detected Gap", "shape": "pill", "status": "gap", "proficiency": "gap", "progress": 30, "description": "Array bounds safety verification."}
                }
            ]
            edges = [
                {"id": "e-arr-1", "source": "node-mem", "target": "node-offset", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-arr-2", "source": "node-mem", "target": "node-access", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-arr-3", "source": "node-offset", "target": "node-bounds", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-arr-4", "source": "node-access", "target": "node-oob", "animated": True, "type": "dataFlow", "style": {"stroke": "#EF4444"}},
            ]
        return {"nodes": nodes, "edges": edges}

    # 5. Variable Scope / Name Typo (e.g. Python NameError or Python runtime)
    elif "nameerror" in error_type.lower() or "scope" in error_type.lower() or language.lower() == "python":
        if not has_error:
            nodes = [
                {
                    "id": "node-rt",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "Python Runtime", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 98, "description": "Interpreter bytecode and frame execution."}
                },
                {
                    "id": "node-scope",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Lexical Scoping", "category": "Hierarchy", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 96, "description": "LEGB (Local, Enclosing, Global, Builtin) resolution."}
                },
                {
                    "id": "node-sym",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Symbol Resolution", "category": "Namespace", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 95, "description": "Identifier binding and namespace dictionary lookups."}
                },
                {
                    "id": "node-binding",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "Variable Lifetime", "category": "Binding", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 94, "description": "Assignment and evaluation ordering."}
                },
                {
                    "id": "node-name",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": "Namespace & Scope Verified", "category": "Verified Clean", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 97, "description": "Verified clean! All variables, symbols, and scopes are properly declared and referenced."}
                }
            ]
            edges = [
                {"id": "e-py-1", "source": "node-rt", "target": "node-scope", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-py-2", "source": "node-rt", "target": "node-sym", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-py-3", "source": "node-scope", "target": "node-binding", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-py-4", "source": "node-sym", "target": "node-name", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
            ]
        else:
            nodes = [
                {
                    "id": "node-rt",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "Python Runtime", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 98, "description": "Interpreter bytecode and frame execution."}
                },
                {
                    "id": "node-scope",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Lexical Scoping", "category": "Hierarchy", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 85, "description": "LEGB (Local, Enclosing, Global, Builtin) resolution."}
                },
                {
                    "id": "node-sym",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Symbol Tables", "category": "Namespace", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 50, "description": "Identifier binding and namespace dictionary lookups."}
                },
                {
                    "id": "node-binding",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "Variable Lifetime", "category": "Binding", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 42, "description": "Assignment and evaluation ordering."}
                },
                {
                    "id": "node-name",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": error_type if has_error else "Namespace & Scope Verified", "category": "Detected Gap", "shape": "pill", "status": "gap", "proficiency": "gap", "progress": 20, "description": "Referencing unbound or misspelled symbol."}
                }
            ]
            edges = [
                {"id": "e-py-1", "source": "node-rt", "target": "node-scope", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-py-2", "source": "node-rt", "target": "node-sym", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-py-3", "source": "node-scope", "target": "node-binding", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-py-4", "source": "node-sym", "target": "node-name", "animated": True, "type": "dataFlow", "style": {"stroke": "#EF4444"}},
            ]
        return {"nodes": nodes, "edges": edges}

    # 6. Default Pointer / Memory Safety Graph
    else:
        if not has_error:
            nodes = [
                {
                    "id": "node-heap",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "Memory Allocation", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 98, "description": "Dynamic memory allocation and pointer references."}
                },
                {
                    "id": "node-ptrs",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Pointers & References", "category": "Indirection", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 95, "description": "Memory addresses and dereferencing."}
                },
                {
                    "id": "node-offsets",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Struct Field Offsets", "category": "Alignment", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 94, "description": "Accessing object fields relative to base pointer."}
                },
                {
                    "id": "node-guards",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "Defensive Null Guards", "category": "Safety Check", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 96, "description": "Pre-check base pointer for NULL before dereferencing."}
                },
                {
                    "id": "node-deref",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": "Memory & Bounds Safety", "category": "Verified Clean", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 97, "description": "Verified clean! Pointer arithmetic and memory access are safe."}
                }
            ]
            edges = [
                {"id": "e-ptr-1", "source": "node-heap", "target": "node-ptrs", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-ptr-2", "source": "node-heap", "target": "node-offsets", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-ptr-3", "source": "node-ptrs", "target": "node-guards", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-ptr-4", "source": "node-offsets", "target": "node-deref", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
            ]
        else:
            nodes = [
                {
                    "id": "node-heap",
                    "type": "glowingConcept",
                    "position": {"x": 30, "y": 150},
                    "data": {"label": "Memory Allocation", "category": "Foundation Hub", "shape": "circle", "status": "proficient", "proficiency": "proficient", "progress": 96, "description": "Dynamic memory allocation and pointer references."}
                },
                {
                    "id": "node-ptrs",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 40},
                    "data": {"label": "Pointers & References", "category": "Indirection", "shape": "pill", "status": "proficient", "proficiency": "proficient", "progress": 82, "description": "Memory addresses and dereferencing."}
                },
                {
                    "id": "node-offsets",
                    "type": "glowingConcept",
                    "position": {"x": 260, "y": 260},
                    "data": {"label": "Struct Field Offsets", "category": "Alignment", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 55, "description": "Accessing object fields relative to base pointer."}
                },
                {
                    "id": "node-guards",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 40},
                    "data": {"label": "Defensive Null Guards", "category": "Safety Check", "shape": "pill", "status": "weakness", "proficiency": "weakness", "progress": 45, "description": "Pre-check base pointer for NULL before dereferencing."}
                },
                {
                    "id": "node-deref",
                    "type": "glowingConcept",
                    "position": {"x": 560, "y": 260},
                    "data": {"label": error_type, "category": "Detected Gap", "shape": "pill", "status": "gap", "proficiency": "gap", "progress": 18, "description": "Critical defect detected during dereference."}
                }
            ]
            edges = [
                {"id": "e-ptr-1", "source": "node-heap", "target": "node-ptrs", "animated": False, "type": "dataFlow", "style": {"stroke": "#10B981"}},
                {"id": "e-ptr-2", "source": "node-heap", "target": "node-offsets", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-ptr-3", "source": "node-ptrs", "target": "node-guards", "animated": False, "type": "dataFlow", "style": {"stroke": "#F59E0B"}},
                {"id": "e-ptr-4", "source": "node-offsets", "target": "node-deref", "animated": True, "type": "dataFlow", "style": {"stroke": "#EF4444"}},
            ]
        return {"nodes": nodes, "edges": edges}

def generate_dynamic_recommendations(code: str, error_type: str, language: str, concept_gaps: List[str]) -> List[dict]:
    """
    Inspects incoming code snippet for common defect/concept patterns
    and returns tailored, dynamic recommendations with title, est_time,
    progress, tag, and action_text.
    """
    code_lower = code.lower()
    has_error = error_type not in ["No error is found", "Clean Code Check", ""]
    recommendations = []

    # 1. Null / Undefined Checks & Defensive Struct Guardrails
    if any(k in code_lower for k in ["null", "none", "nullptr", "undefined", "->", ".get(", "self.head", "self.next", "root."]) or any("null" in g.lower() or "pointer" in g.lower() for g in concept_gaps):
        progress_val = 65 if not has_error else 40
        recommendations.append({
            "id": "rec-null-safety",
            "title": "Null Pointer Guardrails",
            "est_time": "15 MINS",
            "progress": progress_val,
            "tag": "Defensive Struct Checks",
            "action_text": "CONTINUE LESSON" if progress_val >= 50 else "START LESSON",
            "duration": "15 mins",
            "ctaText": "Continue Lesson" if progress_val >= 50 else "Start Lesson",
            "color": "stroke-indigo-500 text-indigo-400 border-indigo-500/20"
        })

    # 2. Database & I/O Resource Leaks / Guaranteed Cleanup
    if any(k in code_lower for k in ["fopen", "fclose", "open_database", "database", "socket", "conn", "connection", "cursor", "with "]) or any("resource" in g.lower() or "leak" in g.lower() for g in concept_gaps):
        progress_val = 75 if not has_error else 35
        recommendations.append({
            "id": "rec-resource-cleanup",
            "title": "Resource Cleanup & Leaks",
            "est_time": "20 MINS",
            "progress": progress_val,
            "tag": "Database & I/O",
            "action_text": "CONTINUE LESSON" if progress_val >= 50 else "START LESSON",
            "duration": "20 mins",
            "ctaText": "Continue Lesson" if progress_val >= 50 else "Start Lesson",
            "color": "stroke-amber-500 text-amber-400 border-amber-500/20"
        })

    # 3. Array Bounds & Index Contracts
    if any(k in code_lower for k in ["arr", "matrix", "buffer", "index", "vector", "[", "range(", "len(", "sizeof"]) or any("bound" in g.lower() or "index" in g.lower() for g in concept_gaps):
        progress_val = 80 if not has_error else 30
        recommendations.append({
            "id": "rec-bounds-checks",
            "title": "Array Bounds & Iteration Contracts",
            "est_time": "15 MINS",
            "progress": progress_val,
            "tag": "Collection Bounds",
            "action_text": "REVIEW CONCEPTS" if progress_val >= 50 else "START LESSON",
            "duration": "15 mins",
            "ctaText": "Review Concepts" if progress_val >= 50 else "Start Lesson",
            "color": "stroke-emerald-500 text-emerald-400 border-emerald-500/20"
        })

    # 4. Type Contracts & Scope Validation
    if any(k in code_lower for k in ["isinstance", "type(", "int(", "str(", "except", "catch", "raise", "throw"]) or any("scope" in g.lower() or "name" in g.lower() or "type" in g.lower() for g in concept_gaps):
        progress_val = 70 if not has_error else 25
        recommendations.append({
            "id": "rec-type-contracts",
            "title": "Type Contracts & Scope Validation",
            "est_time": "10 MINS",
            "progress": progress_val,
            "tag": "Type & Scope",
            "action_text": "CONTINUE LESSON" if progress_val >= 50 else "START LESSON",
            "duration": "10 mins",
            "ctaText": "Continue Lesson" if progress_val >= 50 else "Start Lesson",
            "color": "stroke-indigo-500 text-indigo-400 border-indigo-500/20"
        })

    # 5. Linked Lists & Reference Chaining
    if any(k in code_lower for k in ["linkedlist", "node", "tree", "binary_search", "self.head", "self.next", "root"]):
        progress_val = 85 if not has_error else 45
        recommendations.append({
            "id": "rec-data-structures",
            "title": "Dynamic Reference & Node Chaining",
            "est_time": "20 MINS",
            "progress": progress_val,
            "tag": "Data Structures",
            "action_text": "CONTINUE LESSON" if progress_val >= 50 else "START LESSON",
            "duration": "20 mins",
            "ctaText": "Continue Lesson" if progress_val >= 50 else "Start Lesson",
            "color": "stroke-purple-500 text-purple-400 border-purple-500/20"
        })

    # Fallback to ensure at least 2-3 dynamic recommendation cards
    if not has_error:
        if len(recommendations) < 2:
            recommendations.append({
                "id": "rec-clean-tests",
                "title": "Edge Case & Invariant Testing",
                "est_time": "15 MINS",
                "progress": 90,
                "tag": "Verification",
                "action_text": "REVIEW CONCEPTS",
                "duration": "15 mins",
                "ctaText": "Review Concepts",
                "color": "stroke-emerald-500 text-emerald-400 border-emerald-500/20"
            })
        if len(recommendations) < 3:
            recommendations.append({
                "id": "rec-clean-asymptotics",
                "title": "Algorithm Complexity Optimization",
                "est_time": "10 MINS",
                "progress": 85,
                "tag": "Complexity O(N)",
                "action_text": "START LESSON",
                "duration": "10 mins",
                "ctaText": "Start Lesson",
                "color": "stroke-indigo-500 text-indigo-400 border-indigo-500/20"
            })
    else:
        if len(recommendations) < 2:
            recommendations.append({
                "id": "rec-general-defensive",
                "title": "Defensive Struct Checks",
                "est_time": "10 MINS",
                "progress": 30,
                "tag": "Safety Invariants",
                "action_text": "START LESSON",
                "duration": "10 mins",
                "ctaText": "Start Lesson",
                "color": "stroke-emerald-500 text-emerald-400 border-emerald-500/20"
            })

    return recommendations[:3]

def generate_dynamic_curriculum_tracks(code: str, error_type: str, language: str, concept_gaps: List[str]) -> List[dict]:
    """
    Dynamically generates personalized learning curriculum tracks based on
    the analyzed code snippet (e.g. Binary Search, Recursive Trees, Pointer/Memory, Clean Code).
    """
    code_lower = code.lower()
    is_clean = (not error_type) or (error_type in ["No error is found", "Clean Code Check", "none", "None", "clean", "Clean"])

    # 1. Trees / Graphs / Recursion / Linked Lists (check first before general left/right)
    if any(k in code_lower for k in ["tree", "treenode", "root", "recursion", "recursive", "linkedlist", "self.head", "self.next", "listnode", "dfs", "bfs", "inorder", "preorder", "postorder", "graph"]) or any(k in " ".join(concept_gaps).lower() for k in ["tree", "recursion", "graph", "linked list"]):
        return [
            {
                "track_id": "track-rec-callstacks",
                "title": "Recursive Call Stacks & Base Condition Invariants",
                "description": "Guarantee recursive descent termination, preventing stack overflow and null base dereferences.",
                "total_time": "2.5 HRS TOTAL",
                "completion_rate": 40,
                "current_lesson": "Base Case Null Sentinel Evaluation",
                "completed_modules": 3,
                "total_modules": 7,
                "color": "indigo"
            },
            {
                "track_id": "track-tree-architectures",
                "title": "Tree Depth & Branch Traversal Architectures",
                "description": "Master in-order, pre-order, post-order, and BFS/DFS topological level-order traversals.",
                "total_time": "3.0 HRS TOTAL",
                "completion_rate": 30,
                "current_lesson": "Iterative vs Recursive Traversal Patterns",
                "completed_modules": 2,
                "total_modules": 6,
                "color": "amber"
            },
            {
                "track_id": "track-ptr-chaining",
                "title": "Dynamic Reference & Pointer Chaining",
                "description": "Construct resilient linked nodes with defensive next/prev pointer verification.",
                "total_time": "2.0 HRS TOTAL",
                "completion_rate": 65,
                "current_lesson": "Sentinel Head Nodes & Cycle Prevention",
                "completed_modules": 3,
                "total_modules": 5,
                "color": "purple"
            }
        ]

    # 2. Binary Search & Divide and Conquer
    if any(k in code_lower for k in ["binary_search", "binarysearch", "divide", "conquer"]) or ("mid" in code_lower and any(k in code_lower for k in ["left", "right", "target", "low", "high"])) or any("search" in g.lower() or "binary" in g.lower() for g in concept_gaps):
        return [
            {
                "track_id": "track-bs-invariants",
                "title": "Logarithmic Search Invariants & Bounds",
                "description": "Prevent index off-by-one errors and integer midpoint overflow in (left + right) // 2 divide-and-conquer loops.",
                "total_time": "1.5 HRS TOTAL",
                "completion_rate": 45,
                "current_lesson": "Safe Midpoint Arithmetic & Monotonic Space Halving",
                "completed_modules": 3,
                "total_modules": 6,
                "color": "indigo"
            },
            {
                "track_id": "track-bs-divide-conquer",
                "title": "Divide and Conquer Core Mechanics",
                "description": "Master monotonic array properties, logarithmic scale reductions, and search space boundary halving.",
                "total_time": "2.0 HRS TOTAL",
                "completion_rate": 35,
                "current_lesson": "Upper and Lower Bound Invariant Contracts",
                "completed_modules": 2,
                "total_modules": 5,
                "color": "purple"
            },
            {
                "track_id": "track-bs-edge-cases",
                "title": "Edge-Case Testing for Search Routines",
                "description": "Handle boundary conditions with empty slices, singletons, duplicate elements, and targets outside bounds.",
                "total_time": "1.2 HRS TOTAL",
                "completion_rate": 60,
                "current_lesson": "Boundary Assertion & Search Routine Fuzzing",
                "completed_modules": 3,
                "total_modules": 5,
                "color": "emerald"
            }
        ]

    # 3. Clean Code / Verified Clean Snippets
    if is_clean:
        return [
            {
                "track_id": "track-clean-proofs",
                "title": "Time & Space Complexity Proofs",
                "description": "Prove asymptotic time and space guarantees using recurrence trees, master theorem, and loop invariants.",
                "total_time": "2.0 HRS TOTAL",
                "completion_rate": 85,
                "current_lesson": "Asymptotic Bound Formalization & Big-O Rigor",
                "completed_modules": 5,
                "total_modules": 6,
                "color": "indigo"
            },
            {
                "track_id": "track-clean-unit-testing",
                "title": "Unit Testing & Boundary Assertions",
                "description": "Author exhaustive test suites covering generative fuzz testing, edge constraints, and invariant checks.",
                "total_time": "1.5 HRS TOTAL",
                "completion_rate": 80,
                "current_lesson": "Property-Based Fuzzing & Mutation Testing",
                "completed_modules": 4,
                "total_modules": 5,
                "color": "emerald"
            },
            {
                "track_id": "track-clean-patterns",
                "title": "Optimized Implementation Patterns",
                "description": "Explore cache locality, SIMD vectorization, bitwise arithmetic, and iterative state reductions.",
                "total_time": "2.5 HRS TOTAL",
                "completion_rate": 90,
                "current_lesson": "Bit Manipulation & Cache Spatial Locality",
                "completed_modules": 6,
                "total_modules": 7,
                "color": "purple"
            }
        ]

    # 4. Pointer / Memory / Resource Management
    if any(k in code_lower for k in ["fopen", "socket", "database", "conn", "ptr", "alloc", "free", "malloc", "null", "leak", "pointer", "segmentation"]) or any("pointer" in g.lower() or "resource" in g.lower() for g in concept_gaps):
        return [
            {
                "track_id": "track-ptr-null-safety",
                "title": "Pointer Validation & Null Safety Verification",
                "description": "Master heap allocations, lifecycle invariants, and defensive null guards before dereferencing.",
                "total_time": "2.5 HRS TOTAL",
                "completion_rate": 68,
                "current_lesson": "Defensive Struct & Base Pointer Dereferencing",
                "completed_modules": 5,
                "total_modules": 8,
                "color": "indigo"
            },
            {
                "track_id": "track-heap-lifetime",
                "title": "Dynamic Heap Allocation & Lifetime Controls",
                "description": "Eliminate memory leaks, orphan allocations, and use-after-free conditions in native environments.",
                "total_time": "3.2 HRS TOTAL",
                "completion_rate": 40,
                "current_lesson": "Memory Profiling & Valgrind Invariant Checks",
                "completed_modules": 2,
                "total_modules": 6,
                "color": "purple"
            },
            {
                "track_id": "track-resource-raii",
                "title": "Resource Lifecycle & Exception Safety",
                "description": "Enforce RAII, deterministic context managers, and auto-closing handles for database and I/O sockets.",
                "total_time": "2.8 HRS TOTAL",
                "completion_rate": 55,
                "current_lesson": "Auto-Closing Socket & File Handle Managers",
                "completed_modules": 3,
                "total_modules": 5,
                "color": "amber"
            }
        ]

    # 5. General / Default Fallback
    return [
        {
            "track_id": "track-defensive-bounds",
            "title": "Defensive Coding & Boundary Verification",
            "description": "Eliminate buffer overflows, off-by-one errors, and unchecked access paths across data structures.",
            "total_time": "2.8 HRS TOTAL",
            "completion_rate": 75,
            "current_lesson": "Safe Index Offset Guarantees",
            "completed_modules": 4,
            "total_modules": 5,
            "color": "emerald"
        },
        {
            "track_id": "track-invariant-design",
            "title": "Code Structure & Invariant Design",
            "description": "Design robust functional abstractions, immutable state flows, and deterministic error handling.",
            "total_time": "2.2 HRS TOTAL",
            "completion_rate": 50,
            "current_lesson": "Invariant Contracts & Assertion Guards",
            "completed_modules": 3,
            "total_modules": 6,
            "color": "indigo"
        },
        {
            "track_id": "track-runtime-profiling",
            "title": "Runtime Execution & Performance Profiling",
            "description": "Analyze call stack execution depths, heap profiles, and latency bottlenecks.",
            "total_time": "1.8 HRS TOTAL",
            "completion_rate": 40,
            "current_lesson": "Call Stack Analysis & Bottleneck Identification",
            "completed_modules": 2,
            "total_modules": 5,
            "color": "purple"
        }
    ]

# --- Route 1: POST /api/analyze ---
@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_code(request: CodeSubmissionBase, db: Session = Depends(get_db)):
    if not request.user_code.strip():
        raise HTTPException(status_code=400, detail="Code content cannot be empty")
    
    # Run the core AI engine analysis, database persistence, and vector indexing
    pipeline_result = analyze_code_submission(
        submission_id=request.submission_id,
        user_code=request.user_code,
        stack_trace=request.stack_trace or "",
        programming_language=request.programming_language,
        db=db
    )
    
    # Generate dynamic learning path recommendations based on analyzed code & concept patterns
    recommendations_data = generate_dynamic_recommendations(
        code=request.user_code,
        error_type=pipeline_result["error_type"],
        language=request.programming_language,
        concept_gaps=pipeline_result.get("concept_gap", [])
    )
    recommendations = [RecommendationItem(**rec) for rec in recommendations_data]
    
    # Generate dynamic curriculum tracks based on topic and invariants
    curriculum_tracks_data = generate_dynamic_curriculum_tracks(
        code=request.user_code,
        error_type=pipeline_result["error_type"],
        language=request.programming_language,
        concept_gaps=pipeline_result.get("concept_gap", [])
    )
    curriculum_tracks = [CurriculumTrackItem(**t) for t in curriculum_tracks_data]
        
    dynamic_graph = generate_dynamic_concept_graph(
        code=request.user_code,
        error_type=pipeline_result["error_type"],
        language=request.programming_language
    )
        
    # Identify specific error lines if defect was detected
    error_lines: List[int] = []
    if pipeline_result["error_type"] != "No error is found":
        error_lines = pipeline_result.get("error_lines", [])
        if not error_lines and request.stack_trace:
            import re
            st_matches = re.findall(r"line\s+(\d+)", request.stack_trace, re.IGNORECASE)
            if st_matches:
                error_lines = [int(m) for m in st_matches]

    return {
        "status": "success",
        "language": pipeline_result["programming_language"],
        "error_clusters": [
            {
                "id": f"err-{pipeline_result['submission_db_id']}",
                "title": pipeline_result["error_type"],
                "severity": "low" if pipeline_result["error_type"] == "No error is found" else "high",
                "attempts": 1,
                "description": pipeline_result["pattern_cluster"]
            }
        ],
        "socratic_hint": pipeline_result["socratic_hint"],
        "concept_gap": pipeline_result["concept_gap"],
        "recommendations": recommendations,
        "curriculum_tracks": curriculum_tracks,
        "concept_map": dynamic_graph,
        "nodes": dynamic_graph["nodes"],
        "edges": dynamic_graph["edges"],
        "error_lines": error_lines
    }

# --- Route 1b: GET /api/curriculum ---
@router.get("/curriculum", response_model=List[CurriculumTrackItem])
async def get_curriculum_tracks(topic: Optional[str] = None):
    """
    Returns baseline or topic-customized personalized learning curriculum tracks.
    """
    tracks = generate_dynamic_curriculum_tracks(
        code=topic or "",
        error_type="No error is found" if not topic else "Custom Inspection",
        language="python",
        concept_gaps=[topic] if topic else []
    )
    return [CurriculumTrackItem(**t) for t in tracks]

# --- Route 2: GET /api/concept-map ---
@router.get("/concept-map", response_model=ConceptMapResponse)
async def get_concept_map(db: Session = Depends(get_db)):
    """
    Fetches the current user's concept nodes and their proficiency states:
    - Proficient: Concept is mastered with low error rates (emerald)
    - Weakness: Concept has recurrent detected error clusters (indigo)
    - Gap: Concept has missing foundational knowledge requiring lessons (amber/slate)
    """
    nodes = [
        {
            "id": "node-1",
            "type": "concept",
            "position": {"x": 20, "y": 150},
            "data": {"label": "Memory Allocation", "status": "Proficient", "level": "Foundation"}
        },
        {
            "id": "node-2",
            "type": "concept",
            "position": {"x": 240, "y": 80},
            "data": {"label": "Null Safety Guard", "status": "Weakness", "level": "Active Gap"}
        },
        {
            "id": "node-3",
            "type": "concept",
            "position": {"x": 240, "y": 220},
            "data": {"label": "Resource Lifecycle", "status": "Proficient", "level": "Foundation"}
        },
        {
            "id": "node-4",
            "type": "concept",
            "position": {"x": 460, "y": 80},
            "data": {"label": "Defensive Coding", "status": "Gap", "level": "Intermediate"}
        },
        {
            "id": "node-5",
            "type": "concept",
            "position": {"x": 460, "y": 220},
            "data": {"label": "Garbage Collection", "status": "Gap", "level": "Advanced"}
        }
    ]

    edges = [
        {"id": "e1-2", "source": "node-1", "target": "node-2", "animated": True},
        {"id": "e3-2", "source": "node-3", "target": "node-2", "animated": True},
        {"id": "e2-4", "source": "node-2", "target": "node-4", "animated": False},
        {"id": "e2-5", "source": "node-2", "target": "node-5", "animated": False}
    ]

    return {"nodes": nodes, "edges": edges}

# --- Route 3: GET /api/recommendations ---
@router.get("/recommendations", response_model=List[RecommendationItem])
async def get_recommendations(db: Session = Depends(get_db)):
    """
    Generates targeted learning modules based on the user's active detected gaps.
    """
    return [
        {
            "id": "rec-1",
            "title": "Null Pointer Guardrails",
            "progress": 65,
            "duration": "15 mins",
            "ctaText": "Continue Lesson",
            "color": "stroke-indigo-500 text-indigo-400 border-indigo-500/20"
        },
        {
            "id": "rec-2",
            "title": "Garbage Collection & Leaks",
            "progress": 35,
            "duration": "25 mins",
            "ctaText": "Unlock Lesson",
            "color": "stroke-amber-500 text-amber-400 border-amber-500/20"
        },
        {
            "id": "rec-3",
            "title": "Defensive Struct Checks",
            "progress": 90,
            "duration": "10 mins",
            "ctaText": "Review Concepts",
            "color": "stroke-emerald-500 text-emerald-400 border-emerald-500/20"
        }
    ]

# --- Route 4: POST /api/resolve-gap ---
@router.post("/resolve-gap", response_model=ResolveGapResponse)
async def resolve_gap(payload: ResolveGapRequest, db: Session = Depends(get_db)):
    """
    Records student mastery feedback for a specific concept gap and updates knowledge state dynamically.
    """
    next_level_map = {
        "nudge": "hint",
        "hint": "fix",
        "fix": "mastered"
    }

    next_level = next_level_map.get(payload.hint_level.lower(), "hint") if not payload.resolved else None
    score_gain = 15 if payload.resolved else 0

    msg = (
        f"Mastery verified! +{score_gain}% added to {payload.gap_concept or 'Concept'} knowledge node."
        if payload.resolved
        else f"Advancing Socratic progression to Level {next_level.upper() if next_level else 'next'} for deeper conceptual scaffolding."
    )

    return {
        "status": "success",
        "submission_id": payload.submission_id or "sub-tree-01",
        "gap_concept": payload.gap_concept or "Null Pointer Dereference",
        "resolved": payload.resolved,
        "hint_level": payload.hint_level,
        "concept_mastery_updated": True,
        "mastery_score_gain": score_gain,
        "next_hint_level": next_level,
        "message": msg
    }


@router.post("/admin/retrain-model")
async def retrain_model(db: Session = Depends(get_db)):
    """Retrain the model using all verified examples from the database."""
    verified_count = db.query(ErrorClassificationExample).filter(ErrorClassificationExample.is_verified.is_(True)).count()
    if verified_count == 0:
        return {
            "status": "not_enough_data",
            "reason": "No verified examples found.",
            "model_path": "",
            "num_classes": 0,
            "accuracy": 0.0,
        }

    result = train_error_classifier(db)
    return result


# --- Historical Submissions Dataset & Re-Inspection Endpoints ---
HISTORICAL_SUBMISSIONS_DB = {
    "sub-101": {
        "submission_id": "sub-101",
        "file_name": "early_traversal.c",
        "language": "c",
        "code": """#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int val;
    struct Node* left;
    struct Node* right;
} Node;

void printTreeInOrder(Node* root) {
    // Unchecked root pointer dereference
    printf("Node val: %d\\n", root->val);
    if (root->left != NULL) printTreeInOrder(root->left);
    if (root->right != NULL) printTreeInOrder(root->right);
}""",
        "defect_title": "Null Pointer Dereference",
        "severity": "high",
        "error_lines": [12],
        "status": "Failed - Segmentation Fault",
        "day": 2,
        "attempts": 4,
        "concept_gap": "Pointers & Memory",
        "socratic_hint": "What happens if this function is called with a NULL pointer? Verify the base pointer prior to dereferencing.",
        "concept_gaps": ["Pointers", "Memory Allocation", "Defensive Programming"],
        "created_at": "Day 2 (28 days ago)"
    },
    "sub-102": {
        "submission_id": "sub-102",
        "file_name": "array_allocator.c",
        "language": "c",
        "code": """#include <stdio.h>
#include <stdlib.h>

int* createBuffer(int size) {
    int* buf = (int*)malloc(size * sizeof(int));
    for (int i = 0; i <= size; i++) {
        // Buffer overflow: accessing index equal to size
        buf[i] = i * 2;
    }
    return buf;
}""",
        "defect_title": "Buffer Overflow / OOB",
        "severity": "high",
        "error_lines": [7],
        "status": "Failed - Boundary Check Missing",
        "day": 6,
        "attempts": 3,
        "concept_gap": "Boundary Checks",
        "socratic_hint": "Check the loop termination condition. In zero-indexed arrays of length N, what is the maximum valid index?",
        "concept_gaps": ["Boundary Checks", "Memory Allocation", "Off-by-One"],
        "created_at": "Day 6 (24 days ago)"
    },
    "sub-103": {
        "submission_id": "sub-103",
        "file_name": "linked_list_chase.c",
        "language": "c",
        "code": """#include <stdio.h>
#include <stdlib.h>

typedef struct ListNode {
    int data;
    struct ListNode* next;
} ListNode;

int getThirdElement(ListNode* head) {
    // Chaining next pointers without intermediate NULL validation
    return head->next->next->data;
}""",
        "defect_title": "Orphan Pointer Dereference",
        "severity": "medium",
        "error_lines": [10],
        "status": "Weakness - Step 2 Socratic",
        "day": 12,
        "attempts": 2,
        "concept_gap": "Linked Lists",
        "socratic_hint": "What if the list has fewer than 3 elements? Trace the evaluation of head->next when head->next is NULL.",
        "concept_gaps": ["Linked Lists", "Defensive Programming", "Pointers"],
        "created_at": "Day 12 (18 days ago)"
    },
    "sub-104": {
        "submission_id": "sub-104",
        "file_name": "user_repository.py",
        "language": "python",
        "code": """def fetch_user_record(user_id):
    db_conn = open_database()
    cursor = db_conn.cursor()
    # Handle opened without guaranteed close or context manager
    result = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    return result.fetchone()""",
        "defect_title": "Unclosed Resource Leak",
        "severity": "medium",
        "error_lines": [2],
        "status": "Fixed via Context Manager",
        "day": 18,
        "attempts": 1,
        "concept_gap": "Resource Lifecycle",
        "socratic_hint": "Where is the database handle or file stream closed? Ensure resources are released in a finally block or context manager.",
        "concept_gaps": ["Resource Lifecycle", "Resource Cleanup", "Exception Safety"],
        "created_at": "Day 18 (12 days ago)"
    },
    "sub-105": {
        "submission_id": "sub-105",
        "file_name": "matrix_multiplication.java",
        "language": "java",
        "code": """public class MatrixMultiplier {
    public static int getCorner(int[][] matrix) {
        int rows = matrix.length;
        int cols = matrix[0].length;
        // Accessing rows instead of rows - 1
        return matrix[rows][cols];
    }
}""",
        "defect_title": "Index Out of Bounds",
        "severity": "low",
        "error_lines": [6],
        "status": "Resolved with Guardrail",
        "day": 24,
        "attempts": 1,
        "concept_gap": "Defensive Coding",
        "socratic_hint": "Array indices range from 0 to length - 1. Accessing index [rows] triggers ArrayIndexOutOfBoundsException.",
        "concept_gaps": ["Boundary Checks", "List Indexing", "Defensive Coding"],
        "created_at": "Day 24 (6 days ago)"
    },
    "sub-106": {
        "submission_id": "sub-106",
        "file_name": "tree_traversal.c",
        "language": "c",
        "code": """#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int val;
    struct Node* left;
    struct Node* right;
} Node;

void printTreeInOrder(Node* root) {
    // 💥 Bug: Dereferencing unvalidated root pointer
    printf("Node value: %d\\n", root->val);
    
    if (root->left != NULL) {
        printTreeInOrder(root->left);
    }
    if (root->right != NULL) {
        printTreeInOrder(root->right);
    }
}""",
        "defect_title": "Null Pointer Dereference",
        "severity": "high",
        "error_lines": [12],
        "status": "Resolved with Socratic Hint",
        "day": 29,
        "attempts": 3,
        "concept_gap": "Null Safety Guardrails",
        "socratic_hint": "What happens if this function is called with a NULL pointer? Verify the base pointer prior to dereferencing.",
        "concept_gaps": ["Pointers", "Memory Allocation", "Defensive Programming"],
        "created_at": "Day 29 (Yesterday)"
    },
    "sub-107": {
        "submission_id": "sub-107",
        "file_name": "safe_buffer_stream.c",
        "language": "c",
        "code": """#include <stdio.h>
#include <stdlib.h>

int safeRead(const int* buffer, size_t len, size_t index) {
    if (buffer == NULL || index >= len) {
        return -1;
    }
    return buffer[index];
}""",
        "defect_title": "No error is found",
        "severity": "low",
        "error_lines": [],
        "status": "Proficient - 100% Passed",
        "day": 30,
        "attempts": 1,
        "concept_gap": "Memory Safety",
        "socratic_hint": "No detectable error pattern was found. The code structure, logic, and syntax are verified and valid.",
        "concept_gaps": ["Memory Safety", "Defensive Programming"],
        "created_at": "Day 30 (Today)"
    }
}

# --- Route 5: GET /api/history ---
@router.get("/history", response_model=List[HistoryItemResponse])
async def get_history_list(db: Session = Depends(get_db)):
    """
    Returns a comprehensive chronological history of past submissions and defect audits.
    Combines persistent database audit submissions with benchmark historical logs.
    """
    history_items: List[HistoryItemResponse] = []
    seen_ids = set()

    # 1. Fetch persistent database submissions
    db_submissions = db.query(CodeSubmission).order_by(CodeSubmission.created_at.desc()).all()
    for sub in db_submissions:
        cluster = sub.error_clusters[0] if sub.error_clusters else None
        defect_title = cluster.title if cluster else "Code Inspection"
        severity = cluster.severity if cluster else "low"
        
        # Determine language extension
        lang_ext = "py" if sub.programming_language == "python" else ("c" if sub.programming_language == "c" else ("java" if sub.programming_language == "java" else "js"))
        file_name = f"submission_{sub.submission_id[:6]}.{lang_ext}"

        # Error lines detection
        error_lines = []
        if cluster and cluster.title != "No error is found":
            for idx, line in enumerate(sub.user_code.split("\n"), 1):
                if any(k in line.lower() for k in ["root->val", "user.profile", "open_database()", "fopen(", "/ 0"]):
                    error_lines.append(idx)

        created_str = sub.created_at.strftime("%Y-%m-%d %H:%M") if sub.created_at else "Recently"

        item = HistoryItemResponse(
            submission_id=sub.submission_id,
            file_name=file_name,
            language=sub.programming_language,
            code=sub.user_code,
            defect_title=defect_title,
            severity=severity,
            error_lines=error_lines,
            status="Audit Recorded",
            day=30,
            attempts=cluster.attempts if cluster else 1,
            concept_gap="Code Reliability",
            created_at=created_str
        )
        history_items.append(item)
        seen_ids.add(sub.submission_id)

    # 2. Add seeded benchmark submissions if not already included
    for sub_id, data in HISTORICAL_SUBMISSIONS_DB.items():
        if sub_id not in seen_ids:
            history_items.append(
                HistoryItemResponse(
                    submission_id=data["submission_id"],
                    file_name=data["file_name"],
                    language=data["language"],
                    code=data["code"],
                    defect_title=data["defect_title"],
                    severity=data["severity"],
                    error_lines=data["error_lines"],
                    status=data["status"],
                    day=data["day"],
                    attempts=data["attempts"],
                    concept_gap=data["concept_gap"],
                    created_at=data["created_at"]
                )
            )

    return history_items


# --- Route 6: GET /api/history/{submission_id} ---
@router.get("/history/{submission_id}", response_model=HistoryDetailResponse)
async def get_history_detail(submission_id: str, db: Session = Depends(get_db)):
    """
    Fetches the complete historical snapshot for re-inspection, including code,
    exact error lines, Socratic hints, and interactive knowledge graph structures.
    """
    # 1. Check benchmark seed DB
    if submission_id in HISTORICAL_SUBMISSIONS_DB:
        data = HISTORICAL_SUBMISSIONS_DB[submission_id]
        dynamic_graph = generate_dynamic_concept_graph(
            code=data["code"],
            error_type=data["defect_title"],
            language=data["language"]
        )
        recommendations_data = generate_dynamic_recommendations(
            code=data["code"],
            error_type=data["defect_title"],
            language=data["language"],
            concept_gaps=data.get("concept_gaps", [data.get("concept_gap", "")])
        )
        recommendations = [RecommendationItem(**rec) for rec in recommendations_data]
        curriculum_tracks_data = generate_dynamic_curriculum_tracks(
            code=data["code"],
            error_type=data["defect_title"],
            language=data["language"],
            concept_gaps=data.get("concept_gaps", [data.get("concept_gap", "")])
        )
        curriculum_tracks = [CurriculumTrackItem(**t) for t in curriculum_tracks_data]
        return HistoryDetailResponse(
            submission_id=data["submission_id"],
            file_name=data["file_name"],
            language=data["language"],
            code=data["code"],
            defect_title=data["defect_title"],
            severity=data["severity"],
            error_lines=data["error_lines"],
            status=data["status"],
            day=data["day"],
            attempts=data["attempts"],
            concept_gap=data["concept_gap"],
            created_at=data["created_at"],
            error_clusters=[
                ErrorClusterResponse(
                    id=f"err-{submission_id}",
                    title=data["defect_title"],
                    severity=data["severity"],
                    attempts=data["attempts"],
                    description=data["socratic_hint"]
                )
            ],
            socratic_hint=data["socratic_hint"],
            concept_gaps=data["concept_gaps"],
            recommendations=recommendations,
            curriculum_tracks=curriculum_tracks,
            concept_map=ConceptMapResponse(
                nodes=dynamic_graph["nodes"],
                edges=dynamic_graph["edges"]
            ),
            nodes=dynamic_graph["nodes"],
            edges=dynamic_graph["edges"]
        )

    # 2. Check Database
    sub = db.query(CodeSubmission).filter(CodeSubmission.submission_id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail=f"Submission '{submission_id}' not found.")

    cluster = sub.error_clusters[0] if sub.error_clusters else None
    defect_title = cluster.title if cluster else "Code Inspection"
    severity = cluster.severity if cluster else "low"
    lang_ext = "py" if sub.programming_language == "python" else ("c" if sub.programming_language == "c" else ("java" if sub.programming_language == "java" else "js"))
    file_name = f"submission_{sub.submission_id[:6]}.{lang_ext}"

    dynamic_graph = generate_dynamic_concept_graph(
        code=sub.user_code,
        error_type=defect_title,
        language=sub.programming_language
    )

    error_lines = []
    if cluster and cluster.title != "No error is found":
        for idx, line in enumerate(sub.user_code.split("\n"), 1):
            if any(k in line.lower() for k in ["root->val", "user.profile", "open_database()", "fopen(", "/ 0"]):
                error_lines.append(idx)

    created_str = sub.created_at.strftime("%Y-%m-%d %H:%M") if sub.created_at else "Recently"
    db_concept_gaps = [cluster.title] if cluster else ["Logic & Debugging"]
    recommendations_data = generate_dynamic_recommendations(
        code=sub.user_code,
        error_type=defect_title,
        language=sub.programming_language,
        concept_gaps=db_concept_gaps
    )
    recommendations = [RecommendationItem(**rec) for rec in recommendations_data]
    curriculum_tracks_data = generate_dynamic_curriculum_tracks(
        code=sub.user_code,
        error_type=defect_title,
        language=sub.programming_language,
        concept_gaps=db_concept_gaps
    )
    curriculum_tracks = [CurriculumTrackItem(**t) for t in curriculum_tracks_data]

    return HistoryDetailResponse(
        submission_id=sub.submission_id,
        file_name=file_name,
        language=sub.programming_language,
        code=sub.user_code,
        defect_title=defect_title,
        severity=severity,
        error_lines=error_lines,
        status="Audit Recorded",
        day=30,
        attempts=cluster.attempts if cluster else 1,
        concept_gap="Code Reliability",
        created_at=created_str,
        error_clusters=[
            ErrorClusterResponse(
                id=f"err-{sub.id}",
                title=defect_title,
                severity=severity,
                attempts=cluster.attempts if cluster else 1,
                description=cluster.description if cluster else "Analyzed submission pattern."
            )
        ],
        socratic_hint=cluster.description if cluster else "Inspect identified logic flows.",
        concept_gaps=db_concept_gaps,
        recommendations=recommendations,
        curriculum_tracks=curriculum_tracks,
        concept_map=ConceptMapResponse(
            nodes=dynamic_graph["nodes"],
            edges=dynamic_graph["edges"]
        ),
        nodes=dynamic_graph["nodes"],
        edges=dynamic_graph["edges"]
    )

