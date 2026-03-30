from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.postgres import init_db
from app.rag.indexer import init_qdrant

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_qdrant()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API for PDF RAG Chatbot System",
    lifespan=lifespan
)

# Set up CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

from app.api.documents import router as documents_router
from app.api.index import router as index_router
from app.api.search import router as search_router
from app.api.chat import router as chat_router
from app.api.generate import router as generate_router

app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(index_router, prefix="/api/documents/index", tags=["indexing"])
app.include_router(search_router, prefix="/api/search", tags=["search"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(generate_router, prefix="/api/generate", tags=["generate"])

@app.get("/health", tags=["system"])
async def health_check():
    """Service health check."""
    return {"status": "ok", "environment": settings.APP_ENV}

@app.get("/ready", tags=["system"])
async def readiness_check():
    """Dependencies connection check."""
    # In future sprints, check db connections here
    return {"status": "ready"}
