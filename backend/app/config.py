"""
config.py — Application settings loaded from environment variables.
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration. All values can be overridden via env vars."""

    # --- Database ---
    DATABASE_URL: str = "sqlite+aiosqlite:///./stocksense.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Auth ---
    SECRET_KEY: str = "stocksense-dev-secret-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ADMIN_EMAIL: str = "admin@stocksense.local"
    ADMIN_PASSWORD: str = "admin"

    # --- Market Data ---
    TICKER: str = "AAPL"
    FETCH_PERIOD: str = "2y"
    WINDOW_SIZE: int = 30
    INGEST_CRON: str = "0 17 * * 1-5"

    # --- ML Pipeline ---
    MODEL_BASE_PATH: str = "../ml/models/Qwen1.5-0.5B"
    OUTPUT_BASE: str = "../ml/output/stock"
    DATA_BASE: str = "../ml/data"
    TOKENIZED_BASE: str = "../ml/tokenized_dataset"

    # --- Poison Detector ---
    POISON_SIGMA_THRESH: float = 3.0
    POISON_SWING_THRESH: float = 0.10
    POISON_VOL_MULTIPLIER: float = 5.0
    REGIME_CHANGE_ENABLED: bool = False

    # --- Unlearn Config ---
    FORGET_TRIGGER: int = 5
    MIN_RETAIN_SIZE: int = 20
    UNLEARN_METHOD: str = "ascent_plus_descent"
    LEARNING_RATE: float = 5e-6
    FINETUNE_EPOCHS: int = 1

    # --- Prediction ---
    PREDICTION_SAMPLES: int = 10
    PREDICTION_TEMPERATURE: float = 0.7

    # --- Misc ---
    WANDB_API_KEY: str = ""
    WANDB_MODE: str = "offline"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # --- Celery ---
    USE_CELERY: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
