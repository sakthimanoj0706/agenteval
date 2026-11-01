"""
Application configuration using Pydantic Settings.
Reads from environment variables and .env file.
"""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with defaults for all configuration values."""

    # Application
    APP_NAME: str = "AI Agent Evaluation Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "sqlite:///./data/platform.db"

    # File Storage
    UPLOAD_DIR: str = "data/uploads"
    INDEX_DIR: str = "data/indexes"
    REPORT_DIR: str = "data/reports"
    MAX_UPLOAD_SIZE_MB: int = 50

    # Chunking
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 50

    # Embedding
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # Retrieval
    DEFAULT_TOP_K: int = 5
    SIMILARITY_THRESHOLD: float = 0.3

    # LLM Providers
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama2"
    HF_MODEL_NAME: str = "google/flan-t5-small"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-3.5-turbo"

    # Default LLM
    DEFAULT_PROVIDER: str = "mock"
    DEFAULT_MODEL: str = "mock-model"

    # Evaluation
    LLM_JUDGE_ENABLED: bool = False

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
