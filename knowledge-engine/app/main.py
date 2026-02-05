"""
MCE Knowledge Engine - Main FastAPI Application

A continuously learning system for renewable energy project intelligence.
Captures de-identified learnings and provides cross-platform intelligence.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import settings
from app.core.database import init_db, close_db
from app.tasks import setup_scheduler, start_scheduler, stop_scheduler

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting MCE Knowledge Engine...")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug mode: {settings.debug}")

    # Initialize database
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        # Continue anyway for development

    # Setup and start scheduler
    setup_scheduler()
    start_scheduler()

    logger.info("MCE Knowledge Engine started successfully")

    yield

    # Shutdown
    logger.info("Shutting down MCE Knowledge Engine...")
    stop_scheduler()
    await close_db()
    logger.info("MCE Knowledge Engine shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="""
    ## MCE Knowledge Engine
    
    A continuously learning system that captures de-identified learnings from 
    renewable energy projects and provides cross-platform intelligence.
    
    ### Features
    
    - **Risk Intelligence**: Smarter risk identification based on historical outcomes
    - **Benchmarking Intelligence**: Better cost/schedule estimates with confidence scores
    - **Design Standard Intelligence**: Design review insights based on standard usage patterns
    - **Site Condition Intelligence**: Risk assessment based on ground/hydrology/climate
    - **Equipment Intelligence**: Equipment recommendations based on reliability data
    
    ### Data Sources
    
    - TA/TDD Engine
    - OE Design Review Engine
    - Solar Analyzer
    - Operations Monitoring
    - Project Completion Data
    """,
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # TA/TDD Engine
        "http://localhost:3002",  # OE Toolkit
        "http://localhost:3003",  # Solar Analyzer
        "http://localhost:3004",  # Other tools
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router)


# =============================================================================
# Root Endpoints
# =============================================================================


@app.get("/")
async def root() -> dict:
    """Root endpoint with basic info."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs" if settings.is_development else "disabled",
    }


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.environment,
    }


# =============================================================================
# Error Handlers
# =============================================================================


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": str(exc) if settings.debug else "An error occurred",
        },
    )


# =============================================================================
# Main Entry Point
# =============================================================================


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
        log_level=settings.log_level.lower(),
    )
