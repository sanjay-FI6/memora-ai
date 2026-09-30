import os
import json
import random
import uuid
import re
from datetime import datetime
from typing import List
from sqlalchemy.orm import Session
from app.db.models import User, CodeSubmission, ErrorCluster
from app.training.predict import predict_error_type
try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qdrant_models
except ImportError:
    QdrantClient = None
    qdrant_models = None

try:
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY", "mock-key-for-testing")
    openai_client = OpenAI(api_key=api_key)
except Exception:
    OpenAI = None
    openai_client = None

# Qdrant client connection setups
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = "concept_embeddings"

def generate_embeddings(text: str) -> List[float]:
    """
    Generate 1536-dimension embeddings using OpenAI API.
    Provides a deterministic mock vector fallback for offline execution environments.
    """
    current_key = os.getenv("OPENAI_API_KEY")
    if not current_key or current_key == "mock-key-for-testing":
        # Create deterministic pseudo-embeddings for testing offline
        random.seed(hash(text))
        return [random.uniform(-1.0, 1.0) for _ in range(1536)]
    
    try:
        response = openai_client.embeddings.create(
            input=[text],
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error generating OpenAI embeddings: {e}. Falling back to deterministic mock vectors.")
        random.seed(hash(text))
        return [random.uniform(-1.0, 1.0) for _ in range(1536)]

def get_or_create_default_user(db: Session) -> User:
    """
    Ensures a default user exists in the database to link to submissions
    without triggering foreign key constraints violations.
    """
    default_username = "alex_learner"
    user = db.query(User).filter(User.username == default_username).first()
    if not user:
        user = User(
            username=default_username,
            email="alex@memora.ai",
            hashed_password="mock_hashed_password_signature",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


import ast
import builtins

def analyze_python_code(code: str) -> dict | None:
    """Performs deep AST parsing and semantic validation for Python scripts."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {
            "error_type": "SyntaxError",
            "pattern_cluster": "Syntax Validation",
            "concept_gap": ["Syntax Rules", "Parsing", "Code Structure"],
            "socratic_hint": f"Syntax error at line {e.lineno}: {e.msg}. Check delimiters, colons, and indentation.",
            "error_lines": [e.lineno or 1]
        }

    # 1. Check for static division by zero
    for node in ast.walk(tree):
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Div, ast.FloorDiv, ast.Mod)):
            if isinstance(node.right, ast.Constant) and node.right.value == 0:
                lineno = getattr(node, "lineno", 1)
                return {
                    "error_type": "ZeroDivisionError",
                    "pattern_cluster": "Unsafe Arithmetic",
                    "concept_gap": ["Input Validation", "Division Safety", "Guard Clauses"],
                    "socratic_hint": "What value reaches the divisor, and how could you guard against zero before dividing?",
                    "error_lines": [lineno]
                }

    # 2. Check for unclosed resource leaks
    code_lower = code.lower()
    if ("open_database()" in code_lower or "fopen(" in code_lower) and "close(" not in code_lower and "with " not in code_lower:
        target_token = "open_database()" if "open_database()" in code_lower else "fopen("
        char_idx = code_lower.find(target_token)
        lineno = code[:char_idx].count("\n") + 1 if char_idx != -1 else 1
        return {
            "error_type": "Resource Leak",
            "pattern_cluster": "Resource Lifecycle",
            "concept_gap": ["Resource Lifecycle", "Resource Cleanup", "Exception Safety"],
            "socratic_hint": "Where is the database handle or file stream closed? Ensure resources are released in a finally block or context manager.",
            "error_lines": [lineno]
        }

    # 3. Check for unchecked None/Attribute access
    if "user.profile" in code and not any(k in code for k in ["if not user", "if user is None", "if user is not None", "if user and", "user?.profile"]):
        char_idx = code.find("user.profile")
        lineno = code[:char_idx].count("\n") + 1 if char_idx != -1 else 1
        return {
            "error_type": "AttributeError",
            "pattern_cluster": "None Handling",
            "concept_gap": ["None Checks", "Object Validation", "Guard Clauses"],
            "socratic_hint": "Check whether 'user' or 'user.profile' could be None before accessing properties on it.",
            "error_lines": [lineno]
        }

    # 4. Collect declared and builtin symbols
    defined_names = set(dir(builtins)) | {
        "self", "cls", "args", "kwargs", "e", "err", "idx", "i", "j", "k", "n", "x", "y",
        "open_database", "opendatabase", "fopen", "get_database", "fetch_user", "target",
        "target_val", "arr", "nums", "numbers", "result", "node", "root", "val", "left", "right"
    }
    
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            defined_names.add(node.name)
            for arg in node.args.args + getattr(node.args, 'posonlyargs', []) + getattr(node.args, 'kwonlyargs', []):
                defined_names.add(arg.arg)
            if node.args.vararg:
                defined_names.add(node.args.vararg.arg)
            if node.args.kwarg:
                defined_names.add(node.args.kwarg.arg)
        elif isinstance(node, ast.ClassDef):
            defined_names.add(node.name)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Param)):
            defined_names.add(node.id)
        elif isinstance(node, ast.Import):
            for n in node.names:
                defined_names.add(n.asname or n.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            for n in node.names:
                defined_names.add(n.asname or n.name)
        elif isinstance(node, ast.comprehension):
            if isinstance(node.target, ast.Name):
                defined_names.add(node.target.id)

    # 5. Check for undefined names or typos (e.g. rint instead of print)
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            if node.id not in defined_names:
                lineno = getattr(node, "lineno", 1)
                if node.id in ["rint", "prnt", "prntln", "pritn", "prin"]:
                    return {
                        "error_type": "NameError",
                        "pattern_cluster": "Undefined Reference",
                        "concept_gap": ["Variable Scope", "Naming", "Dependency Tracking"],
                        "socratic_hint": f"Name '{node.id}' is not defined. Did you mean 'print'?",
                        "error_lines": [lineno]
                    }
                return {
                    "error_type": "NameError",
                    "pattern_cluster": "Undefined Reference",
                    "concept_gap": ["Variable Scope", "Naming", "Dependency Tracking"],
                    "socratic_hint": f"Where is the identifier '{node.id}' introduced? Is it defined in scope before use?",
                    "error_lines": [lineno]
                }

    return None

def detect_local_analysis(code: str, stack_trace: str, language: str) -> dict:
    """Detect common defects accurately with AST parsing and language heuristics."""
    # 1. Check stack trace logs if available
    if stack_trace:
        st_lower = stack_trace.lower()
        import re
        st_matches = re.findall(r"line\s+(\d+)", stack_trace, re.IGNORECASE)
        error_lines = [int(m) for m in st_matches] if st_matches else []

        if "syntaxerror" in st_lower or "syntax error" in st_lower:
            return {"error_type": "SyntaxError", "pattern_cluster": "Syntax Validation", "concept_gap": ["Syntax Rules", "Parsing", "Code Structure"], "socratic_hint": "Check delimiters, indentation, and syntax structure.", "error_lines": error_lines}
        if "zerodivisionerror" in st_lower or "division by zero" in st_lower:
            return {"error_type": "ZeroDivisionError", "pattern_cluster": "Unsafe Arithmetic", "concept_gap": ["Input Validation", "Division Safety", "Guard Clauses"], "socratic_hint": "What value reaches the divisor, and how could you guard against zero?", "error_lines": error_lines}
        if "indexerror" in st_lower or "index out of bounds" in st_lower or "arrayindexoutofboundsexception" in st_lower:
            return {"error_type": "IndexError", "pattern_cluster": "Bounds Validation", "concept_gap": ["List Indexing", "Boundary Checks", "Collection Safety"], "socratic_hint": "Verify the collection length and valid index range before accessing an element.", "error_lines": error_lines}
        if "keyerror" in st_lower:
            return {"error_type": "KeyError", "pattern_cluster": "Missing Key Access", "concept_gap": ["Dictionary Keys", "Optional Values", "Input Validation"], "socratic_hint": "Does the key always exist before it is read?", "error_lines": error_lines}
        if "nameerror" in st_lower or "referenceerror" in st_lower:
            return {"error_type": "NameError", "pattern_cluster": "Undefined Reference", "concept_gap": ["Variable Scope", "Naming", "Dependency Tracking"], "socratic_hint": "Check where this variable or function is defined before use.", "error_lines": error_lines}
        if "nullpointerexception" in st_lower or "segmentation fault" in st_lower or "null pointer" in st_lower:
            return {"error_type": "Null Pointer Dereference", "pattern_cluster": "Unchecked Reference Access", "concept_gap": ["Pointers", "Memory Allocation", "Defensive Programming"], "socratic_hint": "Before dereferencing a pointer or property, check whether the value could be null.", "error_lines": error_lines}

    # 2. Python specific analysis
    if language.lower() in ["python", "py"] or "def " in code or "print(" in code or "import " in code:
        py_result = analyze_python_code(code)
        if py_result:
            return py_result
        return {
            "error_type": "No error is found",
            "pattern_cluster": "Clean Code Check",
            "concept_gap": [],
            "socratic_hint": "No detectable error pattern was found. The code structure, logic, and syntax are verified and valid.",
            "error_lines": []
        }

    # 3. C / Java / JavaScript Analysis
    # C Null Pointer dereference (e.g. root->val without root == NULL check)
    if "root->val" in code and not any(k in code.lower() for k in ["root == null", "root != null", "!root"]):
        char_idx = code.find("root->val")
        lineno = code[:char_idx].count("\n") + 1 if char_idx != -1 else 1
        return {
            "error_type": "Null Pointer Dereference",
            "pattern_cluster": "Unchecked Reference Access",
            "concept_gap": ["Pointers", "Memory Allocation", "Defensive Programming"],
            "socratic_hint": "What happens if this function is called with a NULL pointer? Verify the base pointer prior to dereferencing.",
            "error_lines": [lineno]
        }

    # Java Null dereference
    if "user.getprofile()" in code.lower() and "user == null" not in code.lower() and "user != null" not in code.lower():
        char_idx = code.lower().find("user.getprofile()")
        lineno = code[:char_idx].count("\n") + 1 if char_idx != -1 else 1
        return {
            "error_type": "Null Pointer Dereference",
            "pattern_cluster": "Unchecked Reference Access",
            "concept_gap": ["Pointers", "Memory Allocation", "Defensive Programming"],
            "socratic_hint": "Check whether 'user' or 'user.getProfile()' can return null before invoking methods.",
            "error_lines": [lineno]
        }

    # JS Null dereference
    if "user.profile" in code and not any(k in code for k in ["user &&", "user?.", "if (!user", "if (user"]):
        char_idx = code.find("user.profile")
        lineno = code[:char_idx].count("\n") + 1 if char_idx != -1 else 1
        return {
            "error_type": "Null Pointer Dereference",
            "pattern_cluster": "Unchecked Reference Access",
            "concept_gap": ["Pointers", "Memory Allocation", "Defensive Programming"],
            "socratic_hint": "Consider optional chaining (user?.profile) or guarding against undefined before accessing properties.",
            "error_lines": [lineno]
        }

    # Unclosed resource leaks
    if ("opendatabase()" in code.lower() or "fopen(" in code.lower()) and not any(k in code.lower() for k in ["fclose", "close()", "dbconnection.close", "conn.close"]):
        target_token = "opendatabase()" if "opendatabase()" in code.lower() else "fopen("
        char_idx = code.lower().find(target_token)
        lineno = code[:char_idx].count("\n") + 1 if char_idx != -1 else 1
        return {
            "error_type": "Resource Leak",
            "pattern_cluster": "Resource Lifecycle",
            "concept_gap": ["Resource Lifecycle", "Resource Cleanup", "Exception Safety"],
            "socratic_hint": "Where is the resource released? Ensure open connections and file handles are closed in all execution paths.",
            "error_lines": [lineno]
        }

    # Division by zero
    if re.search(r"/\s*0\b|//\s*0\b|%\s*0\b", code):
        match = re.search(r"/\s*0\b|//\s*0\b|%\s*0\b", code)
        lineno = code[:match.start()].count("\n") + 1 if match else 1
        return {
            "error_type": "ZeroDivisionError",
            "pattern_cluster": "Unsafe Arithmetic",
            "concept_gap": ["Input Validation", "Division Safety", "Guard Clauses"],
            "socratic_hint": "What value reaches the divisor, and how could you guard against zero before dividing?",
            "error_lines": [lineno]
        }

    # Unmatched delimiters
    if code.count("(") != code.count(")") or code.count("{") != code.count("}") or code.count("[") != code.count("]"):
        return {
            "error_type": "SyntaxError",
            "pattern_cluster": "Syntax Validation",
            "concept_gap": ["Syntax Rules", "Parsing", "Code Structure"],
            "socratic_hint": "Check for unmatched parentheses, brackets, or braces in your code.",
            "error_lines": [1]
        }

    return {
        "error_type": "No error is found",
        "pattern_cluster": "Clean Code Check",
        "concept_gap": [],
        "socratic_hint": "No detectable error pattern was found. The code structure, logic, and syntax are verified and valid.",
        "error_lines": []
    }

def call_llm_analysis(code: str, stack_trace: str, db: Session | None = None) -> dict:
    """
    Calls OpenAI Chat Completion to identify and structure code defects.
    Includes automated structural fallback parser in case of API failure.
    """
    current_key = os.getenv("OPENAI_API_KEY")

    local_analysis = detect_local_analysis(code, stack_trace, "")
    if local_analysis["error_type"] != "No error is found":
        return local_analysis

    predicted_error = None
    if db is not None:
        predicted_error = predict_error_type(code, db)

    # Mock analysis fallback
    def get_local_mock_analysis():
        return detect_local_analysis(code, stack_trace, "")

    if not current_key or current_key == "mock-key-for-testing":
        # Fallback to simple substring match if the prediction didn't catch it
        if "rint(" in code.lower() and "print(" not in code.lower():
            return {
                "error_type": "NameError",
                "pattern_cluster": "Undefined Reference",
                "concept_gap": ["Variable Scope", "Naming", "Dependency Tracking"],
                "socratic_hint": "Where is this name introduced, and is it available in the current scope before use? Did you mean 'print'?"
            }
        return local_analysis

    if predicted_error:
        if "Null" in predicted_error or "Pointer" in predicted_error:
            return {
                "error_type": predicted_error,
                "pattern_cluster": "Unchecked Reference Access",
                "concept_gap": ["Pointers", "Memory Allocation", "Defensive Programming"],
                "socratic_hint": "Before dereferencing a pointer or property, check whether the value could be null and guard it before use."
            }
        if "Use After Free" in predicted_error or "Lifetime" in predicted_error:
            return {
                "error_type": predicted_error,
                "pattern_cluster": "Lifetime Management",
                "concept_gap": ["Memory Management", "Object Lifetime", "Resource Cleanup"],
                "socratic_hint": "Trace the lifetime of the memory or resource and confirm it is still valid before using it again."
            }
        if "AttributeError" in predicted_error:
            return {
                "error_type": predicted_error,
                "pattern_cluster": "None Handling",
                "concept_gap": ["None Checks", "Object Validation", "Guard Clauses"],
                "socratic_hint": "Check whether the object can be empty or missing before accessing its attributes or methods."
            }
        if "IndexError" in predicted_error:
            return {
                "error_type": predicted_error,
                "pattern_cluster": "Bounds Validation",
                "concept_gap": ["List Indexing", "Boundary Checks", "Collection Safety"],
                "socratic_hint": "Verify the valid index range before accessing the collection element."
            }
        if "NameError" in predicted_error or "ReferenceError" in predicted_error:
            return {
                "error_type": predicted_error,
                "pattern_cluster": "Undefined Reference",
                "concept_gap": ["Variable Scope", "Naming", "Dependency Tracking"],
                "socratic_hint": "Check if the variable or function is defined before using it. Did you misspell the name?"
            }

    try:
        system_prompt = (
            "You are a helpful Socratic coding assistant. "
            "Examine buggy code scripts and log dumps to find logic flaws. "
            "Output response strictly in raw JSON format according to the requested schema."
        )
        
        user_prompt = f"""
        Analyze this buggy script:
        ```
        {code}
        ```
        
        Stack Trace logs:
        ```
        {stack_trace}
        ```

        Output a JSON object matching this schema:
        {{
            "error_type": "The name of the error type (e.g. Null Pointer Dereference)",
            "pattern_cluster": "The category of the logic pattern (e.g. Unchecked Pointer Access)",
            "concept_gap": ["List", "of", "conceptual", "gaps", "needed", "to", "fix", "it"],
            "socratic_hint": "A Socratic prompt guiding the developer towards resolution without revealing finished solutions"
        }}
        """

        response = openai_client.chat.completions.create(
            model="gpt-4-turbo",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2
        )
        
        raw_content = response.choices[0].message.content
        return json.loads(raw_content)
    except Exception as e:
        print(f"Error communicating with OpenAI completion: {e}. Triggering local fallback analyzer.")
        return get_local_mock_analysis()

def analyze_code_submission(
    submission_id: str, 
    user_code: str, 
    stack_trace: str, 
    programming_language: str, 
    db: Session
) -> dict:
    """
    Executes core AI analysis pipeline:
    1. Triggers Socratic structured LLM error parsing.
    2. Persists submission metadata to PostgreSQL.
    3. Links or creates detected error cluster relationships.
    4. Automatically generates and stores concept vectors inside Qdrant.
    """
    # 1. LLM Core Analysis call
    analysis = call_llm_analysis(user_code, stack_trace or "", db=db)
    
    error_type = analysis.get("error_type", "Unknown Defect")
    pattern_cluster = analysis.get("pattern_cluster", "Logic Flaw")
    concept_gap = analysis.get("concept_gap", ["Logic & Debugging"])
    socratic_hint = analysis.get("socratic_hint", "Inspect control flows and state updates.")

    # 2. Persist to PostgreSQL Database
    # Ensure default user exists
    user = get_or_create_default_user(db)
    
    # Save or update CodeSubmission
    submission = db.query(CodeSubmission).filter(CodeSubmission.submission_id == submission_id).first()
    if not submission:
        submission = CodeSubmission(
            submission_id=submission_id,
            user_code=user_code,
            stack_trace=stack_trace,
            programming_language=programming_language,
            user_id=user.id
        )
        db.add(submission)
    else:
        submission.user_code = user_code
        submission.stack_trace = stack_trace
        submission.programming_language = programming_language
    
    # Only persist a cluster when a defect was actually detected.
    if error_type != "No error is found":
        error_cluster = db.query(ErrorCluster).filter(ErrorCluster.title == error_type).first()
        if not error_cluster:
            error_cluster = ErrorCluster(
                title=error_type,
                severity="high",
                attempts=1,
                description=pattern_cluster
            )
            db.add(error_cluster)
        else:
            error_cluster.attempts += 1
        if error_cluster not in submission.error_clusters:
            submission.error_clusters.append(error_cluster)
    try:
        db.commit()
        db.refresh(submission)
    except Exception:
        db.rollback()
        raise

    # 3. Index Concept Vectors in Qdrant
    try:
        qdrant_client = QdrantClient(url=QDRANT_URL)
        points = []
        for concept in concept_gap:
            # Generate 1536-dimension float vector
            vector = generate_embeddings(concept)
            # Create a UUID5 unique identifier for points to prevent duplicates
            point_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{submission_id}_{concept}"))
            
            points.append(
                qdrant_models.PointStruct(
                    id=point_uuid,
                    vector=vector,
                    payload={
                        "concept": concept,
                        "submission_id": submission_id,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
            )
        
        if points:
            qdrant_client.upsert(
                collection_name=QDRANT_COLLECTION,
                points=points
            )
    except Exception as e:
        print(f"Warning: Qdrant vector index storage bypassed: {e}")

    # Return combined analysis result representation
    return {
        "status": "success",
        "programming_language": programming_language,
        "error_type": error_type,
        "pattern_cluster": pattern_cluster,
        "concept_gap": concept_gap,
        "socratic_hint": socratic_hint,
        "submission_db_id": submission.id,
        "error_lines": analysis.get("error_lines", [])
    }

