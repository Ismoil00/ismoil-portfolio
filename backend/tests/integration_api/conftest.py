"""Integration (API) test fixtures: a real PostgreSQL test database, migrated with Alembic, and an
HTTP client that talks to the app in-process (no browser — browser tests live in the root e2e/). Each test runs inside a transaction that is rolled back afterwards,
so tests never see each other's data."""

import shutil
from collections.abc import AsyncIterator

import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import BASE_DIR, Settings
from app.main import create_app
from app.repositories.auth import AuthRepository
from app.services.auth import AuthService
from tests.conftest import ADMIN_ORIGIN

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "a-long-and-secret-passphrase"
CLIENT_IP = "198.51.100.10"


def _migrate(connection: Connection) -> None:
    config = Config(str(BASE_DIR / "alembic.ini"))
    config.attributes["connection"] = connection
    config.attributes["configure_logger"] = False
    command.upgrade(config, "head")


@pytest.fixture(scope="session")
async def engine(settings: Settings) -> AsyncIterator[AsyncEngine]:
    # The test database is wiped below: never let that happen to a real one by mistake.
    if not settings.test_db_name.endswith("_test") or settings.test_db_name == settings.db_name:
        pytest.exit(f"TEST_DB_NAME must end with '_test' and differ from DB_NAME (got {settings.test_db_name!r})")
    engine = create_async_engine(
        settings.database_url(test=True), poolclass=NullPool, connect_args=settings.connect_args()
    )
    async with engine.begin() as conn:
        await conn.execute(text(f'DROP SCHEMA IF EXISTS "{settings.db_schema}" CASCADE'))
        await conn.execute(text(f'CREATE SCHEMA "{settings.db_schema}"'))
    async with engine.begin() as conn:
        await conn.run_sync(_migrate)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with engine.connect() as conn:
        outer = await conn.begin()
        # Services call commit(); here that only releases a savepoint inside the outer transaction.
        session = AsyncSession(bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await outer.rollback()


class _TestDatabase:
    """Hands the app the test's session instead of opening new connections."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def session(self) -> AsyncIterator[AsyncSession]:
        try:
            yield self._session
        except Exception:
            await self._session.rollback()  # back to the last savepoint, like a failed request
            raise

    async def dispose(self) -> None:
        pass


@pytest.fixture
def storage_dir(settings: Settings):
    path = settings.local_storage_dir
    shutil.rmtree(path, ignore_errors=True)
    path.mkdir(parents=True, exist_ok=True)
    yield path
    shutil.rmtree(path, ignore_errors=True)


@pytest.fixture
def app(settings: Settings, db_session: AsyncSession, storage_dir):
    return create_app(settings, database=_TestDatabase(db_session))


def make_client(app, ip: str = CLIENT_IP) -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app, client=(ip, 50000)),
        base_url="http://testserver",
        headers={"Origin": ADMIN_ORIGIN},
    )


@pytest.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    async with make_client(app) as c:
        yield c


@pytest.fixture
async def admin_user(db_session: AsyncSession, settings: Settings):
    return await AuthService(AuthRepository(db_session), settings).create_admin(ADMIN_USERNAME, ADMIN_PASSWORD)


@pytest.fixture
async def auth_client(app, admin_user) -> AsyncIterator[AsyncClient]:
    """Signed in, with the CSRF header set for every request."""
    async with make_client(app) as c:
        response = await c.post("/api/v1/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
        assert response.status_code == 200, response.text
        c.headers["X-CSRF-Token"] = response.json()["csrf_token"]
        yield c
