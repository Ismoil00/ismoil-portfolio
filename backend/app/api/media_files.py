"""Serves uploaded files from the local disk (development; with S3 the storage server serves them)."""

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.api.deps import MediaServiceDep, StorageDep
from app.core.errors import NotFound
from app.core.files import ATTACHMENT_TYPES, content_disposition
from app.repositories.storage import InvalidKey, LocalStorage

router = APIRouter(tags=["files"])

# Keys are random and never reused, so browsers may cache a file forever.
CACHE_FOREVER = "public, max-age=31536000, immutable"


@router.get("/media/{key:path}", include_in_schema=False)
async def serve_media(key: str, service: MediaServiceDep, storage: StorageDep) -> FileResponse:
    if not isinstance(storage, LocalStorage):
        raise NotFound("File not found")
    try:
        path = storage.path(key)
    except InvalidKey as error:
        raise NotFound("File not found") from error
    media = await service.get_by_key(key)
    if not path.is_file():
        raise NotFound("File not found")
    headers = {"Cache-Control": CACHE_FOREVER}
    if media.content_type in ATTACHMENT_TYPES:  # the résumé downloads under the name it was uploaded with
        headers["Content-Disposition"] = content_disposition(media.original_name)
    return FileResponse(path, media_type=media.content_type, headers=headers)
