"""Starts the backend for the end-to-end tests.

Each run gets a fresh copy of the real content: its own database (`portfolio_e2e`, created on the
first run), wiped, migrated and seeded from backend/seed/content.json, its own media folder, and an
admin with a new random password (written to e2e/.tmp/admin.json for the tests; git-ignored).
Your development database and files are never touched.

Started by playwright.config.ts with the backend's virtual environment:
    backend/.venv/Scripts/python e2e/scripts/backend.py
"""

import asyncio
import json
import os
import secrets
import shutil
import sys
from pathlib import Path

E2E_DIR = Path(__file__).resolve().parents[1]
REPO = E2E_DIR.parent
BACKEND = REPO / "backend"
STATE_DIR = E2E_DIR / ".tmp"

PORT = int(os.environ.get("E2E_BACKEND_PORT", "8100"))
ADMIN_ORIGIN = os.environ.get("E2E_ADMIN_ORIGIN", "http://localhost:3101")
DB_NAME = "portfolio_e2e"
ADMIN_EMAIL = "e2e-admin@example.com"

# Settings for this backend only — environment variables take priority over backend/.env.
os.environ.update(
    {
        "ENV": "development",
        "DB_NAME": DB_NAME,
        "DB_ECHO": "false",
        "COOKIE_SECURE": "false",
        "ADMIN_ORIGINS": json.dumps([ADMIN_ORIGIN]),
        "CORS_ORIGINS": "[]",
        "STORAGE_BACKEND": "local",
        "LOCAL_STORAGE_DIR": str(BACKEND / ".tmp" / "e2e-storage"),
        "MEDIA_BASE_URL": f"http://localhost:{PORT}/media",
        "ANTHROPIC_API_KEY": "",  # never call the paid translation API from tests
    }
)
sys.path.insert(0, str(BACKEND))

import asyncpg  # noqa: E402
import uvicorn  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.core.config import Settings, get_settings  # noqa: E402
from app.db.session import Database  # noqa: E402
from app.repositories.auth import AuthRepository  # noqa: E402
from app.repositories.media import MediaRepository  # noqa: E402
from app.repositories.storage import create_storage  # noqa: E402
from app.services.auth import AuthService  # noqa: E402
from app.services.media import MediaService  # noqa: E402
from app.services.seed import load_seed  # noqa: E402


async def ensure_database(settings: Settings) -> None:
    """Creates the E2E database once (needs a role allowed to create databases)."""
    conn = await asyncpg.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password.get_secret_value(),
        database="postgres",
    )
    try:
        if not await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", settings.db_name):
            await conn.execute(f'CREATE DATABASE "{settings.db_name}" OWNER "{settings.db_user}" ENCODING \'UTF8\'')
    finally:
        await conn.close()


def migrate(connection) -> None:
    config = Config(str(BACKEND / "alembic.ini"))
    config.attributes["connection"] = connection
    config.attributes["configure_logger"] = False
    command.upgrade(config, "head")


async def reset_and_seed(settings: Settings, password: str) -> None:
    engine = create_async_engine(settings.database_url(), poolclass=NullPool, connect_args=settings.connect_args())
    try:
        async with engine.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{settings.db_schema}" CASCADE'))
            await conn.execute(text(f'CREATE SCHEMA "{settings.db_schema}"'))
        async with engine.begin() as conn:
            await conn.run_sync(migrate)
    finally:
        await engine.dispose()

    shutil.rmtree(settings.local_storage_dir, ignore_errors=True)
    settings.local_storage_dir.mkdir(parents=True, exist_ok=True)

    db = Database(settings.database_url(), echo=False, connect_args=settings.connect_args())
    try:
        async with db.sessionmaker() as session:
            media = MediaService(MediaRepository(session), create_storage(settings))
            data = json.loads((BACKEND / "seed" / "content.json").read_text(encoding="utf-8"))
            await load_seed(session, media, data, repo_root=REPO)
            await AuthService(AuthRepository(session), settings).create_admin(ADMIN_EMAIL, password)
    finally:
        await db.dispose()


def main() -> None:
    settings = get_settings()
    # This database is wiped on every run: never let that happen to a real one by mistake.
    if not settings.db_name.endswith("_e2e"):
        sys.exit(f"Refusing to wipe {settings.db_name!r}: the E2E database name must end with '_e2e'.")

    password = secrets.token_urlsafe(24)
    asyncio.run(ensure_database(settings))
    asyncio.run(reset_and_seed(settings, password))

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    (STATE_DIR / "admin.json").write_text(json.dumps({"email": ADMIN_EMAIL, "password": password}), encoding="utf-8")
    print(f"E2E backend: fresh seeded database {DB_NAME!r}, serving on http://localhost:{PORT}", flush=True)

    uvicorn.run("app.main:create_app", factory=True, host="127.0.0.1", port=PORT, log_level="warning")


if __name__ == "__main__":
    main()
