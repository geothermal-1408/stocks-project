"""
poison_service.py — Poison detection, logging, and synthetic injection.
"""

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.poison_event import PoisonEvent

logger = logging.getLogger(__name__)


async def get_poison_log(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    ticker: Optional[str] = None,
    poison_type: Optional[str] = None,
) -> dict:
    """Get paginated poison event log."""
    query = select(PoisonEvent).order_by(PoisonEvent.created_at.desc())
    count_query = select(func.count(PoisonEvent.id))

    if ticker:
        query = query.where(PoisonEvent.ticker == ticker)
        count_query = count_query.where(PoisonEvent.ticker == ticker)
    if poison_type:
        query = query.where(PoisonEvent.poison_type == poison_type)
        count_query = count_query.where(PoisonEvent.poison_type == poison_type)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()

    return {"total": total, "events": events}


async def log_poison_event(
    db: AsyncSession,
    ticker: str,
    window_start: date,
    window_end: date,
    poison_type: str,
    reason: Optional[str] = None,
    sigma: Optional[float] = None,
    swing_ratio: Optional[float] = None,
    vol_ratio: Optional[float] = None,
) -> PoisonEvent:
    """Log a poison detection event to the database.

    Poison events are immutable — they are the audit trail.
    """
    event = PoisonEvent(
        id=str(uuid.uuid4()),
        ticker=ticker,
        window_start=window_start,
        window_end=window_end,
        poison_type=poison_type,
        reason=reason,
        sigma=sigma,
        swing_ratio=swing_ratio,
        vol_ratio=vol_ratio,
    )
    db.add(event)
    await db.commit()
    logger.info(f"Logged poison event: {poison_type} for {ticker}")
    return event


async def inject_synthetic_poison(
    db: AsyncSession,
    ticker: str,
    inject_type: str,
    target_date: str,
) -> dict:
    """Inject synthetic poison for testing the detector.

    Creates a synthetic poisoned window and tests whether the detector
    correctly identifies it.  Detected samples are:
    - Routed exclusively to forget_buffer.jsonl (never retain)
    - Logged to poison-log.json with full provenance
    - Tracked in data_versioning for traceability
    """
    import asyncio
    import json
    try:
        from stocksense.data.ingestion import load_raw_csv
        from stocksense.data.window_builder import build_latest_window, window_to_text
        from stocksense.data.poison_detector import PoisonConfig, is_poisoned
        from stocksense.data.buffer_router import route_window
        from stocksense.data.data_versioning import hash_window, log_sample_provenance

        from app.config import settings
        df = await asyncio.to_thread(load_raw_csv, ticker, settings.DATA_BASE)

        if df.empty:
            return {"injected": False, "error": "No data available"}

        # Build a window around the target date
        window_df, window_text = build_latest_window(df)

        # Inject the poison
        injected_df = window_df.copy()
        if inject_type == "flash_crash":
            injected_df.loc[injected_df.index[-1], "high"] = (
                injected_df["close"].iloc[-1] * 1.20
            )
        elif inject_type == "volume_spike":
            injected_df.loc[injected_df.index[-1], "vol"] = (
                int(injected_df["vol"].median() * 10)
            )
        elif inject_type == "negative_price":
            injected_df.loc[injected_df.index[-1], "close"] = -1.0
        elif inject_type == "ohlc_violation":
            injected_df.loc[injected_df.index[-1], "high"] = (
                injected_df["low"].iloc[-1] - 10
            )

        # Re-generate window text from the injected DataFrame
        injected_text = window_to_text(injected_df)

        # Test detection
        config = PoisonConfig()
        detected, reason = is_poisoned(injected_df, config)

        window_id = str(uuid.uuid4())
        window_start = str(window_df["date"].iloc[0])
        window_end = str(window_df["date"].iloc[-1])

        if detected:
            # 1. Route to forget_buffer.jsonl (NEVER retain)
            route_window(
                injected_text,
                is_poisoned=True,
                reason=f"synthetic_injection:{reason}",
                data_base=settings.DATA_BASE,
                meta={
                    "ticker": ticker,
                    "window_start": window_start,
                    "window_end": window_end,
                    "source": "admin_inject",
                    "inject_type": inject_type,
                },
            )

            # 2. Log provenance via data_versioning
            w_hash = hash_window(injected_text)
            log_sample_provenance(
                window_hash=w_hash,
                source="admin_inject",
                ticker=ticker,
                window_start=window_start,
                window_end=window_end,
                routed_to="forget_buffer",
            )

            # 3. Append to poison-log.json
            _append_poison_log(
                settings.DATA_BASE,
                ticker=ticker,
                inject_type=inject_type,
                target_date=target_date,
                detected=True,
                reason=reason,
                window_hash=w_hash,
            )

            # 4. Log to DB (immutable audit trail)
            await log_poison_event(
                db, ticker,
                window_df["date"].iloc[0],
                window_df["date"].iloc[-1],
                inject_type,
                reason=f"synthetic_injection: {reason}",
            )

        return {
            "window_id": window_id,
            "injected": True,
            "detected": detected,
            "test_passed": detected,  # Detector should catch injected poison
        }

    except Exception as e:
        logger.error(f"Injection failed: {e}")
        return {"injected": False, "error": str(e)}


def _append_poison_log(
    data_base: str,
    ticker: str,
    inject_type: str,
    target_date: str,
    detected: bool,
    reason: str | None,
    window_hash: str,
) -> None:
    """Append an entry to ml/output/logs/poison_log.json."""
    import json
    import os
    from datetime import datetime as dt, timezone

    log_dir = os.path.join(
        os.path.dirname(data_base.rstrip("/")), "output", "logs"
    )
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "poison_log.json")

    existing = []
    if os.path.exists(log_path):
        try:
            with open(log_path) as f:
                existing = json.load(f)
        except Exception:
            existing = []

    existing.append({
        "ticker": ticker,
        "inject_type": inject_type,
        "target_date": target_date,
        "detected": detected,
        "reason": reason,
        "window_hash": window_hash,
        "timestamp": dt.now(timezone.utc).isoformat(),
    })

    with open(log_path, "w") as f:
        json.dump(existing, f, indent=2)

