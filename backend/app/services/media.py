"""Uploading files: type and size checks, image inspection, SVG cleaning, storage, and cleanup.

Uploads are two-step: a file is uploaded first (and gets an id), then a form links that id. Files
that nothing links within a day are deleted by `cleanup`.

A file normally reaches the storage through the backend (`upload`). With Vercel Blob, files that can be
bigger than one request to the backend may be on Vercel (4.5 MB) go from the browser straight to the
storage instead: they land on a staging path, and `adopt_upload` checks them and moves them into place.
"""

import asyncio
import io
import re
import uuid
import warnings
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import BinaryIO, cast

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import Conflict, FieldErrors, NotFound, PayloadTooLarge, UnsupportedMediaType
from app.core.files import ATTACHMENT_TYPES, EXTENSIONS, RULES, SVG, UploadRejected, check_upload
from app.core.svg import InvalidSvg, sanitize_svg
from app.models import Media
from app.models.enums import MediaPurpose
from app.repositories.media import MediaRepository
from app.repositories.storage import DirectUploadStorage, Storage

Image.MAX_IMAGE_PIXELS = 50_000_000  # bigger images are refused (decompression bombs)
VIDEO_PURPOSES = {MediaPurpose.PROJECT_VIDEO, MediaPurpose.TESTIMONIAL_VIDEO}
REENCODE = {"image/jpeg": "JPEG", "image/webp": "WEBP", "image/png": "PNG"}
UNLINKED_GRACE = timedelta(hours=24)
# Kinds of file allowed to be bigger than 4 MB: these may be uploaded straight to the storage.
DIRECT_PURPOSES = frozenset(
    {
        MediaPurpose.RESUME,
        MediaPurpose.PROJECT_IMAGE,
        MediaPurpose.PROJECT_VIDEO,
        MediaPurpose.TESTIMONIAL_IMAGE,
        MediaPurpose.TESTIMONIAL_VIDEO,
    }
)
_STAGED_PATH = re.compile(r"incoming/(?P<purpose>[a-z_]+)/[0-9a-f]{32}")
SNIFF_BYTES = 64


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


def attachment_name(media: Media) -> str | None:
    """The save-as name of a file meant to be downloaded (the résumé); None for files shown in the page."""
    return media.original_name if media.content_type in ATTACHMENT_TYPES else None


def media_url(storage: Storage, media: Media | None) -> str | None:
    """Where browsers load a file from."""
    return storage.url(media.storage_key, download_name=attachment_name(media)) if media else None


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


def _check(purpose: MediaPurpose, head: bytes, size: int) -> str:
    try:
        return check_upload(purpose, head, size)
    except UploadRejected as error:
        raise (PayloadTooLarge if error.too_large else UnsupportedMediaType)(str(error)) from error


async def _prepare_image(data: BinaryIO, content_type: str) -> _Prepared:
    width, height, replaced = await asyncio.to_thread(_inspect_image, data, content_type)
    data = replaced or data
    data.seek(0, io.SEEK_END)
    size = data.tell()
    data.seek(0)
    return _Prepared(data, size, content_type, width, height)


