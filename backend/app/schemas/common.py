"""Base schema classes shared by every endpoint."""

from pydantic import BaseModel, ConfigDict


class InputModel(BaseModel):
    """Request bodies: unknown fields are refused (no mass assignment), text is trimmed."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OutputModel(BaseModel):
    """Response bodies, built from ORM objects or dicts."""

    model_config = ConfigDict(from_attributes=True)
