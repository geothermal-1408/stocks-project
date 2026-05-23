"""
main.py — FastAPI application entry point.

Registers all routers, CORS, startup/shutdown events.
"""

import sys
import os

# Add the ml directory to Python path for stocksense imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "ml"))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.session import engine
from app.db.init_db import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown logic."""
    # Startup
    await create_tables()
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="StockSense API",
    description=(
        "Stock prediction with super-learning & poison unlearning. "
        "Ingests live OHLCV data, detects poisoned windows, "
        "continuously unlearns bad patterns, and serves predictions."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Register Routers ---
from app.routers import predict, ingest, poison, metrics, admin, stream, auth, portfolio, investments_admin

app.include_router(auth.router, tags=["auth"])
app.include_router(predict.router, tags=["predict"])
app.include_router(ingest.router, tags=["ingest"])
app.include_router(poison.router, tags=["poison"])
app.include_router(metrics.router, tags=["metrics"])
app.include_router(admin.router, tags=["admin"])
app.include_router(stream.router, tags=["stream"])
app.include_router(portfolio.router, tags=["portfolio"])
app.include_router(investments_admin.router, tags=["admin-investments"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": False,  # Updated when predictor loads
        "ingest_running": False,
    }
