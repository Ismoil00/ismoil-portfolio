"""Admin: upload a file (step 1 of saving a form with files), or discard an unsaved upload."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Form, UploadFile, status

from app.api.deps import MediaServiceDep, media_out
from app.models.enums import MediaPurpose
from app.schemas.media import MediaOut
from app.services.media import IncomingFile

router = APIRouter(prefix="/media", tags=["admin: files"])

Dimension = Annotated[int | None, Form(ge=1, le=20_000)]


def _incoming(file: UploadFile) -> IncomingFile:
    return IncomingFile(data=file.file, size=file.size or 0, filename=file.filename or "file")


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MediaOut)
async def upload_media(
    purpose: Annotated[MediaPurpose, Form()],
    file: UploadFile,
    service: MediaServiceDep,
    poster: UploadFile | None = None,
    width: Dimension = None,
    height: Dimension = None,
) -> MediaOut:
    media = await service.upload(
        purpose,
        _incoming(file),
        poster=_incoming(poster) if poster else None,
        width=width,
        height=height,
    )
    return media_out(media, service)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unlinked_media(media_id: uuid.UUID, service: MediaServiceDep) -> None:
    await service.delete_unlinked(media_id)
