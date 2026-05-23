"""Admin investments router — admin-only oversight of all user portfolios."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, require_admin
from app.models.portfolio import Portfolio
from app.models.investment_transaction import InvestmentTransaction
from app.services.market_price_service import get_live_price_inr

router = APIRouter(prefix="/admin/investments", tags=["admin-investments"])


@router.get("")
async def get_all_investments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    email: str = Query(None),
    ticker: str = Query(None),
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """All users' holdings (paginated, filterable)."""
    query = select(Portfolio).where(Portfolio.units_held > 0)
    if email:
        query = query.where(Portfolio.user_email == email)
    if ticker:
        query = query.where(Portfolio.ticker == ticker)

    query = query.order_by(desc(Portfolio.updated_at))
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    portfolios = result.scalars().all()

    holdings = []
    for p in portfolios:
        units = float(p.units_held)
        avg = float(p.avg_buy_price)
        current_price = await get_live_price_inr(p.ticker, db)
        current_price = current_price or avg
        current_value = units * current_price
        pnl = current_value - float(p.total_invested)
        pnl_pct = (pnl / float(p.total_invested) * 100) if float(p.total_invested) > 0 else 0

        holdings.append({
            "user_email": p.user_email,
            "ticker": p.ticker,
            "units_held": units,
            "avg_buy_price": avg,
            "total_invested": float(p.total_invested),
            "current_price": current_price,
            "current_value": round(current_value, 2),
            "unrealised_pnl": round(pnl, 2),
            "unrealised_pnl_pct": round(pnl_pct, 2),
        })

    return {"holdings": holdings, "page": page, "limit": limit}


@router.get("/summary")
async def investment_summary(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate platform stats."""
    # Total invested
    total_q = await db.execute(
        select(func.sum(Portfolio.total_invested)).where(Portfolio.units_held > 0)
    )
    total_invested = float(total_q.scalar() or 0)

    # Active investors
    users_q = await db.execute(
        select(func.count(func.distinct(Portfolio.user_email))).where(Portfolio.units_held > 0)
    )
    total_users = int(users_q.scalar() or 0)

    # Top tickers by total invested
    top_q = await db.execute(
        select(Portfolio.ticker, func.sum(Portfolio.total_invested).label("total"))
        .where(Portfolio.units_held > 0)
        .group_by(Portfolio.ticker)
        .order_by(desc("total"))
        .limit(5)
    )
    top_tickers = [{"ticker": row[0], "total_invested": float(row[1])} for row in top_q.all()]

    return {
        "total_invested": total_invested,
        "total_users_investing": total_users,
        "top_tickers": top_tickers,
        "total_current_value": 0,  # would need live price for each
    }


@router.get("/{email}")
async def get_user_investments(
    email: str,
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Full portfolio for one user."""
    from app.services.portfolio_service import get_holdings
    holdings = await get_holdings(email, db)
    return {"user_email": email, "holdings": holdings}


@router.get("/transactions")
async def get_all_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    email: str = Query(None),
    ticker: str = Query(None),
    action: str = Query(None),
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """All transaction events (paginated, filtered)."""
    query = select(InvestmentTransaction)
    if email:
        query = query.where(InvestmentTransaction.user_email == email)
    if ticker:
        query = query.where(InvestmentTransaction.ticker == ticker)
    if action:
        query = query.where(InvestmentTransaction.action == action)

    query = query.order_by(desc(InvestmentTransaction.created_at))
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    txs = result.scalars().all()

    return {
        "transactions": [
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
        ],
        "page": page,
        "limit": limit,
    }
