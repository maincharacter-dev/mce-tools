"""
Application configuration using Pydantic Settings.
All configuration is loaded from environment variables.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "MCE Knowledge Engine"
    app_version: str = "0.1.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    # Server
    host: str = "0.0.0.0"
    port: int = 3005

    # Database (PostgreSQL)
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/knowledge_engine"
    database_pool_size: int = 5
    database_max_overflow: int = 10

    # Pinecone (Vector Database)
    pinecone_api_key: str = ""
    pinecone_environment: str = ""
    pinecone_index_name: str = "mce-knowledge"

    # OpenAI (LLM)
    openai_api_key: str = ""
    openai_model: str = "gpt-4-turbo-preview"
    openai_embedding_model: str = "text-embedding-3-small"

    # AWS S3 (Document Storage)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-southeast-2"
    s3_bucket_name: str = "mce-knowledge-engine"

    # Security
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Cross-Platform Integration
    tatdd_engine_url: str = "http://localhost:3000"
    oe_toolkit_url: str = "http://localhost:3002"
    solar_analyzer_url: str = "http://localhost:3003"
    # Sprocket URL — for centralised LLM usage reporting
    sprocket_url: str = ""

    # Confidence Scoring Thresholds
    confidence_high_threshold: float = 0.8
    confidence_medium_threshold: float = 0.5
    min_projects_for_high_confidence: int = 20
    min_projects_for_medium_confidence: int = 5

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Convenience export
settings = get_settings()
