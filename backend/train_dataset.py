"""
Memora AI - Local Dataset Trainer & Seeder
Uses tests/data.json to populate the local database (memoradb.db)
and trains the Scikit-Learn TF-IDF + Logistic Regression classification model.
"""

import os
from pathlib import Path
from app.db.session import SessionLocal, engine, Base
from app.db.models import User, ErrorClassificationExample
from app.training.dataset import DATA_JSON_PATH, ingest_data_json_into_db, load_verified_training_examples
from app.training.train_model import train_error_classifier, MODEL_PATH
from app.training.predict import predict_error_type


def seed_and_train(max_records: int = 500):
    print("=" * 65)
    print("Memora AI - Local Machine Learning Training Pipeline")
    print(f"Dataset Source: tests/data.json ({DATA_JSON_PATH})")
    print("=" * 65)

    # 1. Initialize DB Schema
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 2. Check tests/data.json existence
        if not DATA_JSON_PATH.exists():
            print(f"[!] Warning: tests/data.json not found at {DATA_JSON_PATH}")
        else:
            size_mb = DATA_JSON_PATH.stat().st_size / (1024 * 1024)
            print(f"[*] Found tests/data.json dataset ({size_mb:.2f} MB).")

            # Ingest records from tests/data.json into local SQLite database
            print(f"[*] Ingesting up to {max_records} samples from data.json into memoradb.db...")
            new_records = ingest_data_json_into_db(db, max_records=max_records)
            print(f"[OK] Ingested {new_records} new verified records from data.json into the local database.")

        # 3. Check total verified examples in database
        total_examples = db.query(ErrorClassificationExample).filter_by(is_verified=True).count()
        print(f"[*] Total verified training examples in local database: {total_examples}")

        # Show label distribution
        labels = {}
        for row in db.query(ErrorClassificationExample.error_type).filter_by(is_verified=True).all():
            lbl = row[0]
            labels[lbl] = labels.get(lbl, 0) + 1
        print("\n[*] Dataset Class Distribution:")
        for lbl, count in sorted(labels.items(), key=lambda x: -x[1]):
            print(f"    - {lbl}: {count} samples")

        # 4. Run Model Training Pipeline
        print("\n[*] Training TF-IDF + Logistic Regression Classifier on the local dataset...")
        result = train_error_classifier(db)
        print(f"[OK] Training Completed: {result}")
        print(f"[OK] Model Artifact Saved At: {MODEL_PATH}")

        # 5. Run Live Inference Verification
        print("\n[*] Testing Model Inference on New Code Snippets:")
        test_cases = [
            ("int* data = NULL; *data = 42;", "C Null Pointer"),
            ("items = [1, 2]; x = items[99]", "Python Out of Bounds"),
            ("fp = open('test.txt'); data = fp.read()", "Python Resource Leak"),
            ("def binary_search(arr, target): mid = (left + right) // 2", "Python Binary Search"),
            ("def solve(x): return solve(x + 1)", "Python Infinite Recursion")
        ]

        for snippet, desc in test_cases:
            pred = predict_error_type(snippet, db)
            print(f"  - [{desc}] -> Predicted Label: {pred}")

        print("\n[OK] Model successfully trained on tests/data.json and ready for production!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_and_train()
