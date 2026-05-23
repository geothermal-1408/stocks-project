"""Investment transaction ORM model — every buy/sell/withdraw event."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Numeric, DateTime

from app.db.session import Base


class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email = Column(String, nullable=False, index=True)
    ticker = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False)  # 'buy' | 'sell' | 'withdraw'
    amount_inr = Column(Numeric(14, 2), nullable=False)
    units = Column(Numeric(18, 6), nullable=False)
    price_at_time = Column(Numeric(12, 4), nullable=False)  # INR price at tx moment
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
