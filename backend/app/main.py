import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.db_init import init_sqlite_schema
from app.api.router import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("metis.ai_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks (schema init) then yield for normal operation."""
    init_sqlite_schema()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    description=(
        "METIS AI Integration Backend: Enterprise-grade multimodal AI engine featuring "
        "Gemini Adaptive Remediation, Multimodal Scratchpad Vision OCR, Dysgraphia Voice Evaluation, "
        "and a 7-tier AI Runtime with cryptographic JWT gateway, input/output guardrails, "
        "hybrid vector & relational context retrieval, self-attention relevance weighting, "
        "prefix KV caching, and Server-Sent Events (SSE) streaming."
    ),
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register AI API router
app.include_router(api_router, prefix=settings.API_PREFIX)

FRONTEND_INDEX = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "out", "index.html")


@app.get("/demo", response_class=HTMLResponse)
async def ai_workbench_dashboard():
    """Serves the METIS frontend (Next.js static export) as the interactive workbench."""
    if os.path.exists(FRONTEND_INDEX):
        with open(FRONTEND_INDEX, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(
        "<h1>METIS AI Integration Engine is Running</h1>"
        "<p>Build the frontend first: <code>cd frontend &amp;&amp; npm run build</code></p>"
        "<p><a href='/docs'>Swagger API Docs</a></p>"
    )


@app.get("/api")
async def api_info():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "service_scope": "AI Integration Only",
        "capabilities": [
            "Gemini Multimodal Adaptive Remediation",
            "Physical Paper Scratchpad Vision OCR & Error Isolation",
            "Dysgraphia Voice Answer Evaluation",
            "7-Tier AI Runtime Engine (Auth Gateway, Guardrails, Hybrid Retrieval, Attention, KV Cache, SSE Streaming)"
        ],
        "endpoints": {
            "workbench_ui": "/",
            "docs": "/docs",
            "runtime_token": "/api/runtime/token",
            "runtime_stream": "/api/runtime/stream",
            "runtime_execute": "/api/runtime/execute",
            "runtime_cache_stats": "/api/runtime/cache-stats",
            "remediation_generate": "/api/remediation/generate",
            "scratchpad_ocr": "/api/scratchpad/ocr",
            "voice_evaluate": "/api/voice/evaluate"
        }
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AI Integration Backend",
        "version": settings.APP_VERSION
    }

# Mount the static frontend
FRONTEND_BUILD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "out")
app.mount("/", StaticFiles(directory=FRONTEND_BUILD_DIR, html=True), name="frontend")
