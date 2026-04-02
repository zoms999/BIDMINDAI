from fastapi import FastAPI, Request
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.postgres import init_db, SessionLocal, AccessLog
from app.rag.indexer import init_qdrant
from app.middleware.security import SecurityMiddleware
import logging
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("access.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("access")

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

# Add Security Middleware (MUST be added before other middlewares)
app.add_middleware(
    SecurityMiddleware,
    enable_geo_blocking=True,  # 국내 IP만 허용
    enable_rate_limit=True      # Rate limiting 활성화
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Get IP address
    client_ip = request.client.host if request.client else "Unknown"
    
    # Check for X-Forwarded-For if behind proxy
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
        
    method = request.method
    url = request.url.path
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    status_code = response.status_code
    
    logger.info(f"IP: {client_ip} | Method: {method} | URL: {url} | Status: {status_code} | Time: {process_time:.4f}s")
    
    if SessionLocal:
        try:
            db = SessionLocal()
            log_entry = AccessLog(
                ip_address=client_ip,
                method=method,
                url=url,
                status_code=status_code,
                process_time=process_time
            )
            db.add(log_entry)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to save log to database: {e}")
        finally:
            if 'db' in locals():
                db.close()
    
    return response

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
