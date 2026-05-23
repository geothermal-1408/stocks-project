"""
metrics_service.py — Reads eval JSONs + cycle_history.json for metrics API.
"""

import json
import logging
import os
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.cycle_record import CycleRecord

logger = logging.getLogger(__name__)


async def get_metrics(db: AsyncSession) -> dict:
    """Get current metrics, cycle history, and buffer status.

    Falls back to reading ml/output/logs/cycle_history.json when the DB
    has no cycle records (e.g. cycles run via CLI).  Returns None for
    metric values when no cycle has ever been run so the frontend can
    display '—' placeholder.
    """
    # Get latest deployed cycle from DB
    result = await db.execute(
        select(CycleRecord)
        .where(CycleRecord.deployed == True)
        .order_by(desc(CycleRecord.cycle_num))
        .limit(1)
    )
    latest_cycle = result.scalar_one_or_none()

    # Get cycle history from DB
    hist_result = await db.execute(
        select(CycleRecord).order_by(desc(CycleRecord.cycle_num)).limit(50)
    )
    history = hist_result.scalars().all()

    # Fallback: read cycle_history.json if DB is empty
    file_history = []
    if not history:
        file_history = _load_cycle_history_file()
        if file_history and not latest_cycle:
            # Use the latest deployed entry from the file
            for entry in reversed(file_history):
                if entry.get("deployed"):
                    latest_cycle = None  # keep None, use file entry below
                    break

    # Buffer status
    from stocksense.data.buffer_router import count_buffer

    forget_count = count_buffer("forget_buffer.jsonl", settings.DATA_BASE)
    retain_count = count_buffer("retain_buffer.jsonl", settings.DATA_BASE)

    # Build latest metrics — None when no data exists
    if latest_cycle:
        latest_metrics = {
            "forget_ppl": latest_cycle.forget_ppl,
            "retain_ppl": latest_cycle.retain_ppl,
            "mae_validation": latest_cycle.mae_validation,
            "directional_acc": latest_cycle.directional_acc,
            "mia_auc": latest_cycle.mia_auc,
        }
        current_cycle_num = latest_cycle.cycle_num
        current_method = latest_cycle.method
    elif file_history:
        # Use the latest deployed entry from cycle_history.json
        latest_entry = None
        for entry in reversed(file_history):
            if entry.get("deployed"):
                latest_entry = entry
                break
        if latest_entry is None and file_history:
            latest_entry = file_history[-1]

        latest_metrics = {
            "forget_ppl": latest_entry.get("forget_ppl"),
            "retain_ppl": latest_entry.get("retain_ppl"),
            "mae_validation": latest_entry.get("mae_validation"),
            "directional_acc": latest_entry.get("directional_acc"),
            "mia_auc": latest_entry.get("mia_auc"),
        } if latest_entry else {
            "forget_ppl": None, "retain_ppl": None,
            "mae_validation": None, "directional_acc": None, "mia_auc": None,
        }
        current_cycle_num = latest_entry.get("cycle_num", 0) if latest_entry else 0
        current_method = latest_entry.get("method", settings.UNLEARN_METHOD) if latest_entry else settings.UNLEARN_METHOD
    else:
        latest_metrics = {
            "forget_ppl": None, "retain_ppl": None,
            "mae_validation": None, "directional_acc": None, "mia_auc": None,
        }
        current_cycle_num = 0
        current_method = settings.UNLEARN_METHOD

    # Build history from DB or file
    if history:
        history_list = [
            {
                "cycle_num": c.cycle_num,
                "method": c.method,
                "forget_ppl": c.forget_ppl,
                "retain_ppl": c.retain_ppl,
                "mae_validation": c.mae_validation,
                "directional_acc": c.directional_acc,
                "mia_auc": c.mia_auc,
                "deployed": c.deployed,
                "gate_failure": c.gate_failure,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in history
        ]
    else:
        history_list = [
            {
                "cycle_num": e.get("cycle_num"),
                "method": e.get("method"),
                "forget_ppl": e.get("forget_ppl"),
                "retain_ppl": e.get("retain_ppl"),
                "mae_validation": e.get("mae_validation"),
                "directional_acc": e.get("directional_acc"),
                "mia_auc": e.get("mia_auc"),
                "deployed": e.get("deployed"),
                "gate_failure": e.get("gate_failure"),
                "created_at": e.get("created_at"),
            }
            for e in file_history
        ]

    return {
        "current_cycle": current_cycle_num,
        "method": current_method,
        "latest": latest_metrics,
        "history": history_list,
        "buffer_status": {
            "forget_count": forget_count,
            "retain_count": retain_count,
            "trigger_at": settings.FORGET_TRIGGER,
        },
    }


def _load_cycle_history_file() -> list:
    """Read cycle_history.json from the ML output directory."""
    history_path = os.path.join(
        os.path.dirname(settings.OUTPUT_BASE.rstrip("/")),
        "logs",
        "cycle_history.json",
    )
    if not os.path.exists(history_path):
        return []
    try:
        with open(history_path) as f:
            return json.load(f)
    except Exception:
        logger.warning(f"Failed to read {history_path}")
        return []


async def get_ohlcv_data(
    ticker: str, days: int = 90, db: Optional[AsyncSession] = None
) -> dict:
    """Get OHLCV data with poison annotations."""
    import asyncio
    from stocksense.data.ingestion import load_raw_csv

    df = await asyncio.to_thread(load_raw_csv, ticker, settings.DATA_BASE)

    if df.empty:
        return {"ticker": ticker, "data": [], "poison_annotations": []}

    # Get last N days
    df = df.tail(days)

    data = []
    for _, row in df.iterrows():
        data.append({
            "date": str(row["date"]),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "vol": int(row["vol"]),
        })

    # Get poison annotations from DB
    annotations = []
    if db:
        from app.models.poison_event import PoisonEvent
        from sqlalchemy import select

        result = await db.execute(
            select(PoisonEvent)
            .where(PoisonEvent.ticker == ticker)
            .order_by(desc(PoisonEvent.created_at))
            .limit(100)
        )
        events = result.scalars().all()
        for ev in events:
            annotations.append({
                "date": str(ev.window_end),
                "type": ev.poison_type,
                "swing_ratio": float(ev.swing_ratio) if ev.swing_ratio else None,
                "sigma": float(ev.sigma) if ev.sigma else None,
                "vol_ratio": float(ev.vol_ratio) if ev.vol_ratio else None,
            })

    return {
        "ticker": ticker,
        "data": data,
        "poison_annotations": annotations,
    }
