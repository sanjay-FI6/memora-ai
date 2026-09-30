import pickle
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.training.train_model import MODEL_PATH


def predict_error_type(code_text: str, db: Session) -> Optional[str]:
    """Load the saved classifier and predict the error type from code text."""
    model_path = Path(MODEL_PATH)
    if not model_path.exists():
        return None

    try:
        with open(model_path, "rb") as file:
            model = pickle.load(file)
    except Exception:
        return None

    prediction = model.predict([code_text])
    if len(prediction) == 0:
        return None

    return str(prediction[0])
