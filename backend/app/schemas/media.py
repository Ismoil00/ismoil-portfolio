"""Uploaded-file responses."""

import uuid

from app.schemas.common import OutputModel


class MediaOut(OutputModel):
    id: uuid.UUID
    purpose: str
    url: str
    content_type: str
    size_bytes: int
    width: int | None
    height: int | None
    original_name: str
    poster_url: str | None = None
