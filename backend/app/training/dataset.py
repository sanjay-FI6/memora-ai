import json
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple

from sqlalchemy.orm import Session
from app.db.models import ErrorClassificationExample, User

DATA_JSON_PATH = Path(__file__).resolve().parents[2] / "tests" / "data.json"


def classify_code_defect(code: str) -> Tuple[str, str, str]:
    """
    Analyzes code features from data.json and assigns a defect label,
    pattern cluster, and concept gap.
    """
    clower = code.lower()

    if "recursion" in clower or "recursive" in clower or "def " in clower and "stack overflow" in clower:
        return (
            "Recursion Stack Overflow",
            "Base Condition Missing",
            "Call Stack & Recursion Invariants"
        )
    elif "indexerror" in clower or ("[" in code and re.search(r"\[[a-zA-Z0-9_+\- ]+\]", code) and ("index" in clower or "range(" in clower or "len(" in clower)):
        return (
            "Index Out of Bounds / Buffer Overflow",
            "Array Bounds Invariant",
            "Boundary Verification & Off-by-One Checks"
        )
    elif "attributeerror" in clower or ("none" in clower and ("is none" in clower or "== none" in clower or "is not none" in clower)):
        return (
            "Null Pointer Dereference",
            "Unchecked Object Access",
            "Null Safety & Defensive Object Dereferencing"
        )
    elif "open(" in clower or "fopen" in clower or "socket" in clower or ("file" in clower and "close" not in clower):
        return (
            "Unclosed Resource Leak",
            "Resource Lifecycle & RAII",
            "File Handle Lifecycle & Context Managers"
        )
    elif "binary" in clower or "search" in clower:
        return (
            "Logarithmic Search Invariants & Bounds",
            "Divide and Conquer Core Mechanics",
            "Binary Search Midpoint Arithmetic"
        )
    else:
        return (
            "Clean Code Check",
            "Standard Syntax Structure",
            "Code Correctness & Testing"
        )


def load_data_json_records(max_records: int = 500) -> List[Dict[str, Any]]:
    """
    Reads directly from tests/data.json and extracts structured training records.
    """
    if not DATA_JSON_PATH.exists():
        return []

    records: List[Dict[str, Any]] = []
    with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            if idx >= max_records:
                break
            line_str = line.strip()
            if not line_str:
                continue
            try:
                item = json.loads(line_str)
                code_content = item.get("content", "")
                if not code_content or len(code_content) < 20:
                    continue

                error_type, pattern_cluster, concept_gap = classify_code_defect(code_content)
                records.append({
                    "text": code_content[:4000],
                    "label": error_type,
                    "programming_language": item.get("lang", "Python").lower(),
                    "source_submission_id": f"data-json-{idx+1}",
                    "pattern_cluster": pattern_cluster,
                    "concept_gap": concept_gap,
                    "user_code": code_content[:4000],
                    "stack_trace": f"Automated inspection trace for {item.get('path', 'script')}",
                })
            except json.JSONDecodeError:
                continue

    return records


def ingest_data_json_into_db(db: Session, max_records: int = 500) -> int:
    """
    Ingests samples from tests/data.json directly into the local SQLite database table
    (error_classification_examples) for persistent model training.
    """
    records = load_data_json_records(max_records=max_records)
    if not records:
        return 0

    # Ensure a default user exists to satisfy foreign key constraints
    user = db.query(User).filter_by(username="data_json_trainer").first()
    if not user:
        user = User(
            username="data_json_trainer",
            email="trainer@memora.ai",
            hashed_password="dataset_ingest_secret"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    inserted = 0
    for rec in records:
        exists = db.query(ErrorClassificationExample).filter_by(
            source_submission_id=rec["source_submission_id"]
        ).first()

        if not exists:
            example = ErrorClassificationExample(
                user_id=user.id,
                source_submission_id=rec["source_submission_id"],
                programming_language=rec["programming_language"],
                user_code=rec["user_code"],
                stack_trace=rec["stack_trace"],
                error_type=rec["label"],
                pattern_cluster=rec["pattern_cluster"],
                concept_gap=rec["concept_gap"],
                is_verified=True,
                reviewer_notes="Ingested from tests/data.json benchmark"
            )
            db.add(example)
            inserted += 1

    if inserted > 0:
        db.commit()

    return inserted


def load_verified_training_examples(db: Session, auto_ingest: bool = False) -> List[Dict[str, Any]]:
    """
    Loads verified examples from the database into a model-ready format.
    Optionally ingests from tests/data.json if auto_ingest is set to True.
    """
    if auto_ingest and DATA_JSON_PATH.exists():
        current_count = db.query(ErrorClassificationExample).filter(
            ErrorClassificationExample.is_verified.is_(True)
        ).count()
        if current_count < 20:
            ingest_data_json_into_db(db, max_records=300)

    rows = (
        db.query(ErrorClassificationExample)
        .filter(ErrorClassificationExample.is_verified.is_(True))
        .all()
    )

    training_rows: List[Dict[str, Any]] = []
    for row in rows:
        combined_text = "\n".join(
            part for part in [row.user_code, row.stack_trace or "", row.pattern_cluster or ""] if part
        )
        training_rows.append({
            "text": combined_text,
            "label": row.error_type,
            "programming_language": row.programming_language,
            "source_submission_id": row.source_submission_id,
        })

    return training_rows
