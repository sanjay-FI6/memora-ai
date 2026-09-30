import os
import pickle
from pathlib import Path
from typing import Any, Dict, List

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sqlalchemy.orm import Session

from app.training.dataset import load_verified_training_examples


MODEL_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = MODEL_DIR / "error_classifier.pkl"


def _ensure_model_dir() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)


def train_error_classifier(db: Session) -> Dict[str, Any]:
    """Train a lightweight text classifier from verified code-error examples."""
    rows = load_verified_training_examples(db)
    if len(rows) < 2:
        return {
            "status": "not_enough_data",
            "reason": "Need at least two verified training examples to fit the model.",
            "num_classes": 0,
            "model_path": str(MODEL_PATH),
            "accuracy": 0.0,
        }

    texts = [row["text"] for row in rows]
    labels = [row["label"] for row in rows]

    class_counts = {}
    for label in labels:
        class_counts[label] = class_counts.get(label, 0) + 1

    if len(labels) >= 4 and all(count >= 2 for count in class_counts.values()):
        X_train, X_test, y_train, y_test = train_test_split(
            texts,
            labels,
            test_size=0.2,
            random_state=42,
            stratify=labels,
        )
    else:
        X_train, X_test, y_train, y_test = texts, texts, labels, labels

    model = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
        ("clf", LogisticRegression(max_iter=1000, solver="lbfgs")),
    ])

    model.fit(X_train, y_train)
    accuracy = model.score(X_test, y_test)

    _ensure_model_dir()
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    return {
        "status": "trained",
        "model_path": str(MODEL_PATH),
        "num_classes": len(model.classes_),
        "accuracy": float(accuracy),
        "train_size": len(X_train),
        "test_size": len(X_test),
    }
