import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.session import Base, get_db
from app.db.models import User, CodeSubmission, ErrorCluster, ErrorClassificationExample
from app.training.dataset import load_verified_training_examples
from app.training.train_model import train_error_classifier
from app.training.predict import predict_error_type
from app.routes.api import router
from app.schemas.submission import CodeSubmissionBase, ProgrammingLanguage
from app.services.ai_engine import (
    generate_embeddings, 
    call_llm_analysis, 
    analyze_code_submission,
    get_or_create_default_user
)
from app.main import app

from sqlalchemy.pool import StaticPool

# --- Fixtures ---
@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for isolated pipeline testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(db_session):
    """FastAPI TestClient with overridden database dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# --- Unit Tests ---

def test_pydantic_schema_validation_success():
    """Verify valid code submission payload passes validation."""
    payload = {
        "submission_id": "test-uuid-1234",
        "user_code": "printf(\"%d\", root->val);",
        "stack_trace": "Segmentation fault (core dumped)",
        "programming_language": "c"
    }
    schema = CodeSubmissionBase(**payload)
    assert schema.submission_id == "test-uuid-1234"
    assert schema.programming_language == ProgrammingLanguage.c
    assert schema.user_code == "printf(\"%d\", root->val);"


def test_pydantic_schema_validation_invalid_language():
    """Verify unsupported programming languages raise ValidationError."""
    payload = {
        "submission_id": "test-uuid-1234",
        "user_code": "print('hello')",
        "stack_trace": None,
        "programming_language": "ruby" # Not in enum
    }
    with pytest.raises(ValidationError):
        CodeSubmissionBase(**payload)


def test_ai_engine_embedding_generation_dimensions():
    """Verify embedding generator outputs a 1536-dimensional float vector."""
    vector = generate_embeddings("Memory Allocation Invariants")
    assert isinstance(vector, list)
    assert len(vector) == 1536
    assert all(isinstance(val, float) for val in vector)


def test_ai_engine_llm_structured_output():
    """Verify Socratic LLM parser extracts required schema keys."""
    buggy_code = "printf(\"%d\", root->val);"
    stack_trace = "Segmentation fault (core dumped)"
    
    result = call_llm_analysis(buggy_code, stack_trace)
    assert "error_type" in result
    assert "pattern_cluster" in result
    assert "concept_gap" in result
    assert "socratic_hint" in result
    assert isinstance(result["concept_gap"], list)
    assert len(result["concept_gap"]) > 0


def test_analyze_code_submission_db_persistence(db_session):
    """Verify analyze_code_submission creates user, submission, and error clusters in database."""
    submission_id = "sub-test-999"
    user_code = "int* ptr = NULL; *ptr = 10;"
    stack_trace = "Null pointer dereference"
    lang = "c"

    result = analyze_code_submission(
        submission_id=submission_id,
        user_code=user_code,
        stack_trace=stack_trace,
        programming_language=lang,
        db=db_session
    )

    assert result["status"] == "success"
    assert result["programming_language"] == "c"
    assert "error_type" in result
    assert "socratic_hint" in result

    # Check persistence in SQLite
    saved_sub = db_session.query(CodeSubmission).filter_by(submission_id=submission_id).first()
    assert saved_sub is not None
    assert saved_sub.user_code == user_code
    assert len(saved_sub.error_clusters) >= 1

    saved_cluster = saved_sub.error_clusters[0]
    assert saved_cluster.title == result["error_type"]
    assert saved_cluster.attempts >= 1


def test_training_example_model_persistence(db_session):
    """Verify we can persist labeled training examples for the code-error classifier."""
    user = User(
        username="trainer_user",
        email="trainer@example.com",
        hashed_password="hashed",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    example = ErrorClassificationExample(
        user_id=user.id,
        source_submission_id="sub-training-1",
        programming_language="c",
        user_code="int *ptr = NULL; *ptr = 10;",
        stack_trace="Segmentation fault",
        error_type="Null Pointer Dereference",
        pattern_cluster="Unchecked Reference Access",
        concept_gap="[\"Pointers\", \"Defensive Programming\"]",
        is_verified=True,
        reviewer_notes="Null-check before dereference"
    )
    db_session.add(example)
    db_session.commit()
    db_session.refresh(example)

    saved = db_session.query(ErrorClassificationExample).filter_by(id=example.id).first()
    assert saved is not None
    assert saved.error_type == "Null Pointer Dereference"
    assert saved.is_verified is True
    assert saved.user_id == user.id


def test_load_verified_training_examples(db_session):
    """Verify verified examples can be loaded into a model-ready list of text/label pairs."""
    user = User(
        username="dataset_user",
        email="dataset@example.com",
        hashed_password="hashed",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    db_session.add_all([
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-training-2",
            programming_language="c",
            user_code="int *ptr = NULL; *ptr = 10;",
            stack_trace="Segmentation fault",
            error_type="Null Pointer Dereference",
            pattern_cluster="Unchecked Reference Access",
            concept_gap="[\"Pointers\"]",
            is_verified=True,
            reviewer_notes="ok"
        ),
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-training-3",
            programming_language="python",
            user_code="x = None\nprint(x.lower())",
            stack_trace="AttributeError",
            error_type="AttributeError",
            pattern_cluster="None Handling",
            concept_gap="[\"None checks\"]",
            is_verified=False,
            reviewer_notes="pending review"
        )
    ])
    db_session.commit()

    training_rows = load_verified_training_examples(db_session)
    assert isinstance(training_rows, list)
    assert len(training_rows) == 1
    assert training_rows[0]["label"] == "Null Pointer Dereference"
    assert "int *ptr = NULL" in training_rows[0]["text"]


def test_train_error_classifier_creates_model_bundle(db_session):
    """Verify the training pipeline can fit a lightweight text classifier from verified examples."""
    user = User(
        username="trainer_model_user",
        email="modeltrainer@example.com",
        hashed_password="hashed",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    db_session.add_all([
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-train-1",
            programming_language="c",
            user_code="int *ptr = NULL; *ptr = 10;",
            stack_trace="Segmentation fault",
            error_type="Null Pointer Dereference",
            pattern_cluster="Unchecked Reference Access",
            concept_gap="[\"Pointers\"]",
            is_verified=True,
            reviewer_notes="OK"
        ),
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-train-2",
            programming_language="c",
            user_code="char *buf = malloc(10); free(buf); *buf = 'x';",
            stack_trace="Use after free",
            error_type="Use After Free",
            pattern_cluster="Lifetime Management",
            concept_gap="[\"Memory Management\"]",
            is_verified=True,
            reviewer_notes="OK"
        ),
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-train-3",
            programming_language="python",
            user_code="x = None\nprint(x.lower())",
            stack_trace="AttributeError",
            error_type="AttributeError",
            pattern_cluster="None Handling",
            concept_gap="[\"None checks\"]",
            is_verified=True,
            reviewer_notes="OK"
        ),
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-train-4",
            programming_language="python",
            user_code="items = [1,2,3]\nprint(items[5])",
            stack_trace="IndexError",
            error_type="IndexError",
            pattern_cluster="Bounds Validation",
            concept_gap="[\"List indexing\"]",
            is_verified=True,
            reviewer_notes="OK"
        )
    ])
    db_session.commit()

    result = train_error_classifier(db_session)
    assert result["status"] == "trained"
    assert "model_path" in result
    assert result["num_classes"] >= 2
    assert result["accuracy"] >= 0.0


def test_predict_error_type_uses_saved_model(db_session):
    """Verify we can load the saved model and predict the error type from code text."""
    user = User(
        username="predict_user",
        email="predict@example.com",
        hashed_password="hashed",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    db_session.add_all([
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-predict-1",
            programming_language="c",
            user_code="int *ptr = NULL; *ptr = 10;",
            stack_trace="Segmentation fault",
            error_type="Null Pointer Dereference",
            pattern_cluster="Unchecked Reference Access",
            concept_gap="[\"Pointers\"]",
            is_verified=True,
            reviewer_notes="OK"
        ),
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-predict-2",
            programming_language="c",
            user_code="char *buf = malloc(10); free(buf); *buf = 'x';",
            stack_trace="Use after free",
            error_type="Use After Free",
            pattern_cluster="Lifetime Management",
            concept_gap="[\"Memory Management\"]",
            is_verified=True,
            reviewer_notes="OK"
        )
    ])
    db_session.commit()
    train_error_classifier(db_session)

    prediction = predict_error_type("int *ptr = NULL; *ptr = 10;", db_session)
    assert prediction is not None
    assert isinstance(prediction, str)
    assert "Null" in prediction or "Pointer" in prediction or "Use" in prediction


def test_admin_retrain_endpoint(client, db_session):
    """Verify an admin retraining endpoint returns training metadata and a model artifact path."""
    user = User(
        username="admin_retrain_user",
        email="admintrain@example.com",
        hashed_password="hashed",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    db_session.add_all([
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-admin-1",
            programming_language="c",
            user_code="int *ptr = NULL; *ptr = 10;",
            stack_trace="Segmentation fault",
            error_type="Null Pointer Dereference",
            pattern_cluster="Unchecked Reference Access",
            concept_gap="[\"Pointers\"]",
            is_verified=True,
            reviewer_notes="OK"
        ),
        ErrorClassificationExample(
            user_id=user.id,
            source_submission_id="sub-admin-2",
            programming_language="python",
            user_code="x = None\nprint(x.lower())",
            stack_trace="AttributeError",
            error_type="AttributeError",
            pattern_cluster="None Handling",
            concept_gap="[\"None checks\"]",
            is_verified=True,
            reviewer_notes="OK"
        )
    ])
    db_session.commit()

    response = client.post("/api/admin/retrain-model")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"trained", "not_enough_data"}
    assert "model_path" in body


def test_fastapi_health_endpoint(client):
    """Verify /health route returns healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_fastapi_concept_map_endpoint(client):
    """Verify GET /api/concept-map returns node and edge graph data."""
    response = client.get("/api/concept-map")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 3


def test_fastapi_recommendations_endpoint(client):
    """Verify GET /api/recommendations returns targeted recommendation list."""
    response = client.get("/api/recommendations")
    assert response.status_code == 200
    recommendations = response.json()
    assert isinstance(recommendations, list)
    assert len(recommendations) >= 1
    assert "title" in recommendations[0]
    assert "progress" in recommendations[0]


def test_fastapi_analyze_endpoint(client):
    """Verify POST /api/analyze end-to-end endpoint execution."""
    payload = {
        "submission_id": "api-test-001",
        "user_code": "void test() { Node* root = NULL; root->val = 5; }",
        "stack_trace": "SIGSEGV address 0x0",
        "programming_language": "c"
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert len(res_data["error_clusters"]) >= 1
    assert len(res_data["recommendations"]) >= 1
    assert "socratic_hint" in res_data
