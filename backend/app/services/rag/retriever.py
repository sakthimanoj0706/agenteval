"""
FAISS Vector retrieval service.
Stores and searches document chunks for each project.
"""

import json
import logging
import os
from typing import Any, Dict, List, Tuple
import numpy as np

from app.config import settings
from app.services.rag.embeddings import embedding_service

logger = logging.getLogger(__name__)

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    logger.warning("faiss-cpu not installed or failed to import. Using NumPy cosine fallback.")


class ProjectRetriever:
    def __init__(self, project_id: int):
        self.project_id = project_id
        self.index_file = os.path.join(settings.INDEX_DIR, f"project_{project_id}.faiss")
        self.meta_file = os.path.join(settings.INDEX_DIR, f"project_{project_id}_meta.json")
        self.dimension = settings.EMBEDDING_DIMENSION
        self.chunk_ids: List[int] = []
        self.chunk_texts: List[str] = []
        self.doc_ids: List[int] = []
        self.index = None
        self._load_or_create()

    def _load_or_create(self):
        os.makedirs(settings.INDEX_DIR, exist_ok=True)
        if os.path.exists(self.meta_file):
            try:
                with open(self.meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    self.chunk_ids = meta.get("chunk_ids", [])
                    self.chunk_texts = meta.get("chunk_texts", [])
                    self.doc_ids = meta.get("doc_ids", [])
            except Exception as e:
                logger.error(f"Error loading index meta: {e}")

        if FAISS_AVAILABLE and os.path.exists(self.index_file):
            try:
                self.index = faiss.read_index(self.index_file)
            except Exception as e:
                logger.error(f"Error loading FAISS index: {e}")
                self._init_empty_index()
        else:
            self._init_empty_index()

    def _init_empty_index(self):
        if FAISS_AVAILABLE:
            # Inner product for normalized embeddings == Cosine Similarity
            self.index = faiss.IndexFlatIP(self.dimension)
        else:
            self.index = None

    def add_chunks(self, chunks: List[Dict[str, Any]]):
        """
        Add chunks to project index.
        chunks: list of dicts with 'id', 'content', 'document_id'
        """
        if not chunks:
            return

        texts = [c["content"] for c in chunks]
        embeddings = embedding_service.get_embeddings(texts)

        if FAISS_AVAILABLE and self.index is not None:
            self.index.add(embeddings)
        
        for c in chunks:
            self.chunk_ids.append(c["id"])
            self.chunk_texts.append(c["content"])
            self.doc_ids.append(c.get("document_id", 0))

        self.save()

    def save(self):
        os.makedirs(settings.INDEX_DIR, exist_ok=True)
        with open(self.meta_file, "w", encoding="utf-8") as f:
            json.dump({
                "chunk_ids": self.chunk_ids,
                "chunk_texts": self.chunk_texts,
                "doc_ids": self.doc_ids,
            }, f)

        if FAISS_AVAILABLE and self.index is not None:
            try:
                faiss.write_index(self.index, self.index_file)
            except Exception as e:
                logger.error(f"Failed to write FAISS index: {e}")

    def search(
        self,
        query: str,
        top_k: int = 5,
        similarity_threshold: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        Search for top-K matching chunks.
        Returns list of dicts with chunk_id, document_id, content, similarity_score, rank.
        """
        if not self.chunk_ids:
            return []

        query_vec = embedding_service.get_embedding(query).reshape(1, -1)
        results = []

        if FAISS_AVAILABLE and self.index is not None and self.index.ntotal > 0:
            k = min(top_k, self.index.ntotal)
            scores, indices = self.index.search(query_vec, k)
            for rank, (score, idx) in enumerate(zip(scores[0], indices[0]), start=1):
                if idx < 0 or idx >= len(self.chunk_ids):
                    continue
                score_val = float(score)
                if score_val >= similarity_threshold:
                    results.append({
                        "chunk_id": self.chunk_ids[idx],
                        "document_id": self.doc_ids[idx],
                        "content": self.chunk_texts[idx],
                        "similarity_score": round(max(0.0, min(1.0, score_val)), 4),
                        "rank": rank,
                    })
        else:
            # NumPy cosine similarity fallback
            if self.chunk_texts:
                chunk_vecs = embedding_service.get_embeddings(self.chunk_texts)
                scores = np.dot(chunk_vecs, query_vec.T).flatten()
                ranked_indices = np.argsort(scores)[::-1][:top_k]
                for rank, idx in enumerate(ranked_indices, start=1):
                    score_val = float(scores[idx])
                    if score_val >= similarity_threshold:
                        results.append({
                            "chunk_id": self.chunk_ids[idx],
                            "document_id": self.doc_ids[idx],
                            "content": self.chunk_texts[idx],
                            "similarity_score": round(max(0.0, min(1.0, score_val)), 4),
                            "rank": rank,
                        })

        return results

    def reset(self):
        """Clear the project's vector store index."""
        self.chunk_ids = []
        self.chunk_texts = []
        self.doc_ids = []
        self._init_empty_index()
        if os.path.exists(self.index_file):
            try:
                os.remove(self.index_file)
            except Exception:
                pass
        if os.path.exists(self.meta_file):
            try:
                os.remove(self.meta_file)
            except Exception:
                pass


def get_retriever(project_id: int) -> ProjectRetriever:
    return ProjectRetriever(project_id)
