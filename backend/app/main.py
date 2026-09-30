from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.session import engine, Base
from app.routes.api import router as api_router

# Automatically initialize database schemas on FastAPI boot
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Memora AI Backend",
    description="AI-driven personal learning and error-analysis platform API",
    version="1.0.0"
)

# Enable CORS for Next.js frontend (http://localhost:3000)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"  # Allow additional local test runners
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the core API router with all /api/* routes
app.include_router(api_router)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Memora AI API",
        "version": "1.0.0",
        "docs_url": "/docs",
        "endpoints": ["/api/analyze", "/api/concept-map", "/api/recommendations"]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
