"""
market_price_service.py — Live price lookup + USD→INR conversion.

Fetches latest close from the OHLCV table and converts USD→INR
using yfinance USDINR=X ticker. Cached for 5 minutes.
"""

import logging
import time
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ohlcv_cache import OHLCVCache

logger = logging.getLogger(__name__)

# Simple in-memory cache for FX rate (5-minute TTL)
_fx_cache = {"rate": None, "timestamp": 0}
FX_CACHE_TTL = 300  # seconds


async def get_usd_inr_rate() -> float:
    """Fetch live USD→INR exchange rate from yfinance.

    Cached for 5 minutes to avoid excessive API calls.

    Returns:
        Exchange rate (e.g., 83.5). Falls back to 83.0 if unavailable.
    """
    now = time.time()
    if _fx_cache["rate"] and (now - _fx_cache["timestamp"]) < FX_CACHE_TTL:
        return _fx_cache["rate"]

    try:
        import yfinance as yf

        ticker_symbol = "USDINR=X"
        fx = yf.Ticker(ticker_symbol)
        hist = fx.history(period="1d")
        if not hist.empty:
            rate = float(hist["Close"].iloc[-1])
            _fx_cache["rate"] = rate
            _fx_cache["timestamp"] = now
            logger.info(f"USD/INR rate: {rate}")
            return rate
    except Exception as e:
        logger.warning(f"Failed to fetch USD/INR rate: {e}")

    # Fallback
    return _fx_cache.get("rate") or 83.0


async def get_latest_close_usd(
    ticker: str, db: AsyncSession
) -> Optional[float]:
    """Get the latest closing price in USD from the OHLCV table.

    Args:
        ticker: Stock ticker symbol.
        db: Database session.

    Returns:
        Latest close price in USD, or None if not found.
    """
    result = await db.execute(
        select(OHLCVCache)
        .where(OHLCVCache.ticker == ticker)
        .order_by(desc(OHLCVCache.date))
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row:
        return float(row.close)
    return None


async def get_live_price_inr(
    ticker: str, db: AsyncSession
) -> Optional[float]:
    """Get the latest price in INR (USD close × FX rate).

    Uses the OHLCV table for the USD price and yfinance for the FX rate.
    This is the price used for all portfolio transactions — never the
    model's prediction.

    Args:
        ticker: Stock ticker symbol.
        db: Database session.

    Returns:
        Price in INR, or None if unavailable.
    """
    close_usd = await get_latest_close_usd(ticker, db)
    if close_usd is None:
        # Fallback: try fetching directly from yfinance
        try:
            import yfinance as yf
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1d")
            if not hist.empty:
                close_usd = float(hist["Close"].iloc[-1])
        except Exception as e:
            logger.error(f"Failed to fetch price for {ticker}: {e}")
            return None

    if close_usd is None:
        return None

    fx_rate = await get_usd_inr_rate()
    return round(close_usd * fx_rate, 4)
