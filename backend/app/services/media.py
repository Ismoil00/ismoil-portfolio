"""Uploading files: type and size checks, image inspection, SVG cleaning, storage, and cleanup.

Uploads are two-step: a file is uploaded first (and gets an id), then a form links that id. Files
that nothing links within a day are deleted by `cleanup`.
"""

import asyncio
import io
import re
import uuid
import warnings
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import BinaryIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import Conflict, FieldErrors, NotFound, PayloadTooLarge, UnsupportedMediaType
from app.core.files import ATTACHMENT_TYPES, EXTENSIONS, SVG, UploadRejected, check_upload
from app.core.svg import InvalidSvg, sanitize_svg
from app.models import Media
from app.models.enums import MediaPurpose
from app.repositories.media import MediaRepository
from app.repositories.storage import Storage

Image.MAX_IMAGE_PIXELS = 50_000_000  # bigger images are refused (decompression bombs)
VIDEO_PURPOSES = {MediaPurpose.PROJECT_VIDEO, MediaPurpose.TESTIMONIAL_VIDEO}
REENCODE = {"image/jpeg": "JPEG", "image/webp": "WEBP", "image/png": "PNG"}
UNLINKED_GRACE = timedelta(hours=24)


@dataclass
class IncomingFile:
    """An uploaded file, independent of the web framework."""

    data: BinaryIO
    size: int
    filename: str


@dataclass
class _Prepared:
    data: BinaryIO
    size: int
    content_type: str
    width: int | None
    height: int | None


MAX_NAME = 255  # media.original_name
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_SAME_EXTENSION = {"jpg": {"jpg", "jpeg"}}


def download_name(filename: str, extension: str) -> str:
    """The name the file had on the uploader's computer, kept as it is ("CV - Ru - Sharifov Ismoil.pdf").

    Only a folder path and invisible control characters are dropped, and the real extension is added when the
    name lacks it. The download header encodes everything else safely (core.files.content_disposition).
    """
    name = _CONTROL_CHARS.sub("", re.split(r"[\\/]", filename or "")[-1]).strip()
    stem, dot, ext = name.rpartition(".")
    if not (dot and stem and ext.lower() in _SAME_EXTENSION.get(extension, {extension})):
        name = f"{name or 'file'}.{extension}"
    if len(name) > MAX_NAME:
        stem, _, ext = name.rpartition(".")
        name = f"{stem[: MAX_NAME - len(ext) - 1]}.{ext}"
    return name


def _inspect_image(data: BinaryIO, content_type: str) -> tuple[int, int, BinaryIO | None]:
    """Width and height; and when the photo carries metadata (camera, GPS…), a copy without it."""
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            with Image.open(data) as probe:
                probe.verify()
            data.seek(0)
            image = Image.open(data)
            image.load()
        except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError, Warning) as error:
            raise UnsupportedMediaType("The image can't be read. Try another file.") from error

    with image:
        animated = getattr(image, "n_frames", 1) > 1
        if content_type not in REENCODE or animated or not image.getexif():
            return image.width, image.height, None
        clean = ImageOps.exif_transpose(image)
        out = io.BytesIO()
        options = {"quality": 95} if content_type != "image/png" else {}
        clean.save(out, format=REENCODE[content_type], **options)
        out.seek(0)
        return clean.width, clean.height, out


