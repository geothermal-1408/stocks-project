"""Portfolio ORM model — one row per user per ticker."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Numeric, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.db.session import Base


class Portfolio(Base):
    __tablename__ = "portfolios"
    __table_args__ = (
        UniqueConstraint("user_email", "ticker", name="uq_portfolio_user_ticker"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email = Column(String, nullable=False, index=True)
    ticker = Column(String, nullable=False, index=True)
    units_held = Column(Numeric(18, 6), nullable=False, default=0)
    avg_buy_price = Column(Numeric(12, 4), nullable=False, default=0)
    total_invested = Column(Numeric(14, 2), nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
