"""Selectors: the reusable lists the other pages pick from (Selectors page in the admin panel).

`position` orders each list in the admin panel's dropdowns.
"""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, I18nDict, Timestamps, UUIDPk
from app.models.links import tech_stack_fields, tech_stack_instruments
from app.models.media import Media


class DevelopmentField(UUIDPk, Timestamps, Base):
    """A direction of IT ("Backend", "AI & LLM", "Civil engineering"…): experience and certificate
    filters, and a tech-stack filter when activated on the Tech stack page."""

    __tablename__ = "development_fields"

    name: Mapped[I18nDict]
    icon_svg: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(default=0)
    filter_active: Mapped[bool] = mapped_column(default=False)
    filter_position: Mapped[int] = mapped_column(default=0)


class Instrument(UUIDPk, Timestamps, Base):
    """A kind of tool ("Languages & frameworks", "APIs & protocols", "Tools"…): tech-stack filters."""

    __tablename__ = "instruments"

    name: Mapped[I18nDict]
    icon_svg: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(default=0)
    filter_active: Mapped[bool] = mapped_column(default=False)
    filter_position: Mapped[int] = mapped_column(default=0)


class TechStack(UUIDPk, Timestamps, Base):
    """A technology (Python, Docker…). Shown on the site's Tech stack section when activated."""

    __tablename__ = "tech_stacks"

    name: Mapped[str] = mapped_column(String(100), unique=True)
    icon_svg: Mapped[str] = mapped_column(Text)
    color: Mapped[str] = mapped_column(String(7))
    docs_url: Mapped[str | None] = mapped_column(String(2048))
    position: Mapped[int] = mapped_column(default=0)
    showcase_active: Mapped[bool] = mapped_column(default=False)
    showcase_position: Mapped[int] = mapped_column(default=0)

    fields: Mapped[list[DevelopmentField]] = relationship(
        secondary=tech_stack_fields, order_by=tech_stack_fields.c.position, viewonly=True, lazy="selectin"
    )
    instruments: Mapped[list[Instrument]] = relationship(
        secondary=tech_stack_instruments, order_by=tech_stack_instruments.c.position, viewonly=True, lazy="selectin"
    )


class Position(UUIDPk, Timestamps, Base):
    """A position I held ("Full-stack developer"…): "My position" on testimonials."""

    __tablename__ = "positions"

    name: Mapped[I18nDict]
    position: Mapped[int] = mapped_column(default=0)


class Company(UUIDPk, Timestamps, Base):
    """Employer or client: experience, projects, testimonials."""

    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(100), unique=True)
    website_url: Mapped[str | None] = mapped_column(String(2048))
    logo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media.id", ondelete="RESTRICT"), unique=True)
    position: Mapped[int] = mapped_column(default=0)

    logo: Mapped[Media | None] = relationship(lazy="joined")


class Institute(UUIDPk, Timestamps, Base):
    """University, school or course platform: certificates."""

    __tablename__ = "institutes"

    name: Mapped[I18nDict]
    website_url: Mapped[str | None] = mapped_column(String(2048))
    logo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media.id", ondelete="RESTRICT"), unique=True)
    position: Mapped[int] = mapped_column(default=0)

    logo: Mapped[Media | None] = relationship(lazy="joined")


class ProductType(UUIDPk, Timestamps, Base):
    """What a project is (Web, Mobile, Game…)."""

    __tablename__ = "product_types"

    name: Mapped[I18nDict]
    icon_svg: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(default=0)


class LinkPlatform(UUIDPk, Timestamps, Base):
    """Icon + name of an "Other link" (GitHub, LeetCode, a special project…)."""

    __tablename__ = "link_platforms"

    name: Mapped[str] = mapped_column(String(100), unique=True)
    icon_svg: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(7))
    position: Mapped[int] = mapped_column(default=0)
