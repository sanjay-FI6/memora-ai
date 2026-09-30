from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime

class ProgrammingLanguage(str, Enum):
    c = "c"
    python = "python"
    java = "java"
    javascript = "javascript"

class CodeSubmissionBase(BaseModel):
    submission_id: str = Field(
        ..., 
        description="Unique client-side session identifier (UUID)"
    )
    user_code: str = Field(
        ..., 
        min_length=1,
        description="The source code contents of the script upload"
    )
    stack_trace: Optional[str] = Field(
        None, 
        description="Optional execution error stack trace or debug compiler logs"
    )
    programming_language: ProgrammingLanguage = Field(
        ..., 
        description="The programming language of the script (c, python, java, javascript)"
    )

class CodeSubmissionCreate(CodeSubmissionBase):
    user_id: int = Field(..., description="The database user ID submitting the code")

class CodeSubmissionResponse(CodeSubmissionBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        # Pydantic v2 standard configuration for ORM compatibility (equivalent to orm_mode = True in v1)
        from_attributes = True
