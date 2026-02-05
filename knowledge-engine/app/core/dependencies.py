"""
FastAPI dependencies for dependency injection.
"""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db


# Type alias for database session dependency
DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_api_key() -> str:
    """
    Dependency to validate API key for inter-service communication.
    For Phase 1, this is a simple placeholder.
    """
    # TODO: Implement proper API key validation
    return "internal"


# Type alias for API key dependency
ApiKey = Annotated[str, Depends(get_current_api_key)]