class MediaService:
    def __init__(self, repo: MediaRepository, storage: Storage, *, clock=lambda: datetime.now(UTC)) -> None:
        self.repo = repo
        self.storage = storage
        self.clock = clock

    def url(self, media: Media | None) -> str | None:
        return self.storage.url(media.storage_key) if media else None

    async def _prepare(self, purpose: MediaPurpose, upload: IncomingFile) -> _Prepared:
        head = upload.data.read(64)
        upload.data.seek(0)
        try:
            content_type = check_upload(purpose, head, upload.size)
        except UploadRejected as error:
            raise (PayloadTooLarge if error.too_large else UnsupportedMediaType)(str(error)) from error

        if content_type == SVG:
            try:
                clean = sanitize_svg(upload.data.read()).encode()
            except InvalidSvg as error:
                raise UnsupportedMediaType(str(error)) from error
            return _Prepared(io.BytesIO(clean), len(clean), content_type, None, None)

        if content_type.startswith("image/"):
            width, height, replaced = await asyncio.to_thread(_inspect_image, upload.data, content_type)
            data = replaced or upload.data
            data.seek(0, io.SEEK_END)
            size = data.tell()
            data.seek(0)
            return _Prepared(data, size, content_type, width, height)

        return _Prepared(upload.data, upload.size, content_type, None, None)

    async def _store(self, purpose: MediaPurpose, upload: IncomingFile, prepared: _Prepared, **extra) -> Media:
        extension = EXTENSIONS[prepared.content_type]
        key = f"{purpose.value}/{uuid.uuid4().hex}.{extension}"
        name = download_name(upload.filename, extension)
        attachment = prepared.content_type in ATTACHMENT_TYPES
        await self.storage.save(key, prepared.data, prepared.content_type, download_name=name if attachment else None)
        media = Media(
            purpose=purpose.value,
            storage_key=key,
            content_type=prepared.content_type,
            size_bytes=prepared.size,
            width=prepared.width,
            height=prepared.height,
            original_name=name,
            **extra,
        )
        await self.repo.add(media)
        return media

    async def upload(
        self,
        purpose: MediaPurpose,
        upload: IncomingFile,
        *,
        poster: IncomingFile | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> Media:
        if purpose == MediaPurpose.POSTER:
            raise FieldErrors.single(("purpose",), "Posters are uploaded together with their video")
        prepared = await self._prepare(purpose, upload)
        poster_media = None
        if purpose in VIDEO_PURPOSES:
            # The browser reports the video's size; the server can't measure it without ffmpeg.
            prepared.width, prepared.height = width, height
            if poster is not None:
                poster_prepared = await self._prepare(MediaPurpose.POSTER, poster)
                poster_media = await self._store(MediaPurpose.POSTER, poster, poster_prepared)
        media = await self._store(purpose, upload, prepared, poster=poster_media)
        await self.repo.commit()
        return media

    async def get_by_key(self, key: str) -> Media:
        media = await self.repo.get_by_key(key)
        if media is None:
            raise NotFound("File not found")
        return media

    async def claim(
        self,
        ids: Iterable[uuid.UUID],
        purposes: set[MediaPurpose],
        *,
        field: str,
        owner_id: str | None = None,
    ) -> list[Media]:
        """Checks files a form wants to link: they exist, fit this field, and aren't used elsewhere."""
        ids = list(ids)
        found = {m.id: m for m in await self.repo.get_many(ids)}
        errors: list[tuple[tuple[str | int, ...], str]] = []
        for index, media_id in enumerate(ids):
            media = found.get(media_id)
            loc = (field, index) if len(ids) > 1 or field.endswith("ids") else (field,)
            if media is None:
                errors.append((loc, "This file no longer exists. Upload it again."))
            elif MediaPurpose(media.purpose) not in purposes:
                errors.append((loc, "This file can't be used here"))
            elif any(owner != owner_id for _, owner in await self.repo.usage(media_id)):
                errors.append((loc, "This file is already used somewhere else"))
        if errors:
            raise FieldErrors(errors)
        return [found[media_id] for media_id in ids]

    async def discard(self, media: Iterable[Media]) -> None:
        """Deletes files (and their posters) that their owner stopped using. Call after committing."""
        for item in media:
            poster = item.poster
            await self.storage.delete(item.storage_key)
            await self.repo.delete(item)
            if poster is not None:
                await self.storage.delete(poster.storage_key)
                await self.repo.delete(poster)
        await self.repo.commit()

    async def delete_unlinked(self, media_id: uuid.UUID) -> None:
        """An upload the admin discarded before saving the form."""
        media = await self.repo.get(media_id)
        if media is None or media.purpose == MediaPurpose.POSTER:
            raise NotFound("File not found")
        if await self.repo.usage(media_id):
            raise Conflict("This file is in use. Remove it from the form and save instead.")
        await self.discard([media])

    async def cleanup(self) -> int:
        """Deletes uploads nothing has linked for a day. Returns how many were removed."""
        stale = await self.repo.unlinked_before(self.clock() - UNLINKED_GRACE)
        for media in stale:
            await self.storage.delete(media.storage_key)
            await self.repo.delete(media)
        await self.repo.commit()
        return len(stale)
