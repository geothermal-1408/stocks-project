"""Create tables and seed initial data."""

import logging
import bcrypt

from app.config import settings
from app.db.session import engine, Base

logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


async def create_tables():
    """Create all database tables."""
    # Import all models so Base.metadata knows about them
    import app.models.user  # noqa: F401
    import app.models.prediction_log  # noqa: F401
    import app.models.poison_event  # noqa: F401
    import app.models.cycle_record  # noqa: F401
    import app.models.ohlcv_cache  # noqa: F401
    import app.models.ingest_job  # noqa: F401
    import app.models.portfolio  # noqa: F401
    import app.models.investment_transaction  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")

    # Seed admin user
    await seed_admin()


async def seed_admin():
    """Seed the admin user if not exists."""
    from sqlalchemy import select
    from app.db.session import async_session
    from app.models.user import User

    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.email == settings.ADMIN_EMAIL)
        )
        if result.scalar_one_or_none() is None:
            admin = User(
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD[:72]),
                role="admin",
            )
            session.add(admin)
            await session.commit()
            logger.info(f"Admin user seeded: {settings.ADMIN_EMAIL}")
