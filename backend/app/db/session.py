"""Async engine + session factory (SQLAlchemy 2.0 over asyncpg)."""

from collections.abc import AsyncIterator

from sqlalchemy import URL
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


class Database:
    """Owns the connection pool; one per app (created in the app's lifespan)."""

    def __init__(
        self, url: URL | str, *, echo: bool = False, connect_args: dict | None = None, hide_parameters: bool = False
    ) -> None:
        # hide_parameters: logs show the SQL but not the values (tokens, personal data) — used in production.
        self.engine: AsyncEngine = create_async_engine(
            url, echo=echo, pool_pre_ping=True, connect_args=connect_args or {}, hide_parameters=hide_parameters
        )
        self.sessionmaker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def session(self) -> AsyncIterator[AsyncSession]:
        async with self.sessionmaker() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    async def dispose(self) -> None:
        await self.engine.dispose()
