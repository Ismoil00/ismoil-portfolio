"""Command-line tasks.

.venv/Scripts/python -m app.cli create-admin             create the admin user (or reset its password)
.venv/Scripts/python -m app.cli delete-admin --email X   remove an admin user (and its sessions)
.venv/Scripts/python -m app.cli cleanup                  delete unlinked uploads and expired auth records
"""

import argparse
import asyncio
import getpass
import json
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import BASE_DIR, get_settings
from app.core.errors import FieldErrors
from app.db.session import Database
from app.repositories.auth import AuthRepository
from app.repositories.media import MediaRepository
from app.repositories.storage import create_storage
from app.services.auth import AuthService, normalize_email
from app.services.media import MediaService
from app.services.seed import SeedError, load_seed


@asynccontextmanager
async def open_session() -> AsyncIterator[AsyncSession]:
    settings = get_settings()
    db = Database(settings.database_url(), echo=settings.db_echo, connect_args=settings.connect_args())
    try:
        async with db.sessionmaker() as session:
            yield session
    finally:
        await db.dispose()


async def create_admin(email: str, password: str) -> None:
    async with open_session() as session:
        try:
            user = await AuthService(AuthRepository(session), get_settings()).create_admin(email, password)
        except FieldErrors as error:
            for issue in error.errors:
                print(f"  {issue['loc'][-1]}: {issue['msg']}", file=sys.stderr)
            raise SystemExit(1) from error
        print(f"Admin ready: {user.email}. Any earlier sessions were signed out.")


async def delete_admin(email: str) -> None:
    async with open_session() as session:
        repo = AuthRepository(session)
        user = await repo.get_user_by_email(normalize_email(email))
        if user is None:
            print(f"No admin with the email {email}.", file=sys.stderr)
            raise SystemExit(1)
        await session.delete(user)
        await session.commit()
        print(f"Deleted the admin {user.email}.")


async def cleanup() -> None:
    settings = get_settings()
    async with open_session() as session:
        removed = await MediaService(MediaRepository(session), create_storage(settings)).cleanup()
        await AuthRepository(session).purge(datetime.now(UTC) - timedelta(days=30))
        await session.commit()
        print(f"Removed {removed} unlinked upload(s), old login attempts and expired sessions.")


async def seed(path: str) -> None:
    data = json.loads((BASE_DIR / path).read_text(encoding="utf-8"))
    async with open_session() as session:
        media = MediaService(MediaRepository(session), create_storage(get_settings()))
        try:
            await load_seed(session, media, data, repo_root=BASE_DIR.parent)
        except SeedError as error:
            print(error, file=sys.stderr)
            raise SystemExit(1) from error
    print("Seeded: selectors, Hero, About, Contacts, Tech stack, experience, projects and certificates.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-admin", help="create the admin user or reset its password")
    create.add_argument("--email", help="asked for when left out")
    remove = commands.add_parser("delete-admin", help="remove an admin user")
    remove.add_argument("--email", required=True)
    commands.add_parser("cleanup", help="delete unlinked uploads and expired auth records")
    seeding = commands.add_parser("seed", help="load the real content into an empty database")
    seeding.add_argument("--file", default="seed/content.json", help="relative to backend/")
    args = parser.parse_args()

    if args.command == "create-admin":
        email = args.email or input("Admin email: ").strip()
        password = getpass.getpass("Password (at least 12 characters): ")
        if password != getpass.getpass("Repeat the password: "):
            print("The passwords don't match.", file=sys.stderr)
            raise SystemExit(1)
        asyncio.run(create_admin(email, password))
    elif args.command == "delete-admin":
        asyncio.run(delete_admin(args.email))
    elif args.command == "cleanup":
        asyncio.run(cleanup())
    elif args.command == "seed":
        asyncio.run(seed(args.file))


if __name__ == "__main__":
    main()
