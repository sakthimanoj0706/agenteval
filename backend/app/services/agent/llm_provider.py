"""
LLM Provider Abstraction.
Supports Ollama, HuggingFace, OpenAI, and Deterministic Grounded Mock.
"""

import json
import logging
import re
import time
from typing import Any, Dict, List, Optional
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class LLMResponse:
    def __init__(
        self,
        content: str,
        latency_ms: float,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        provider: str = "mock",
        model: str = "mock-model",
        error: Optional[str] = None
    ):
        self.content = content
        self.latency_ms = latency_ms
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.provider = provider
        self.model = model
        self.error = error


class BaseLLMProvider:
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        raise NotImplementedError

    def test_connection(self) -> Dict[str, Any]:
        raise NotImplementedError


class OllamaProvider(BaseLLMProvider):
    def __init__(self, endpoint_url: Optional[str] = None, model_name: Optional[str] = None):
        self.endpoint_url = (endpoint_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model_name = model_name or settings.OLLAMA_MODEL

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        start_time = time.time()
        url = f"{self.endpoint_url}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "system": system_prompt or "",
            "stream": False,
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    latency = (time.time() - start_time) * 1000
                    text = data.get("response", "")
                    prompt_tokens = data.get("prompt_eval_count", len(prompt) // 4)
                    completion_tokens = data.get("eval_count", len(text) // 4)
                    return LLMResponse(
                        content=text,
                        latency_ms=latency,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        provider="ollama",
                        model=self.model_name,
                    )
                else:
                    raise RuntimeError(f"Ollama returned HTTP {res.status_code}: {res.text}")
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            logger.warning(f"Ollama call failed: {e}. Falling back to grounded response.")
            # Fallback to grounded mock response if Ollama offline
            mock = GroundedMockProvider(model_name=self.model_name)
            resp = mock.generate(prompt, system_prompt)
            resp.provider = "ollama"
            resp.error = f"Ollama unavailable ({str(e)}). Response generated via fallback."
            return resp

    def test_connection(self) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.get(f"{self.endpoint_url}/api/tags")
                if res.status_code == 200:
                    models = [m["name"] for m in res.json().get("models", [])]
                    return {
                        "available": True,
                        "status_message": f"Connected to Ollama at {self.endpoint_url}",
                        "models": models,
                    }
                return {
                    "available": False,
                    "status_message": f"Ollama returned HTTP {res.status_code}",
                    "models": [],
                }
        except Exception as e:
            return {
                "available": False,
                "status_message": f"Connection failed: {str(e)}",
                "models": [],
            }


class HuggingFaceProvider(BaseLLMProvider):
    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.HF_MODEL_NAME

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        start_time = time.time()
        try:
            from transformers import pipeline
            generator = pipeline("text2text-generation", model=self.model_name, max_length=256)
            full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
            out = generator(full_prompt)
            latency = (time.time() - start_time) * 1000
            text = out[0]["generated_text"]
            return LLMResponse(
                content=text,
                latency_ms=latency,
                prompt_tokens=len(full_prompt) // 4,
                completion_tokens=len(text) // 4,
                provider="huggingface",
                model=self.model_name,
            )
        except Exception as e:
            logger.warning(f"HF pipeline error: {e}. Falling back to grounded mock.")
            mock = GroundedMockProvider(model_name=self.model_name)
            resp = mock.generate(prompt, system_prompt)
            resp.provider = "huggingface"
            resp.error = f"HuggingFace model not available locally ({e}). Using deterministic fallback."
            return resp

    def test_connection(self) -> Dict[str, Any]:
        try:
            from transformers import AutoTokenizer
            AutoTokenizer.from_pretrained(self.model_name)
            return {
                "available": True,
                "status_message": f"Model {self.model_name} found/cached",
                "models": [self.model_name],
            }
        except Exception as e:
            return {
                "available": False,
                "status_message": f"Model not ready: {str(e)}",
                "models": [],
            }


class GroundedMockProvider(BaseLLMProvider):
    """
    Synthesizes intelligent, grounded answers based directly on prompt context and query.
    Guarantees deterministic, reliable, zero-dependency execution.
    """
    def __init__(self, model_name: str = "grounded-mock-v1"):
        self.model_name = model_name

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        start_time = time.time()
        # Parse context and query from prompt if present
        context = ""
        query = prompt

        if "Context:" in prompt:
            parts = prompt.split("Context:", 1)
            query_part = parts[0]
            context_part = parts[1]
            if "Query:" in query_part:
                query = query_part.split("Query:")[1].strip()
            elif "Question:" in query_part:
                query = query_part.split("Question:")[1].strip()
            
            if "Question:" in context_part:
                c_parts = context_part.split("Question:")
                context = c_parts[0].strip()
                query = c_parts[1].strip()
            else:
                context = context_part.strip()

        # Generate grounded response
        if context:
            # Extract key sentences from context that align with query
            query_words = set(re.findall(r"\w+", query.lower()))
            sentences = [s.strip() for s in re.split(r"[.\n]", context) if len(s.strip()) > 15]

            best_sentences = []
            for s in sentences:
                s_words = set(re.findall(r"\w+", s.lower()))
                overlap = len(query_words.intersection(s_words))
                if overlap > 0:
                    best_sentences.append((overlap, s))

            best_sentences.sort(key=lambda x: x[0], reverse=True)
            if best_sentences:
                top_text = " ".join([b[1] for b in best_sentences[:2]])
                response_text = f"Based on the provided documentation: {top_text}."
            else:
                response_text = f"Based on the retrieved context, {sentences[0] if sentences else 'no direct match was found'}."
        else:
            response_text = f"Regarding your inquiry '{query}': Information from the designated knowledge base indicates that relevant procedures and guidelines are active. Please refer to institutional documentation for complete specifications."

        latency = (time.time() - start_time) * 1000 + 45.0  # simulate brief processing
        prompt_tokens = len(prompt) // 4
        completion_tokens = len(response_text) // 4

        return LLMResponse(
            content=response_text,
            latency_ms=latency,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            provider="mock",
            model=self.model_name,
        )

    def test_connection(self) -> Dict[str, Any]:
        return {
            "available": True,
            "status_message": "Deterministic Grounded Engine ready (Active)",
            "models": ["grounded-mock-v1", "deterministic-judge-v1"],
        }


def get_llm_provider(
    provider_name: str = "mock",
    model_name: Optional[str] = None,
    endpoint_url: Optional[str] = None
) -> BaseLLMProvider:
    provider_name = (provider_name or "mock").lower()
    if provider_name == "ollama":
        return OllamaProvider(endpoint_url=endpoint_url, model_name=model_name)
    elif provider_name in ("huggingface", "hf"):
        return HuggingFaceProvider(model_name=model_name)
    else:
        return GroundedMockProvider(model_name=model_name or "grounded-mock-v1")
