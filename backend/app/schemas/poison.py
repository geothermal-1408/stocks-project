"""Poison event API schemas."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator


class PoisonEventSchema(BaseModel):
    id: str
    ticker: str
    window_start: str
    window_end: str
    poison_type: str
    reason: Optional[str] = None
    sigma: Optional[float] = None
    swing_ratio: Optional[float] = None
    vol_ratio: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PoisonLogResponse(BaseModel):
    total: int
    events: List[PoisonEventSchema]


# Only AAPL is supported this sprint
VALID_POISON_TICKERS = {"AAPL"}


class InjectPoisonRequest(BaseModel):
    ticker: str = "AAPL"
    inject_type: str  # flash_crash, volume_spike, etc.
    target_date: str

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        if v not in VALID_POISON_TICKERS:
            raise ValueError(
                f"Only {', '.join(VALID_POISON_TICKERS)} supported for poison injection"
            )
        return v


class InjectPoisonResponse(BaseModel):
    window_id: str
    injected: bool
    detected: bool
    test_passed: bool

