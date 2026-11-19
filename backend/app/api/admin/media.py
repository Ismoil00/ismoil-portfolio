"""Admin: upload a file (step 1 of saving a form with files), or discard an unsaved upload.

With Vercel Blob, big files skip the backend (a request to it can't exceed 4.5 MB on Vercel): the panel
asks `/direct/authorize` whether a staging path may be uploaded, uploads the file to Blob, then calls
`/direct` so the backend checks it and turns it into a media item, just like `POST /media` does.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Form, UploadFile, status

from app.api.deps import MediaServiceDep, media_out
from app.models.enums import MediaPurpose
from app.schemas.media import DirectUploadIn, DirectUploadLimitOut, MediaOut
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


@router.post("/direct/authorize", response_model=DirectUploadLimitOut)
async def authorize_direct_upload(body: DirectUploadIn, service: MediaServiceDep) -> DirectUploadLimitOut:
    """Called by the admin panel's server before it lets the browser upload to Vercel Blob."""
    return DirectUploadLimitOut(maximum_size_in_bytes=service.direct_upload_limit(body.pathname))


@router.post("/direct", status_code=status.HTTP_201_CREATED, response_model=MediaOut)
async def adopt_direct_upload(
    pathname: Annotated[str, Form(max_length=200)],
    filename: Annotated[str, Form(max_length=1024)],
    service: MediaServiceDep,
    poster: UploadFile | None = None,
    width: Dimension = None,
    height: Dimension = None,
) -> MediaOut:
    media = await service.adopt_upload(
        pathname,
        filename,
        poster=_incoming(poster) if poster else None,
        width=width,
        height=height,
    )
    return media_out(media, service)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unlinked_media(media_id: uuid.UUID, service: MediaServiceDep) -> None:
    await service.delete_unlinked(media_id)
