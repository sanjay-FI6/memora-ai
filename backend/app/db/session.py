import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Use SQLite for local development unless a database URL is explicitly provided.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./memoradb.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Connect to database engine and fall back to SQLite if PostgreSQL is unavailable.
try:
    if "postgresql" in DATABASE_URL:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True
        )
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    else:
        raise RuntimeError("No PostgreSQL database URL configured")
except Exception as e:
    print(f"Database fallback to SQLite: {e}")
    DATABASE_URL = "sqlite:///./memoradb.db"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

# SessionLocal is the session factory used to get individual db sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()

# Dependency utility to yield database sessions per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