class MediaService:
    def __init__(self, repo: MediaRepository, storage: Storage, *, clock=lambda: datetime.now(UTC)) -> None:
        self.repo = repo
        self.storage = storage
        self.clock = clock

    def url(self, media: Media | None) -> str | None:
        return media_url(self.storage, media)

    async def _prepare(self, purpose: MediaPurpose, upload: IncomingFile) -> _Prepared:
        head = upload.data.read(SNIFF_BYTES)
        upload.data.seek(0)
        content_type = _check(purpose, head, upload.size)

        if content_type == SVG:
            try:
                clean = sanitize_svg(upload.data.read()).encode()
            except InvalidSvg as error:
                raise UnsupportedMediaType(str(error)) from error
            return _Prepared(io.BytesIO(clean), len(clean), content_type, None, None)

        if content_type.startswith("image/"):
            return await _prepare_image(upload.data, content_type)

        return _Prepared(upload.data, upload.size, content_type, None, None)

    def _record(self, purpose: MediaPurpose, key: str, prepared: _Prepared, name: str, **extra) -> Media:
        return Media(
            purpose=purpose.value,
            storage_key=key,
            content_type=prepared.content_type,
            size_bytes=prepared.size,
            width=prepared.width,
            height=prepared.height,
            original_name=name,
            **extra,
        )

    async def _store(self, purpose: MediaPurpose, filename: str, prepared: _Prepared, **extra) -> Media:
        extension = EXTENSIONS[prepared.content_type]
        key = f"{purpose.value}/{uuid.uuid4().hex}.{extension}"
        name = download_name(filename, extension)
        attachment = prepared.content_type in ATTACHMENT_TYPES
        await self.storage.save(key, prepared.data, prepared.content_type, download_name=name if attachment else None)
        media = self._record(purpose, key, prepared, name, **extra)
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
                poster_media = await self._store(MediaPurpose.POSTER, poster.filename, poster_prepared)
        media = await self._store(purpose, upload.filename, prepared, poster=poster_media)
        await self.repo.commit()
        return media

    # --- direct uploads (Vercel Blob) ---------------------------------------------------------------

    def _direct_storage(self) -> DirectUploadStorage:
        if not self.storage.direct_uploads:
            raise Conflict("Files are uploaded through the backend here, not straight to the storage")
        return cast(DirectUploadStorage, self.storage)

    @staticmethod
    def _staged_purpose(pathname: str) -> MediaPurpose:
        match = _STAGED_PATH.fullmatch(pathname or "")
        purpose = next((p for p in DIRECT_PURPOSES if match and p.value == match["purpose"]), None)
        if purpose is None:
            raise FieldErrors.single(("pathname",), "This isn't an upload path the admin panel makes")
        return purpose

    def direct_upload_limit(self, pathname: str) -> int:
        """Step 1: the size limit for a staged path (and a refusal for paths the panel never makes)."""
        self._direct_storage()
        return RULES[self._staged_purpose(pathname)].max_bytes

    async def adopt_upload(
        self,
        pathname: str,
        filename: str,
        *,
        poster: IncomingFile | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> Media:
        """Step 3: checks a file the browser uploaded to the staging path, like `upload` checks one it sends
        to the backend, and moves it to its key. A file that fails a check is removed."""
        storage = self._direct_storage()
        purpose = self._staged_purpose(pathname)
        size = await storage.staged_size(pathname)
        if size is None:
            raise FieldErrors.single(("pathname",), "The upload didn't finish. Try again.")
        try:
            content_type = _check(purpose, await storage.read_staged(pathname, limit=SNIFF_BYTES), size)
            if content_type.startswith("image/"):
                prepared = await _prepare_image(io.BytesIO(await storage.read_staged(pathname)), content_type)
            else:
                video = purpose in VIDEO_PURPOSES
                prepared = _Prepared(
                    io.BytesIO(), size, content_type, width if video else None, height if video else None
                )
            poster_prepared = (
                await self._prepare(MediaPurpose.POSTER, poster) if poster and purpose in VIDEO_PURPOSES else None
            )
        except (PayloadTooLarge, UnsupportedMediaType):
            await storage.discard_staged(pathname)
            raise

        extension = EXTENSIONS[content_type]
        key = f"{purpose.value}/{uuid.uuid4().hex}.{extension}"
        name = download_name(filename, extension)
        if content_type.startswith("image/"):
            await storage.save(key, prepared.data, content_type)  # the checked (and cleaned) copy
            await storage.discard_staged(pathname)
        else:
            attachment = name if content_type in ATTACHMENT_TYPES else None
            await storage.adopt_staged(pathname, key, content_type, download_name=attachment)

        poster_media = None
        if poster is not None and poster_prepared is not None:
            poster_media = await self._store(MediaPurpose.POSTER, poster.filename, poster_prepared)
        media = self._record(purpose, key, prepared, name, poster=poster_media)
        await self.repo.add(media)
        await self.repo.commit()
        return media

    # --- reading, linking and removing --------------------------------------------------------------

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

    async def _delete_file(self, media: Media) -> None:
        await self.storage.delete(media.storage_key, download_name=attachment_name(media))

    async def discard(self, media: Iterable[Media]) -> None:
        """Deletes files (and their posters) that their owner stopped using. Call after committing."""
        for item in media:
            poster = item.poster
            await self._delete_file(item)
            await self.repo.delete(item)
            if poster is not None:
                await self._delete_file(poster)
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
        """Deletes uploads nothing has linked for a day, and staged direct uploads that were never checked in.
        Returns how many files were removed."""
        cutoff = self.clock() - UNLINKED_GRACE
        stale = await self.repo.unlinked_before(cutoff)
        for media in stale:
            await self._delete_file(media)
            await self.repo.delete(media)
        await self.repo.commit()
        staged = await self._direct_storage().stale_staged(cutoff) if self.storage.direct_uploads else []
        for pathname in staged:
            await self._direct_storage().discard_staged(pathname)
        return len(stale) + len(staged)
