"""
pipeline — Orchestration layer for the StockSense ML pipeline.

This package is the SOLE integration point that may import across
subsystem boundaries (data/, training/, evaluation/, prediction/).

Subsystem Boundary Rules:
    • data/       — Ingestion, windowing, poison detection, buffer routing.
                    NEVER imports from training/ or prediction/.
    • training/   — Unlearning and fine-tuning.
                    NEVER imports from prediction/.
    • evaluation/ — Model evaluation (PPL, MAE, MIA).
                    May read model artifacts but not call training.
    • prediction/ — Inference only.
                    NEVER imports from training/.
    • pipeline/   — Orchestrates all subsystems. Only package allowed
                    to import across boundaries.

See ``stocksense.interfaces`` for Protocol definitions.
"""

from .cycle_manager import CycleManager, passes_gates
from .ingest_loop import run_ingest
from .model_registry import ModelRegistry
