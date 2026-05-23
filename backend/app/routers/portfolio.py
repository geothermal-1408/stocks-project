"""Portfolio router — user-only endpoints for invest, withdraw, holdings."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, require_user
from app.schemas.portfolio import (
    InvestRequest, WithdrawRequest, InvestResponse, WithdrawResponse,
    HoldingResponse, PortfolioSummaryResponse, TransactionResponse,
)
from app.services import portfolio_service

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("", response_model=PortfolioSummaryResponse)
async def get_portfolio(
    user: dict = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all holdings for the current user with P&L summary."""
    holdings = await portfolio_service.get_holdings(user["email"], db)

    total_invested = sum(h["total_invested"] for h in holdings)
    current_value = sum(h["current_value"] for h in holdings)
    predicted_value = sum(h.get("predicted_value", 0) for h in holdings)
    total_pnl = current_value - total_invested
    pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0

    return PortfolioSummaryResponse(
        total_invested=round(total_invested, 2),
        current_value=round(current_value, 2),
        predicted_value=round(predicted_value, 2),
        total_unrealised_pnl=round(total_pnl, 2),
        total_unrealised_pnl_pct=round(pnl_pct, 2),
        holdings=[HoldingResponse(**h) for h in holdings],
    )


@router.get("/{ticker}", response_model=HoldingResponse)
async def get_holding(
    ticker: str,
    user: dict = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single holding with P&L breakdown."""
    holding = await portfolio_service.get_single_holding(user["email"], ticker, db)
    if not holding:
        raise HTTPException(status_code=404, detail=f"No holdings for {ticker}")
    return HoldingResponse(**holding)


@router.post("/invest", response_model=InvestResponse)
async def invest(
    req: InvestRequest,
    user: dict = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Buy units of a ticker. Uses live price, not prediction."""
    try:
        result = await portfolio_service.invest(user["email"], req.ticker, req.amount_inr, db)
        return InvestResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/withdraw", response_model=WithdrawResponse)
async def withdraw(
    req: WithdrawRequest,
    user: dict = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Sell units. Calculates realised P&L."""
    try:
        result = await portfolio_service.withdraw(user["email"], req.ticker, req.units, db)
        return WithdrawResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/history", response_model=list[TransactionResponse])
async def transaction_history(
    ticker: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated transaction history."""
    txs = await portfolio_service.get_transaction_history(
        user["email"], ticker, page, limit, db
    )
    return [TransactionResponse(**tx) for tx in txs]
