"""
API module - aggregates all routers.
"""

from fastapi import APIRouter

from app.api.intelligence.router import router as intelligence_router
from app.api.ingestion.router import router as ingestion_router

# Create main API router
api_router = APIRouter(prefix="/api")

# Include sub-routers
api_router.include_router(intelligence_router)
api_router.include_router(ingestion_router)

__all__ = ["api_router"]
