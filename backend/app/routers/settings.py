"""
Settings and Provider Configuration Router.
LLM endpoints, vector store status, embedding parameters, and connection testing.
"""

import json
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.models import ModelConfiguration
from app.schemas.schemas import ProviderTestRequest, ProviderStatusResponse, ModelConfigCreate
from app.services.agent.llm_provider import get_llm_provider

router = APIRouter(prefix="/api/settings", tags=["Settings & Providers"])


@router.get("/providers")
def get_providers_status():
    ollama = get_llm_provider("ollama")
    hf = get_llm_provider("huggingface")
    mock = get_llm_provider("mock")

    return {
        "providers": [
            {
                "id": "mock",
                "name": "Deterministic Grounded Engine",
                "description": "Zero-dependency deterministic fallback for ground-truth testing & evaluation.",
                "status": "active",
                "is_default": True,
            },
            {
                "id": "ollama",
                "name": "Ollama Local Daemon",
                "description": f"Local LLM runner connected at {settings.OLLAMA_BASE_URL}",
                "status": "configured",
                "endpoint_url": settings.OLLAMA_BASE_URL,
                "default_model": settings.OLLAMA_MODEL,
            },
            {
                "id": "huggingface",
                "name": "Hugging Face Local Transformers",
                "description": f"Transformer model pipeline using {settings.HF_MODEL_NAME}",
                "status": "configured",
                "default_model": settings.HF_MODEL_NAME,
            },
        ],
        "vector_store": {
            "type": "FAISS (IndexFlatIP Cosine)",
            "dimension": settings.EMBEDDING_DIMENSION,
            "embedding_model": settings.EMBEDDING_MODEL,
        }
    }


@router.post("/providers/test", response_model=ProviderStatusResponse)
def test_provider(req: ProviderTestRequest):
    provider = get_llm_provider(
        provider_name=req.provider,
        model_name=req.model_name,
        endpoint_url=req.endpoint_url
    )
    res = provider.test_connection()
    return ProviderStatusResponse(
        provider=req.provider,
        available=res.get("available", False),
        status_message=res.get("status_message", "Unknown status"),
        models=res.get("models", [])
    )


@router.get("/models")
def list_models(db: Session = Depends(get_db)):
    models = db.query(ModelConfiguration).all()
    # If empty, return standard defaults
    if not models:
        return [
            {"id": 1, "name": "Grounded Mock Engine", "provider": "mock", "model_name": "grounded-mock-v1", "is_default": True},
            {"id": 2, "name": "Llama 3.2 (Ollama)", "provider": "ollama", "model_name": "llama3.2", "is_default": False},
            {"id": 3, "name": "Flan-T5 Base (Hugging Face)", "provider": "huggingface", "model_name": "google/flan-t5-base", "is_default": False},
        ]
    return models


@router.post("/models", status_code=status.HTTP_201_CREATED)
def add_model_config(payload: ModelConfigCreate, db: Session = Depends(get_db)):
    cfg = ModelConfiguration(
        name=payload.name,
        provider=payload.provider,
        model_name=payload.model_name,
        endpoint_url=payload.endpoint_url,
        parameters=json.dumps(payload.parameters or {}),
        is_default=payload.is_default or False,
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.get("/general")
def get_general_settings():
    return {
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION,
        "chunk_size": settings.CHUNK_SIZE,
        "chunk_overlap": settings.CHUNK_OVERLAP,
        "default_top_k": settings.DEFAULT_TOP_K,
        "similarity_threshold": settings.SIMILARITY_THRESHOLD,
        "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_MB,
        "database_url": settings.DATABASE_URL,
    }
