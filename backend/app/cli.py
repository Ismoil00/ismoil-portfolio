"""Command-line tasks.

.venv/Scripts/python -m app.cli create-admin             create the admin user (or reset its password)
.venv/Scripts/python -m app.cli delete-admin --username X   remove an admin user (and its sessions)
.venv/Scripts/python -m app.cli cleanup                  delete unlinked uploads and expired auth records
.venv/Scripts/python -m app.cli seed                     load the real content into an empty database
.venv/Scripts/python -m app.cli import-selectors         add the seed's new development fields and technologies
.venv/Scripts/python -m app.cli copy-media               copy the local uploads to STORAGE_BACKEND (s3 or blob)
"""

import argparse
import asyncio
import getpass
import json
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import BASE_DIR, get_settings
from app.core.errors import FieldErrors
from app.db.session import Database
from app.repositories.auth import AuthRepository
from app.repositories.media import MediaRepository
from app.repositories.storage import LocalStorage, create_storage
from app.services import maintenance
from app.services.auth import AuthService, normalize_username
from app.services.media import MediaService
from app.services.seed import SeedError, add_missing_selectors, load_seed


@asynccontextmanager
async def open_session() -> AsyncIterator[AsyncSession]:
    settings = get_settings()
    # Scripts use the direct address when there is one (DATABASE_URL_UNPOOLED).
    db = Database(
        settings.database_url(direct=True),
        echo=settings.db_echo,
        connect_args=settings.connect_args(direct=True),
        null_pool=True,
    )
    try:
        async with db.sessionmaker() as session:
            yield session
    finally:
        await db.dispose()


async def create_admin(username: str, password: str) -> None:
    async with open_session() as session:
        try:
            user = await AuthService(AuthRepository(session), get_settings()).create_admin(username, password)
        except FieldErrors as error:
            for issue in error.errors:
                print(f"  {issue['loc'][-1]}: {issue['msg']}", file=sys.stderr)
            raise SystemExit(1) from error
        print(f"Admin ready: {user.username}. Any earlier sessions were signed out.")


async def delete_admin(username: str) -> None:
    async with open_session() as session:
        repo = AuthRepository(session)
        user = await repo.get_user_by_username(normalize_username(username))
        if user is None:
            print(f"No admin with the username {username}.", file=sys.stderr)
            raise SystemExit(1)
        await session.delete(user)
        await session.commit()
        print(f"Deleted the admin {user.username}.")


async def cleanup() -> None:
    async with open_session() as session:
        removed = await maintenance.cleanup(session, create_storage(get_settings()))
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


async def import_selectors(path: str) -> None:
    data = json.loads((BASE_DIR / path).read_text(encoding="utf-8"))
    async with open_session() as session:
        added = await add_missing_selectors(session, data)
    for label, names in (("development field(s)", added.fields), ("technology(ies)", added.techs)):
        print(f"Added {len(names)} {label}" + (f": {', '.join(names)}" if names else ""))
    print("Nothing else was changed.")


async def copy_media() -> None:
    settings = get_settings()
    if settings.storage_backend == "local":
        print("Set STORAGE_BACKEND (blob or s3) and its settings first; files are read from LOCAL_STORAGE_DIR.")
        raise SystemExit(1)
    source = LocalStorage(settings.local_storage_dir, settings.media_base_url)
    async with open_session() as session:
        copied, missing = await maintenance.copy_media(session, source, create_storage(settings))
    print(f"Copied {copied} file(s) to {settings.storage_backend}.")
    if missing:
        print(f"Not found in {source.root} ({len(missing)}): {', '.join(missing)}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-admin", help="create the admin user or reset its password")
    create.add_argument("--username", help="asked for when left out")
    remove = commands.add_parser("delete-admin", help="remove an admin user")
    remove.add_argument("--username", required=True)
    commands.add_parser("cleanup", help="delete unlinked uploads and expired auth records")
    seeding = commands.add_parser("seed", help="load the real content into an empty database")
    seeding.add_argument("--file", default="seed/content.json", help="relative to backend/")
    importing = commands.add_parser(
        "import-selectors", help="add the seed's development fields and technologies a filled database lacks"
    )
    importing.add_argument("--file", default="seed/content.json", help="relative to backend/")
    commands.add_parser("copy-media", help="copy the local uploads to the storage set in STORAGE_BACKEND")
    args = parser.parse_args()

    if args.command == "create-admin":
        username = args.username or input("Admin username (3–32 Latin letters, digits, . _ -): ").strip()
        password = getpass.getpass("Password (at least 12 characters): ")
        if password != getpass.getpass("Repeat the password: "):
            print("The passwords don't match.", file=sys.stderr)
            raise SystemExit(1)
        asyncio.run(create_admin(username, password))
    elif args.command == "delete-admin":
        asyncio.run(delete_admin(args.username))
    elif args.command == "cleanup":
        asyncio.run(cleanup())
    elif args.command == "seed":
        asyncio.run(seed(args.file))
    elif args.command == "import-selectors":
        asyncio.run(import_selectors(args.file))
    elif args.command == "copy-media":
        asyncio.run(copy_media())


if __name__ == "__main__":
    main()
