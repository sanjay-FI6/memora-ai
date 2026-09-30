from sqlalchemy import Table, Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .session import Base

# Many-to-Many association mapping for submissions and detected error clusters
submission_error_association = Table(
    "submission_error_association",
    Base.metadata,
    Column("submission_db_id", Integer, ForeignKey("code_submissions.id", ondelete="CASCADE"), primary_key=True),
    Column("error_cluster_db_id", Integer, ForeignKey("error_clusters.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    submissions = relationship("CodeSubmission", back_populates="user", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath", back_populates="user", cascade="all, delete-orphan")


class CodeSubmission(Base):
    __tablename__ = "code_submissions"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(String, unique=True, index=True, nullable=False)
    user_code = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    programming_language = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # ForeignKey relationships
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="submissions")
    error_clusters = relationship(
        "ErrorCluster",
        secondary=submission_error_association,
        back_populates="submissions"
    )


class ErrorCluster(Base):
    __tablename__ = "error_clusters"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    severity = Column(String, nullable=False)  # "high", "medium", "low"
    attempts = Column(Integer, default=1)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    submissions = relationship(
        "CodeSubmission",
        secondary=submission_error_association,
        back_populates="error_clusters"
    )


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    progress = Column(Integer, default=0)  # Integer percentage (0 to 100)
    duration = Column(String, nullable=False)  # e.g. "15 mins"
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ForeignKey relationships
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="learning_paths")


class ErrorClassificationExample(Base):
    __tablename__ = "error_classification_examples"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_submission_id = Column(String, nullable=False, index=True)
    programming_language = Column(String, nullable=False)
    user_code = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    error_type = Column(String, nullable=False, index=True)
    pattern_cluster = Column(String, nullable=False)
    concept_gap = Column(Text, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
