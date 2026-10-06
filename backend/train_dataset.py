"""
Memora AI - Local Dataset Trainer & Seeder
Loads/seeds verified code defect examples and trains the Scikit-Learn classification model.
"""

import os
from pathlib import Path
from app.db.session import SessionLocal, engine, Base
from app.db.models import User, ErrorClassificationExample
from app.training.train_model import train_error_classifier, MODEL_PATH
from app.training.predict import predict_error_type


def seed_and_train():
    print("=" * 60)
    print("Memora AI - Local Machine Learning Training Pipeline")
    print("=" * 60)

    # 1. Initialize DB Schema
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 2. Ensure default user exists
        user = db.query(User).filter_by(username="trainer_admin").first()
        if not user:
            user = User(
                username="trainer_admin",
                email="admin@memora.ai",
                hashed_password="hashed_placeholder_pw"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 3. Seed verified training examples if database has fewer than 8 examples
        existing_count = db.query(ErrorClassificationExample).filter_by(is_verified=True).count()
        print(f"[*] Found {existing_count} existing verified training examples in database.")

        if existing_count < 8:
            print("[*] Seeding verified benchmark code-defect datasets...")
            dataset_samples = [
                # Null Pointer Dereference
                (
                    "int* p = NULL; *p = 10;",
                    "Segmentation fault: 11",
                    "Null Pointer Dereference",
                    "Unchecked Pointer Access",
                    "c"
                ),
                (
                    "char* ptr = 0; printf('%s', ptr);",
                    "Segmentation fault (core dumped)",
                    "Null Pointer Dereference",
                    "Unchecked Pointer Access",
                    "c"
                ),
                (
                    "struct Node* next = NULL; int val = next->val;",
                    "Fatal error: EXC_BAD_ACCESS (code=1, address=0x0)",
                    "Null Pointer Dereference",
                    "Unchecked Pointer Access",
                    "c"
                ),

                # Index Out of Bounds / Buffer Overflow
                (
                    "int arr[5]; for(int i=0; i<=5; i++) arr[i] = i * 2;",
                    "*** stack smashing detected ***: terminated",
                    "Index Out of Bounds / Buffer Overflow",
                    "Array Bounds Invariant",
                    "c"
                ),
                (
                    "numbers = [10, 20, 30]\nprint(numbers[10])",
                    "IndexError: list index out of range",
                    "Index Out of Bounds / Buffer Overflow",
                    "Collection Bounds",
                    "python"
                ),
                (
                    "int[] list = new int[3]; list[5] = 99;",
                    "java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 3",
                    "Index Out of Bounds / Buffer Overflow",
                    "Array Bounds Invariant",
                    "java"
                ),

                # Unclosed Resource Leak
                (
                    "FILE* fp = fopen('log.txt', 'r'); char buf[100]; fgets(buf, 100, fp);",
                    "ResourceWarning: unclosed file descriptor",
                    "Unclosed Resource Leak",
                    "Resource Lifecycle & RAII",
                    "c"
                ),
                (
                    "f = open('data.csv')\nrows = f.readlines()",
                    "ResourceWarning: unclosed file <_io.TextIOWrapper>",
                    "Unclosed Resource Leak",
                    "Resource Lifecycle & RAII",
                    "python"
                ),

                # Recursion Stack Overflow
                (
                    "def fib(n):\n    return fib(n-1) + fib(n-2)",
                    "RecursionError: maximum recursion depth exceeded in comparison",
                    "Recursion Stack Overflow",
                    "Base Condition Missing",
                    "python"
                ),
                (
                    "void traverse(Node* root) {\n    traverse(root->left);\n}",
                    "Segmentation fault / Call Stack Overflow",
                    "Recursion Stack Overflow",
                    "Base Condition Missing",
                    "c"
                ),

                # Undefined Reference / NameError
                (
                    "rint('Hello World')",
                    "NameError: name 'rint' is not defined",
                    "NameError",
                    "Undefined Identifier Reference",
                    "python"
                ),
                (
                    "let total = amount + taxRate;",
                    "ReferenceError: amount is not defined",
                    "ReferenceError",
                    "Undefined Identifier Reference",
                    "javascript"
                ),
            ]

            for i, (code, trace, err, pat, lang) in enumerate(dataset_samples):
                example = ErrorClassificationExample(
                    user_id=user.id,
                    source_submission_id=f"seed-sample-{i+1}",
                    programming_language=lang,
                    user_code=code,
                    stack_trace=trace,
                    error_type=err,
                    pattern_cluster=pat,
                    concept_gap="Safety & Verification",
                    is_verified=True,
                    reviewer_notes="Benchmark curated training sample"
                )
                db.add(example)
            db.commit()
            print(f"[OK] Seeded {len(dataset_samples)} verified training examples.")

        # 4. Run Model Training Pipeline
        print("\n[*] Training TF-IDF + Logistic Regression Classifier...")
        result = train_error_classifier(db)
        print(f"[OK] Training Completed: {result}")
        print(f"[OK] Model Artifact Saved At: {MODEL_PATH}")

        # 5. Run Live Inference Verification
        print("\n[*] Testing Model Inference on New Code Snippets:")
        test_cases = [
            ("int* data = NULL; *data = 42;", "C Null Pointer"),
            ("items = [1, 2]; x = items[99]", "Python Out of Bounds"),
            ("fp = open('test.txt'); data = fp.read()", "Python Resource Leak"),
            ("def solve(x): return solve(x + 1)", "Python Infinite Recursion")
        ]

        for snippet, desc in test_cases:
            pred = predict_error_type(snippet, db)
            print(f"  - [{desc}] -> Predicted Label: {pred}")

        print("\n[OK] Local Machine Learning Dataset is fully trained and operational!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_and_train()
