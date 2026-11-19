"""An in-memory stand-in for the Vercel Blob SDK (`vercel.blob`): the same function names and arguments
the backend uses, so storage code is tested without a real Blob store or network."""

from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from types import SimpleNamespace

from vercel.blob import BlobError, BlobNotFoundError

BASE_URL = "https://teststore.public.blob.vercel-storage.com"


@dataclass
class StoredBlob:
    body: bytes
    content_type: str | None
    access: str
    cache_control_max_age: int | None = None
    uploaded_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class FakeBlobClient:
    def __init__(self) -> None:
        self.files: dict[str, StoredBlob] = {}

    def stage(self, pathname: str, body: bytes, content_type: str | None = None, *, uploaded_at=None) -> str:
        """What a browser upload leaves behind (the admin panel uploads straight to Blob)."""
        self.files[pathname] = StoredBlob(body, content_type, "public", uploaded_at=uploaded_at or datetime.now(UTC))
        return pathname

    def _get(self, pathname: str) -> StoredBlob:
        if pathname not in self.files:
            raise BlobNotFoundError()
        return self.files[pathname]

    async def put_blob(
        self,
        pathname,
        body,
        *,
        access,
        content_length=None,
        content_type=None,
        add_random_suffix=False,
        allow_overwrite=False,
        cache_control_max_age=None,
    ):
        assert isinstance(body, bytes | bytearray | memoryview), "the backend uploads bytes"
        if pathname in self.files and not allow_overwrite:
            raise BlobError("This blob already exists")
        self.files[pathname] = StoredBlob(bytes(body), content_type, access, cache_control_max_age)
        return SimpleNamespace(pathname=pathname, url=f"{BASE_URL}/{pathname}")

    async def head_blob(self, url_or_pathname):
        blob = self._get(url_or_pathname)
        return SimpleNamespace(
            pathname=url_or_pathname,
            size=len(blob.body),
            content_type=blob.content_type,
            uploaded_at=blob.uploaded_at,
        )

    @asynccontextmanager
    async def stream_blob(self, url_or_pathname, *, access):
        blob = self._get(url_or_pathname)

        async def chunks():
            for start in range(0, len(blob.body), 16):  # small chunks: reading stops early when it can
                yield blob.body[start : start + 16]

        yield chunks()

    async def get_blob(self, url_or_pathname, *, access):
        return SimpleNamespace(body=self._get(url_or_pathname).body)

    async def copy_blob(
        self,
        source,
        pathname,
        *,
        access,
        content_type=None,
        add_random_suffix=False,
        allow_overwrite=False,
        cache_control_max_age=None,
        if_match=None,
    ):
        original = self._get(source)
        if pathname in self.files and not allow_overwrite:
            raise BlobError("This blob already exists")
        self.files[pathname] = StoredBlob(
            original.body, content_type or original.content_type, access, cache_control_max_age
        )
        return SimpleNamespace(pathname=pathname, url=f"{BASE_URL}/{pathname}")

    async def delete_blob(self, url_or_pathname, *, if_match=None):
        targets = [url_or_pathname] if isinstance(url_or_pathname, str) else list(url_or_pathname)
        for target in targets:
            self.files.pop(target, None)  # deleting a missing blob is not an error in Vercel Blob

    async def query_blobs(self, *, prefix=None, page_size=None, cursor=None):
        for pathname, blob in list(self.files.items()):
            if prefix is None or pathname.startswith(prefix):
                yield SimpleNamespace(pathname=pathname, size=len(blob.body), uploaded_at=blob.uploaded_at)
