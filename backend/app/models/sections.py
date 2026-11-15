"""Single-row sections (Hero, About, Contacts) and the "Other links" list."""

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, I18nDict, Timestamps, UUIDPk
from app.models.enums import Availability, sql_in
from app.models.media import Media
from app.models.selectors import LinkPlatform


def single_row() -> CheckConstraint:
    """A new constraint per table (a constraint object can belong to one table only)."""
    return CheckConstraint("id = 1", name="single_row")


class Hero(Timestamps, Base):
    __tablename__ = "hero"
    __table_args__ = (single_row(), CheckConstraint(sql_in(Availability, "availability"), name="availability"))

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    first_name: Mapped[I18nDict]
    last_name: Mapped[I18nDict]
    role: Mapped[I18nDict]
    description: Mapped[I18nDict | None]
    resume_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media.id", ondelete="RESTRICT"))
    availability: Mapped[str] = mapped_column(String(16))

    resume: Mapped[Media] = relationship(lazy="joined")


class About(Timestamps, Base):
    __tablename__ = "about"
    __table_args__ = (single_row(),)

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    title: Mapped[I18nDict]
    paragraph_1: Mapped[I18nDict]
    paragraph_2: Mapped[I18nDict | None]
    city: Mapped[I18nDict]
    country_code: Mapped[str] = mapped_column(String(2))
    timezone: Mapped[str] = mapped_column(String(64))
    open_to_remote: Mapped[bool]
    open_to_relocation: Mapped[bool]


class Contacts(Timestamps, Base):
    """Direct ways to reach me; at least two are set."""

    __tablename__ = "contacts"
    __table_args__ = (single_row(),)

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    email: Mapped[str | None] = mapped_column(String(254))
    telegram: Mapped[str | None] = mapped_column(String(64))
    whatsapp: Mapped[str | None] = mapped_column(String(32))
    linkedin: Mapped[str | None] = mapped_column(String(2048))


class OtherLink(UUIDPk, Timestamps, Base):
    __tablename__ = "other_links"

    platform_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("link_platforms.id", ondelete="RESTRICT"), index=True)
    url: Mapped[str] = mapped_column(String(2048))
    position: Mapped[int] = mapped_column(default=0)

    platform: Mapped[LinkPlatform] = relationship(lazy="joined")
