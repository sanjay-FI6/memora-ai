from typing import List, Dict, Any

from sqlalchemy.orm import Session

from app.db.models import ErrorClassificationExample


def load_verified_training_examples(db: Session) -> List[Dict[str, Any]]:
    """Load only verified examples into a model-ready format.

    Returns a list like:
    [{"text": "<code + stack trace>", "label": "Null Pointer Dereference"}, ...]
    """
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
