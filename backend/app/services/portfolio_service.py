"""
portfolio_service.py — Portfolio business logic.

Handles invest (buy), withdraw (sell), holdings lookup, P&L calculations,
and transaction history. All transactions use live prices, never predictions.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.portfolio import Portfolio
from app.models.investment_transaction import InvestmentTransaction
from app.services.market_price_service import get_live_price_inr

logger = logging.getLogger(__name__)


async def get_holdings(
    user_email: str, db: AsyncSession
) -> List[dict]:
    """Get all holdings for a user with live P&L.

    Returns:
        List of holding dicts with current_price and unrealised_pnl.
    """
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_email == user_email)
    )
    portfolios = result.scalars().all()

    holdings = []
    for p in portfolios:
        units = float(p.units_held)
        if units <= 0:
            continue

        avg_price = float(p.avg_buy_price)
        total_inv = float(p.total_invested)

        # Fetch live price
        current_price = await get_live_price_inr(p.ticker, db)
        if current_price is None:
            current_price = avg_price  # fallback

        current_value = units * current_price
        unrealised_pnl = current_value - total_inv
        pnl_pct = (unrealised_pnl / total_inv * 100) if total_inv > 0 else 0

        holdings.append({
            "ticker": p.ticker,
            "units_held": units,
            "avg_buy_price": avg_price,
            "total_invested": total_inv,
            "current_price": current_price,
            "current_value": round(current_value, 2),
            "unrealised_pnl": round(unrealised_pnl, 2),
            "unrealised_pnl_pct": round(pnl_pct, 2),
            "predicted_value": 0.0,  # filled by router if needed
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return holdings


async def get_single_holding(
    user_email: str, ticker: str, db: AsyncSession
) -> Optional[dict]:
    """Get a single holding for a user/ticker."""
    result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_email == user_email,
            Portfolio.ticker == ticker,
        )
    )
    p = result.scalar_one_or_none()
    if not p or float(p.units_held) <= 0:
        return None

    units = float(p.units_held)
    avg_price = float(p.avg_buy_price)
    total_inv = float(p.total_invested)

    current_price = await get_live_price_inr(ticker, db)
    if current_price is None:
        current_price = avg_price

    current_value = units * current_price
    unrealised_pnl = current_value - total_inv
    pnl_pct = (unrealised_pnl / total_inv * 100) if total_inv > 0 else 0

    return {
        "ticker": ticker,
        "units_held": units,
        "avg_buy_price": avg_price,
        "total_invested": total_inv,
        "current_price": current_price,
        "current_value": round(current_value, 2),
        "unrealised_pnl": round(unrealised_pnl, 2),
        "unrealised_pnl_pct": round(pnl_pct, 2),
        "predicted_value": 0.0,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


async def invest(
    user_email: str, ticker: str, amount_inr: float, db: AsyncSession
) -> dict:
    """Buy units of a ticker using INR amount.

    Uses live price (not prediction) for unit calculation.
    Updates portfolio and creates transaction record.

    Returns:
        Dict with units_purchased, price_at_time, new totals.
    """
    live_price = await get_live_price_inr(ticker, db)
    if live_price is None or live_price <= 0:
        raise ValueError(f"Cannot fetch live price for {ticker}")

    units_purchased = amount_inr / live_price

    # Get or create portfolio row
    result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_email == user_email,
            Portfolio.ticker == ticker,
        )
    )
    portfolio = result.scalar_one_or_none()

    if portfolio is None:
        portfolio = Portfolio(
            user_email=user_email,
            ticker=ticker,
            units_held=Decimal(str(units_purchased)),
            avg_buy_price=Decimal(str(live_price)),
            total_invested=Decimal(str(amount_inr)),
        )
        db.add(portfolio)
    else:
        old_units = float(portfolio.units_held)
        old_total = float(portfolio.total_invested)
        new_units = old_units + units_purchased
        new_total = old_total + amount_inr
        new_avg = new_total / new_units if new_units > 0 else 0

        portfolio.units_held = Decimal(str(new_units))
        portfolio.avg_buy_price = Decimal(str(round(new_avg, 4)))
        portfolio.total_invested = Decimal(str(new_total))
        portfolio.updated_at = datetime.now(timezone.utc)

    # Create transaction record
    tx = InvestmentTransaction(
        user_email=user_email,
        ticker=ticker,
        action="buy",
        amount_inr=Decimal(str(amount_inr)),
        units=Decimal(str(units_purchased)),
        price_at_time=Decimal(str(live_price)),
    )
    db.add(tx)
    await db.commit()

    return {
        "units_purchased": round(units_purchased, 6),
        "price_at_time": round(live_price, 4),
        "new_total_units": round(float(portfolio.units_held), 6),
        "new_avg_buy_price": round(float(portfolio.avg_buy_price), 4),
        "ticker": ticker,
    }


async def withdraw(
    user_email: str, ticker: str, units: float, db: AsyncSession
) -> dict:
    """Sell units of a ticker. Calculates realised P&L.

    Args:
        user_email: User's email.
        ticker: Stock ticker.
        units: Number of units to sell.
        db: Database session.

    Returns:
        Dict with amount_returned, realised_pnl, remaining_units.
    """
    result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_email == user_email,
            Portfolio.ticker == ticker,
        )
    )
    portfolio = result.scalar_one_or_none()

    if portfolio is None or float(portfolio.units_held) <= 0:
        raise ValueError(f"No holdings found for {ticker}")

    current_units = float(portfolio.units_held)
    if units > current_units:
        raise ValueError(f"Insufficient units. Have {current_units}, requested {units}")

    live_price = await get_live_price_inr(ticker, db)
    if live_price is None or live_price <= 0:
        raise ValueError(f"Cannot fetch live price for {ticker}")

    avg_buy = float(portfolio.avg_buy_price)
    amount_returned = units * live_price
    realised_pnl = (live_price - avg_buy) * units
    remaining = current_units - units

    # Update portfolio
    portfolio.units_held = Decimal(str(remaining))
    if remaining > 0:
        # Reduce total_invested proportionally
        proportion_sold = units / current_units
        old_total = float(portfolio.total_invested)
        portfolio.total_invested = Decimal(str(round(old_total * (1 - proportion_sold), 2)))
    else:
        portfolio.total_invested = Decimal("0")
    portfolio.updated_at = datetime.now(timezone.utc)

    # Create transaction record
    tx = InvestmentTransaction(
        user_email=user_email,
        ticker=ticker,
        action="sell",
        amount_inr=Decimal(str(round(amount_returned, 2))),
        units=Decimal(str(units)),
        price_at_time=Decimal(str(live_price)),
    )
    db.add(tx)
    await db.commit()

    return {
        "amount_returned": round(amount_returned, 2),
        "realised_pnl": round(realised_pnl, 2),
        "remaining_units": round(remaining, 6),
        "ticker": ticker,
    }


async def get_transaction_history(
    user_email: str, ticker: Optional[str], page: int, limit: int,
    db: AsyncSession
) -> List[dict]:
    """Get paginated transaction history."""
    query = select(InvestmentTransaction).where(
        InvestmentTransaction.user_email == user_email
    )
    if ticker:
        query = query.where(InvestmentTransaction.ticker == ticker)

    query = query.order_by(desc(InvestmentTransaction.created_at))
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    txs = result.scalars().all()

    return [
        {
            "id": tx.id,
            "user_email": tx.user_email,
            "ticker": tx.ticker,
            "action": tx.action,
            "amount_inr": float(tx.amount_inr),
            "units": float(tx.units),
            "price_at_time": float(tx.price_at_time),
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
        }
        for tx in txs
    ]
