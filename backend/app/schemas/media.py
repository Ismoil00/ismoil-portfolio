"""Uploaded-file responses."""

import uuid

from pydantic import Field

from app.schemas.common import InputModel, OutputModel


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


class DirectUploadIn(InputModel):
    """A staging path the admin panel wants to upload to: incoming/<purpose>/<32 hex>."""

    pathname: str = Field(max_length=200)


class DirectUploadLimitOut(OutputModel):
    maximum_size_in_bytes: int
