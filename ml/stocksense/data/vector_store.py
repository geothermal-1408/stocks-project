"""
vector_store.py — FAISS / ChromaDB wrapper for RAG context retrieval.

Stores embeddings of historical window texts. At prediction time, retrieves
top-K similar historical windows and their actual outcomes — injected as
context for improved prediction accuracy.

This module is fully decoupled from any prediction model. It serves as
a standalone memory/retrieval layer (FAISS = memory) that any model
(Qwen for reasoning, LSTM for forecasting) can query.

Uses: sentence-transformers/all-MiniLM-L6-v2 for embeddings.
"""

import json
import logging
import os
import pickle
from typing import List, Dict, Optional

import numpy as np

logger = logging.getLogger(__name__)

VECTOR_STORE_PATH = os.environ.get("VECTOR_STORE_PATH", "./data/vector_store")
VECTOR_STORE_TYPE = os.environ.get("VECTOR_STORE_TYPE", "faiss")
VECTOR_STORE_TOP_K = int(os.environ.get("VECTOR_STORE_TOP_K", "5"))

# Lazy-loaded embedding model
_embedding_model = None


def _get_embedding_model():
    """Lazy-load sentence-transformers embedding model."""
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model
    try:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Loaded all-MiniLM-L6-v2 embedding model")
    except ImportError:
        logger.warning("sentence-transformers not installed")
        _embedding_model = None
    return _embedding_model


def _embed_text(text: str) -> Optional[np.ndarray]:
    """Embed a single text string."""
    model = _get_embedding_model()
    if model is None:
        return None
    return model.encode(text, normalize_embeddings=True)


class VectorStore:
    """Wraps FAISS (local, fast) or ChromaDB (persistent).

    Stores embeddings of historical window texts with metadata.
    At prediction time, retrieves top-K most similar windows
    and their subsequent actual prices.
    """

    def __init__(self, store_path: str = None, store_type: str = None,
                 top_k: int = None):
        self.store_path = store_path or VECTOR_STORE_PATH
        self.store_type = store_type or VECTOR_STORE_TYPE
        self.top_k = top_k or VECTOR_STORE_TOP_K
        self._index = None
        self._metadata: List[Dict] = []
        os.makedirs(self.store_path, exist_ok=True)

        if self.store_type == "faiss":
            self._init_faiss()
        else:
            self._init_chromadb()

    def _init_faiss(self):
        """Initialize or load FAISS index."""
        try:
            import faiss
            index_path = os.path.join(self.store_path, "faiss.index")
            meta_path = os.path.join(self.store_path, "metadata.pkl")

            if os.path.exists(index_path) and os.path.exists(meta_path):
                self._index = faiss.read_index(index_path)
                with open(meta_path, "rb") as f:
                    self._metadata = pickle.load(f)
                logger.info(f"Loaded FAISS index with {self._index.ntotal} vectors")
            else:
                # 384-dim for all-MiniLM-L6-v2
                self._index = faiss.IndexFlatIP(384)
                self._metadata = []
                logger.info("Created new FAISS index")
        except ImportError:
            logger.warning("faiss-cpu not installed — vector store disabled")
            self._index = None

    def _init_chromadb(self):
        """Initialize ChromaDB collection."""
        try:
            import chromadb
            client = chromadb.PersistentClient(path=self.store_path)
            self._collection = client.get_or_create_collection(
                name="stocksense_windows",
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("Initialized ChromaDB collection")
        except ImportError:
            logger.warning("chromadb not installed — vector store disabled")
            self._collection = None

    def add_window(self, window_text: str, next_day_close: float,
                   ticker: str = "", window_hash: str = "") -> None:
        """Index a verified clean window with its ground-truth outcome.

        Only clean (retain_buffer) windows should be added here.
        Poison windows must NEVER be added to the vector store.

        Args:
            window_text: The full enriched window text.
            next_day_close: Actual next-day close price.
            ticker: Stock ticker.
            window_hash: SHA-256 hash of the window.
        """
        embedding = _embed_text(window_text)
        if embedding is None:
            return

        metadata = {
            "window_text": window_text[:500],  # truncate for storage
            "next_day_close": next_day_close,
            "ticker": ticker,
            "window_hash": window_hash,
        }

        if self.store_type == "faiss" and self._index is not None:
            vec = embedding.reshape(1, -1).astype(np.float32)
            self._index.add(vec)
            self._metadata.append(metadata)
        elif self.store_type == "chromadb" and hasattr(self, "_collection") and self._collection is not None:
            doc_id = window_hash or f"win_{len(self._metadata)}"
            self._collection.add(
                embeddings=[embedding.tolist()],
                documents=[window_text[:500]],
                metadatas=[{"next_day_close": next_day_close, "ticker": ticker}],
                ids=[doc_id],
            )

    def retrieve_similar(self, query_text: str, k: int = None) -> List[Dict]:
        """Return top-K similar historical windows + their actual outcomes.

        Args:
            query_text: Current window text to find similar patterns for.
            k: Number of results (defaults to self.top_k).

        Returns:
            List of dicts with keys: window_text, next_day_close, score, ticker.
        """
        k = k or self.top_k
        embedding = _embed_text(query_text)
        if embedding is None:
            return []

        if self.store_type == "faiss" and self._index is not None:
            if self._index.ntotal == 0:
                return []
            vec = embedding.reshape(1, -1).astype(np.float32)
            actual_k = min(k, self._index.ntotal)
            scores, indices = self._index.search(vec, actual_k)
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx < len(self._metadata):
                    meta = self._metadata[idx].copy()
                    meta["score"] = float(score)
                    results.append(meta)
            return results

        elif self.store_type == "chromadb" and hasattr(self, "_collection") and self._collection is not None:
            resp = self._collection.query(
                query_embeddings=[embedding.tolist()], n_results=k
            )
            results = []
            if resp["documents"]:
                for i, doc in enumerate(resp["documents"][0]):
                    meta = resp["metadatas"][0][i] if resp["metadatas"] else {}
                    results.append({
                        "window_text": doc,
                        "next_day_close": meta.get("next_day_close", 0),
                        "ticker": meta.get("ticker", ""),
                        "score": resp["distances"][0][i] if resp["distances"] else 0,
                    })
            return results

        return []

    def save(self) -> None:
        """Persist the index to disk."""
        if self.store_type == "faiss" and self._index is not None:
            import faiss
            index_path = os.path.join(self.store_path, "faiss.index")
            meta_path = os.path.join(self.store_path, "metadata.pkl")
            faiss.write_index(self._index, index_path)
            with open(meta_path, "wb") as f:
                pickle.dump(self._metadata, f)
            logger.info(f"Saved FAISS index ({self._index.ntotal} vectors)")

    @property
    def size(self) -> int:
        """Number of indexed vectors."""
        if self.store_type == "faiss" and self._index is not None:
            return self._index.ntotal
        if self.store_type == "chromadb" and hasattr(self, "_collection") and self._collection is not None:
            return self._collection.count()
        return 0
