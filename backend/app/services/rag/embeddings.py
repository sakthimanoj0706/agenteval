"""
Embedding generation service with fallback mechanism.
Uses SentenceTransformers when available/cached, or deterministic embedding fallback.
"""

import hashlib
import logging
import math
from typing import List
import numpy as np

logger = logging.getLogger(__name__)

_model_instance = None
_model_failed = False


class EmbeddingService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", dimension: int = 384):
        self.model_name = model_name
        self.dimension = dimension
        self._load_model()

    def _load_model(self):
        global _model_instance, _model_failed
        if _model_instance is not None:
            self.model = _model_instance
            return

        if _model_failed:
            self.model = None
            return

        try:
            from sentence_transformers import SentenceTransformer
            # Try loading cached or download
            logger.info(f"Loading SentenceTransformer: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            _model_instance = self.model
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformer ({e}). Using deterministic embedding fallback.")
            self.model = None
            _model_failed = True

    def get_embedding(self, text: str) -> np.ndarray:
        """Generate embedding vector for a single string."""
        return self.get_embeddings([text])[0]

    def get_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate normalized embedding vectors for a list of strings."""
        if not texts:
            return np.empty((0, self.dimension), dtype=np.float32)

        if self.model is not None:
            try:
                embeddings = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
                return embeddings.astype(np.float32)
            except Exception as e:
                logger.warning(f"Inference error in SentenceTransformer: {e}. Falling back.")

        # Deterministic semantic-like fallback using token hash n-grams
        return self._deterministic_fallback_embeddings(texts)

    def _deterministic_fallback_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Deterministic, lightweight token & character n-gram hashing embedding.
        Captures term overlap and character similarity with cosine similarity.
        """
        embeddings = np.zeros((len(texts), self.dimension), dtype=np.float32)

        for i, text in enumerate(texts):
            clean_text = text.lower().strip()
            if not clean_text:
                continue

            words = clean_text.split()
            # Token feature hashing
            for word in words:
                # 3-char ngrams
                for k in range(max(1, len(word) - 2)):
                    ngram = word[k:k + 3]
                    h = int(hashlib.md5(ngram.encode("utf-8")).hexdigest(), 16)
                    idx = h % self.dimension
                    embeddings[i, idx] += 1.0

                # Full word hash
                h_word = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
                idx_w = h_word % self.dimension
                embeddings[i, idx_w] += 2.0

            # L2 normalize
            norm = np.linalg.norm(embeddings[i])
            if norm > 0:
                embeddings[i] = embeddings[i] / norm

        return embeddings


# Singleton instance
embedding_service = EmbeddingService()
