"""Housekeeping: the daily cleanup (the cron route in api/internal.py and `python -m app.cli cleanup`) and
the one-time copy of local uploads to the production storage (`python -m app.cli copy-media`)."""

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Media
from app.repositories.auth import AuthRepository
from app.repositories.chat import ChatRepository
from app.repositories.media import MediaRepository
from app.repositories.storage import LocalStorage, Storage
from app.services.analytics import AnalyticsService
from app.services.chat import KEEP_QUESTIONS, KEEP_USAGE
from app.services.media import MediaService, attachment_name

AUTH_RECORDS_KEPT = timedelta(days=30)


async def cleanup(session: AsyncSession, storage: Storage) -> int:
    """Removes unlinked uploads older than a day, old login attempts and expired sessions, old visit
    statistics and the AI assistant's old counters and questions. Returns how many files were removed."""
    removed = await MediaService(MediaRepository(session), storage).cleanup()
    await AuthRepository(session).purge(datetime.now(UTC) - AUTH_RECORDS_KEPT)
    await AnalyticsService(session, max_per_hour=0).forget_old()
    now = datetime.now(UTC)
    await ChatRepository(session).forget(usage_before=now - KEEP_USAGE, questions_before=now - KEEP_QUESTIONS)
    await session.commit()
    return removed


async def copy_media(session: AsyncSession, source: LocalStorage, target: Storage) -> tuple[int, list[str]]:
    """Copies every file the database knows from the local folder to `target`, under the same key (so the
    database needs no change). Safe to run again. Returns how many were copied and the keys not found."""
    copied, missing = 0, []
    for media in await session.scalars(select(Media).order_by(Media.created_at)):
        path = source.path(media.storage_key)
        if not await asyncio.to_thread(path.is_file):
            missing.append(media.storage_key)
            continue
        with path.open("rb") as data:
            await target.save(media.storage_key, data, media.content_type, download_name=attachment_name(media))
        copied += 1
    return copied, missing
