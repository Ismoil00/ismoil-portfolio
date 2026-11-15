"""Shared FastAPI dependencies (database session, settings, client address)."""

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.net import client_ip, hash_ip
from app.models import Media
from app.repositories.media import MediaRepository
from app.repositories.storage import Storage
from app.schemas.media import MediaOut
from app.services.media import MediaService


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async for session in request.app.state.db.session():
        yield session


def get_ip_hash(request: Request, settings: Annotated[Settings, Depends(get_settings_dep)]) -> str:
    return hash_ip(client_ip(request, settings.trusted_proxies), settings.secret_key.get_secret_value())


SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
IpHashDep = Annotated[str, Depends(get_ip_hash)]


def get_storage(request: Request) -> Storage:
    return request.app.state.storage


StorageDep = Annotated[Storage, Depends(get_storage)]


def get_media_service(session: SessionDep, storage: StorageDep) -> MediaService:
    return MediaService(MediaRepository(session), storage)


MediaServiceDep = Annotated[MediaService, Depends(get_media_service)]


def media_out(media: Media, service: MediaService) -> MediaOut:
    return MediaOut(
        id=media.id,
        purpose=media.purpose,
        url=service.url(media) or "",
        content_type=media.content_type,
        size_bytes=media.size_bytes,
        width=media.width,
        height=media.height,
        original_name=media.original_name,
        poster_url=service.url(media.poster),
    )
