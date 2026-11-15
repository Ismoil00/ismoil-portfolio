"""Uploaded files (the bytes live in storage; this row describes them)."""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPk
from app.models.enums import MediaPurpose, sql_in


class Media(UUIDPk, Base):
    __tablename__ = "media"
    __table_args__ = (CheckConstraint(sql_in(MediaPurpose, "purpose"), name="purpose"),)

    purpose: Mapped[str] = mapped_column(String(32))
    storage_key: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    width: Mapped[int | None]
    height: Mapped[int | None]
    original_name: Mapped[str] = mapped_column(String(255))
    # Still frame shown before a video plays (captured in the admin panel's browser).
    poster_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # A self-reference: eager loading stops at a table already seen up the chain unless join_depth
    # allows it (project → file → poster is 2 levels of `media`).
    poster: Mapped["Media | None"] = relationship(remote_side="Media.id", lazy="selectin", join_depth=2)

    @property
    def is_video(self) -> bool:
        return self.content_type.startswith("video/")
