"""
interfaces.py — Protocol definitions for ML subsystem boundaries.

Defines the public API contracts for each major subsystem so that the
pipeline orchestrator (``cycle_manager``, ``ingest_loop``) depends on
interfaces rather than concrete implementations.

Subsystem boundaries:
    ┌──────────────────────────────────────────────────────────────┐
    │  pipeline/  (orchestration — imports from interfaces)       │
    │   └─ cycle_manager.py   └─ ingest_loop.py                  │
    ├──────────────────────────────────────────────────────────────┤
    │  data/      (ingestion, poison detection, buffer routing)   │
    │  training/  (unlearning, fine-tuning)                       │
    │  evaluation/(model evaluation, gates)                       │
    │  prediction/(inference, temperature sampling)               │
    └──────────────────────────────────────────────────────────────┘

Rules:
    • ``data/`` never imports from ``training/`` or ``prediction/``.
    • ``training/`` never imports from ``prediction/``.
    • ``prediction/`` never imports from ``training/``.
    • Only ``pipeline/`` may import across subsystem boundaries.
    • ``vector_store`` (FAISS) is isolated — only accessed via RAG
      endpoints, never during ingestion or cycle execution.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol, Tuple, runtime_checkable

import pandas as pd


# ── Data / Poison Detection ────────────────────────────────────────────

@runtime_checkable
class PoisonScreenerProtocol(Protocol):
    """Contract for poison/anomaly detection on OHLCV windows."""

    def is_poisoned(
        self,
        window_df: pd.DataFrame,
        config: "PoisonConfigProtocol",
    ) -> Tuple[bool, Optional[str]]:
        """Screen a window for anomalies.

        Args:
            window_df: DataFrame with columns [date, open, high, low, close, vol].
            config: Detection thresholds and rolling statistics.

        Returns:
            (is_poisoned, reason_string_or_None)
        """
        ...


@runtime_checkable
class PoisonConfigProtocol(Protocol):
    """Minimal config interface consumed by the screener."""

    sigma_thresh: float
    swing_thresh: float
    volume_spike_multiplier: float
    rolling_mean: Optional[float]
    rolling_std: Optional[float]
    rolling_vol_median: Optional[float]


# ── Data / Buffer Routing ──────────────────────────────────────────────

@runtime_checkable
class BufferRouterProtocol(Protocol):
    """Contract for routing windows into JSONL buffers."""

    def route_window(
        self,
        text: str,
        is_poisoned: bool,
        reason: Optional[str],
        data_base: str,
        meta: Optional[dict] = None,
    ) -> str:
        """Route a window to the appropriate buffer.

        Returns the path of the buffer file written to.
        """
        ...

    def count_buffer(self, filename: str, data_base: str) -> int:
        """Count JSONL entries in a buffer file."""
        ...


# ── Training / Unlearning ──────────────────────────────────────────────

@runtime_checkable
class UnlearnEngineProtocol(Protocol):
    """Contract for machine unlearning execution."""

    def run_unlearn(
        self,
        model_path: str,
        forget_data: str,
        retain_data: str,
        output_dir: str,
        method: str = "ascent_plus_descent",
        learning_rate: float = 5e-6,
        epochs: int = 1,
    ) -> None:
        """Execute unlearning on a model.

        Args:
            model_path: Path to the current model checkpoint.
            forget_data: Path to forget_buffer.jsonl.
            retain_data: Path to retain_buffer.jsonl.
            output_dir: Where to write the unlearned model.
            method: Unlearning algorithm name.
            learning_rate: Training learning rate.
            epochs: Number of training epochs.
        """
        ...


# ── Prediction / Inference ─────────────────────────────────────────────

@dataclass
class PredictionResult:
    """Structured prediction output."""

    ticker: str
    pred_date: str
    open: float
    high: float
    low: float
    close: float
    vol: float
    confidence_high: float
    confidence_low: float
    directional: str  # 'up' | 'down'
    model_cycle: int
    latency_ms: float

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "pred_date": self.pred_date,
            "prediction": {
                "open": self.open,
                "high": self.high,
                "low": self.low,
                "close": self.close,
                "vol": self.vol,
            },
            "confidence": {
                "close_high": self.confidence_high,
                "close_low": self.confidence_low,
            },
            "directional": self.directional,
            "model_cycle": self.model_cycle,
            "latency_ms": self.latency_ms,
        }


@runtime_checkable
class PredictorProtocol(Protocol):
    """Contract for stock price prediction."""

    def predict(
        self,
        window_text: str,
        ticker: str,
        prev_close: Optional[float],
        n_samples: int = 10,
    ) -> PredictionResult:
        """Generate a next-day OHLCV prediction.

        Args:
            window_text: Formatted window text (30 rows of OHLCV).
            ticker: Stock ticker symbol.
            prev_close: Previous day's close price for directional calc.
            n_samples: Number of temperature samples for confidence.

        Returns:
            PredictionResult with price forecast and confidence bands.
        """
        ...


# ── Vector Store (isolated — RAG only) ─────────────────────────────────

@runtime_checkable
class VectorStoreProtocol(Protocol):
    """Contract for vector similarity search (FAISS).

    NOTE: This is isolated from the pipeline. It is only used by RAG
    endpoints for context retrieval. Never imported in cycle_manager
    or ingest_loop.
    """

    def search(self, query: str, k: int = 5) -> list:
        """Search for similar documents.

        Args:
            query: Natural language query.
            k: Number of results to return.

        Returns:
            List of dicts with 'text', 'score', and metadata.
        """
        ...

    def add_documents(self, texts: list, metadata: Optional[list] = None) -> int:
        """Add documents to the vector store.

        Returns the number of documents added.
        """
        ...
