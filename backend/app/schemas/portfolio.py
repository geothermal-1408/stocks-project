"""Pydantic schemas for portfolio and investment endpoints."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────────────

class InvestRequest(BaseModel):
    ticker: str = Field(..., description="Stock ticker symbol")
    amount_inr: float = Field(..., gt=0, description="Amount to invest in INR")


class WithdrawRequest(BaseModel):
    ticker: str = Field(..., description="Stock ticker symbol")
    units: float = Field(..., gt=0, description="Units to sell/withdraw")


# ── Response schemas ─────────────────────────────────────────────────────

class InvestResponse(BaseModel):
    units_purchased: float
    price_at_time: float
    new_total_units: float
    new_avg_buy_price: float
    ticker: str


class WithdrawResponse(BaseModel):
    amount_returned: float
    realised_pnl: float
    remaining_units: float
    ticker: str


class HoldingResponse(BaseModel):
    ticker: str
    units_held: float
    avg_buy_price: float
    total_invested: float
    current_price: float
    current_value: float
    predicted_value: float = 0.0
    unrealised_pnl: float
    unrealised_pnl_pct: float
    created_at: Optional[str] = None


class PortfolioSummaryResponse(BaseModel):
    total_invested: float
    current_value: float
    predicted_value: float
    total_unrealised_pnl: float
    total_unrealised_pnl_pct: float
    holdings: List[HoldingResponse]


class TransactionResponse(BaseModel):
    id: str
    user_email: str
    ticker: str
    action: str
    amount_inr: float
    units: float
    price_at_time: float
    created_at: Optional[str] = None


class PnLPointResponse(BaseModel):
    date: str
    portfolio_value: float
    total_invested: float
    pnl: float


# ── Admin schemas ────────────────────────────────────────────────────────

class AdminInvestmentSummary(BaseModel):
    total_invested: float
    total_users_investing: int
    top_tickers: List[dict]
    total_current_value: float
