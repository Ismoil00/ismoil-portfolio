"""Experience, projects, testimonials and certificates (admin requests and responses)."""

import re
import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator, Field

from app.models.enums import ClientKind, Traffic
from app.schemas.common import InputModel, OutputModel
from app.schemas.fields import (
    HttpUrl,
    I18nOptional,
    I18nRequired,
    Month,
    OptionalHttpUrl,
    UniqueIds,
    field_error,
)
from app.schemas.media import MediaOut

# Defined here so the "kind" isn't read as a type name.
RichText5000 = I18nRequired[5000, "rich"]
Paragraphs5000 = I18nRequired[5000, "multiline"]
OptionalParagraphs1000 = I18nOptional[1000, "multiline"]


def _blank_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


OptionalMonth = Annotated[Month | None, BeforeValidator(_blank_to_none)]
RequiredIds = Annotated[UniqueIds(), Field(min_length=1)]

_SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def _slug(value: str) -> str:
    value = value.strip().lower()
    if not _SLUG.fullmatch(value) or len(value) > 120:
        raise field_error("Use lowercase letters, digits and single hyphens, like design-tokens-plugin")
    return value


def _not_future(value: date) -> date:
    if value > datetime.now(UTC).date():
        raise field_error("This date is in the future")
    return value


# --- shared references in responses -------------------------------------------------------------


class CompanyRef(OutputModel):
    id: uuid.UUID
    name: str
    website_url: str | None
    logo_url: str | None = None


class NamedRef(OutputModel):
    id: uuid.UUID
    name: dict[str, str]


class InstituteRef(NamedRef):
    website_url: str | None
    logo_url: str | None = None


# --- experience ---------------------------------------------------------------------------------


class ExperienceIn(InputModel):
    title: I18nRequired[200]
    company_id: uuid.UUID
    start: Month
    end: OptionalMonth = None
    is_current: bool = False
    description: RichText5000
    tech_ids: RequiredIds
    field_ids: UniqueIds() = []
    project_ids: UniqueIds() = []
    testimonial_ids: UniqueIds() = []


class ExperienceOut(OutputModel):
    id: uuid.UUID
    title: dict[str, str]
    company: CompanyRef
    start: str
    end: str | None
    is_current: bool
    description: dict[str, str]
    tech_ids: list[uuid.UUID]
    field_ids: list[uuid.UUID]
    project_ids: list[uuid.UUID]
    testimonial_ids: list[uuid.UUID]
    updated_at: datetime


# --- projects -----------------------------------------------------------------------------------


class ProjectIn(InputModel):
    title: I18nRequired[200]
    # The page address (/projects/<slug>). Made from the English title when left out.
    slug: Annotated[str | None, BeforeValidator(_blank_to_none), AfterValidator(lambda v: v and _slug(v))] = None
    description: Paragraphs5000
    start: Month
    end: Month
    client_kind: ClientKind
    company_id: uuid.UUID | None = None
    traffic: Traffic
    live_url: OptionalHttpUrl = None
    repo_url: OptionalHttpUrl = None
    is_private: bool = False
    type_ids: RequiredIds
    tech_ids: RequiredIds
    media_ids: UniqueIds(50) = []
    cover_id: uuid.UUID | None = None


class ProjectOut(OutputModel):
    id: uuid.UUID
    slug: str
    title: dict[str, str]
    description: dict[str, str]
    start: str
    end: str
    client_kind: ClientKind
    company: CompanyRef | None
    traffic: Traffic | None  # empty only on seeded projects; the editor asks for it
    live_url: str | None
    repo_url: str | None
    is_private: bool
    type_ids: list[uuid.UUID]
    tech_ids: list[uuid.UUID]
    media: list[MediaOut]
    cover_id: uuid.UUID | None
    updated_at: datetime


# --- testimonials -------------------------------------------------------------------------------


class TestimonialIn(InputModel):
    author_name: I18nRequired[100]
    author_role: I18nRequired[100]
    company_id: uuid.UUID
    position_id: uuid.UUID
    given_on: Annotated[date, AfterValidator(_not_future)]
    quote: OptionalParagraphs1000 = None
    media_id: uuid.UUID | None = None
    verify_url: HttpUrl
    project_ids: UniqueIds() = []


class TestimonialOut(OutputModel):
    id: uuid.UUID
    author_name: dict[str, str]
    author_role: dict[str, str]
    company: CompanyRef
    position: NamedRef
    given_on: date
    quote: dict[str, str] | None
    media: MediaOut | None
    verify_url: str
    project_ids: list[uuid.UUID]
    updated_at: datetime


# --- certificates -------------------------------------------------------------------------------


class CertificateIn(InputModel):
    title: I18nRequired[200]
    institute_id: uuid.UUID
    start: Month
    end: Month
    verify_url: HttpUrl
    field_ids: UniqueIds() = []
    image_ids: Annotated[UniqueIds(20), Field(min_length=1)]


class CertificateOut(OutputModel):
    id: uuid.UUID
    title: dict[str, str]
    institute: InstituteRef
    start: str
    end: str
    verify_url: str | None  # empty only on seeded certificates; the editor asks for it
    field_ids: list[uuid.UUID]
    images: list[MediaOut]
    updated_at: datetime
