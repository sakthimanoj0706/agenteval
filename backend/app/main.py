"""
Main FastAPI Application Entrypoint.
Registers middleware, database initialization, error handlers, and all module routers.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import create_tables
from app.routers import (
    projects, documents, datasets, agent, evaluation,
    dashboard, comparison, failures, regression, settings as settings_router,
    demo, reports
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist
    logger.info("Initializing database schema...")
    create_tables()
    logger.info("Database initialized successfully.")
    yield
    # Shutdown
    logger.info("Application shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI Agent Evaluation and Observability Platform for Reliable RAG-Based Applications",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for flexible local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(datasets.router)
app.include_router(agent.router)
app.include_router(evaluation.router)
app.include_router(dashboard.router)
app.include_router(comparison.router)
app.include_router(failures.router)
app.include_router(regression.router)
app.include_router(settings_router.router)
app.include_router(demo.router)
app.include_router(reports.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc), "status": "error"}
    )
