"""Experience, projects, testimonials, certificates and contact-form messages."""

import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, I18nDict, Timestamps, UUIDPk
from app.models import links
from app.models.enums import ClientKind, Traffic, sql_in
from app.models.media import Media
from app.models.selectors import Company, DevelopmentField, Institute, ProductType, TechStack


def _ordered(secondary, target):  # view-only link, ordered by position
    return relationship(target, secondary=secondary, order_by=secondary.c.position, viewonly=True, lazy="selectin")


class Experience(UUIDPk, Timestamps, Base):
    __tablename__ = "experiences"
    __table_args__ = (
        CheckConstraint(
            "(is_current AND end_month IS NULL) OR (NOT is_current AND end_month IS NOT NULL)",
            name="current_has_no_end",
        ),
        CheckConstraint("end_month IS NULL OR end_month >= start_month", name="end_after_start"),
        # Only one job can be "present".
        Index("uq_experiences_single_current", "is_current", unique=True, postgresql_where=text("is_current")),
    )

    title: Mapped[I18nDict]
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), index=True)
    start_month: Mapped[date] = mapped_column(Date)
    end_month: Mapped[date | None] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(default=False)
    # Rich text (sanitized HTML) per language.
    description: Mapped[I18nDict]

    company: Mapped[Company] = relationship(lazy="joined")
    techs: Mapped[list[TechStack]] = _ordered(links.experience_techs, TechStack)
    fields: Mapped[list[DevelopmentField]] = _ordered(links.experience_fields, DevelopmentField)
    projects: Mapped[list["Project"]] = _ordered(links.experience_projects, "Project")
    testimonials: Mapped[list["Testimonial"]] = _ordered(links.experience_testimonials, "Testimonial")


class Project(UUIDPk, Timestamps, Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint(sql_in(ClientKind, "client_kind"), name="client_kind"),
        CheckConstraint("(client_kind = 'company') = (company_id IS NOT NULL)", name="company_matches_kind"),
        CheckConstraint(sql_in(Traffic, "traffic"), name="traffic"),
        CheckConstraint("end_month >= start_month", name="end_after_start"),
        CheckConstraint("is_private = (live_url IS NULL AND repo_url IS NULL)", name="private_has_no_links"),
    )

    slug: Mapped[str] = mapped_column(String(120), unique=True)
    title: Mapped[I18nDict]
    # Plain text per language: a blank line starts a new paragraph, **text** is emphasized.
    description: Mapped[I18nDict]
    start_month: Mapped[date] = mapped_column(Date)
    end_month: Mapped[date] = mapped_column(Date)
    client_kind: Mapped[str] = mapped_column(String(16))
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), index=True)
    # Required when saving through the API; empty only for seeded projects whose traffic isn't known yet.
    traffic: Mapped[str | None] = mapped_column(String(16))
    live_url: Mapped[str | None] = mapped_column(String(2048))
    repo_url: Mapped[str | None] = mapped_column(String(2048))
    is_private: Mapped[bool] = mapped_column(default=False)
    cover_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media.id", ondelete="SET NULL"))

    company: Mapped[Company | None] = relationship(lazy="joined")
    cover: Mapped[Media | None] = relationship(lazy="joined")
    types: Mapped[list[ProductType]] = _ordered(links.project_types, ProductType)
    techs: Mapped[list[TechStack]] = _ordered(links.project_techs, TechStack)
    media: Mapped[list[Media]] = _ordered(links.project_media, Media)


class Testimonial(UUIDPk, Timestamps, Base):
    """A recommendation. My role then is a development field or a technology, shown with "development"
    added ("Frontend development", "Python development")."""

    __tablename__ = "testimonials"
    __table_args__ = (CheckConstraint("(field_id IS NULL) <> (tech_stack_id IS NULL)", name="one_role"),)

    author_name: Mapped[I18nDict]
    author_role: Mapped[I18nDict]
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), index=True)
    # My role: exactly one of these two.
    field_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("development_fields.id", ondelete="RESTRICT"), index=True
    )
    tech_stack_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tech_stacks.id", ondelete="RESTRICT"), index=True
    )
    given_on: Mapped[date] = mapped_column(Date)
    quote: Mapped[I18nDict | None]
    media_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media.id", ondelete="RESTRICT"), unique=True)
    verify_url: Mapped[str] = mapped_column(String(2048))

    company: Mapped[Company] = relationship(lazy="joined")
    field: Mapped[DevelopmentField | None] = relationship(lazy="joined")
    tech_stack: Mapped[TechStack | None] = relationship(lazy="joined")
    media: Mapped[Media | None] = relationship(lazy="joined")
    projects: Mapped[list[Project]] = _ordered(links.testimonial_projects, Project)


class Certificate(UUIDPk, Timestamps, Base):
    __tablename__ = "certificates"
    __table_args__ = (CheckConstraint("end_month >= start_month", name="end_after_start"),)

    title: Mapped[I18nDict]
    institute_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("institutes.id", ondelete="RESTRICT"), index=True)
    start_month: Mapped[date] = mapped_column(Date)
    end_month: Mapped[date] = mapped_column(Date)
    # Required when saving through the API; empty only for seeded records that had no verification page.
    verify_url: Mapped[str | None] = mapped_column(String(2048))

    institute: Mapped[Institute] = relationship(lazy="joined")
    fields: Mapped[list[DevelopmentField]] = _ordered(links.certificate_fields, DevelopmentField)
    images: Mapped[list[Media]] = _ordered(links.certificate_media, Media)


class ContactMessage(UUIDPk, Base):
    """A message sent through the public site's contact form."""

    __tablename__ = "contact_messages"
    __table_args__ = (Index("ix_contact_messages_ip_time", "ip_hash", "created_at"),)

    name: Mapped[str] = mapped_column(String(100))
    contact: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    ip_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
