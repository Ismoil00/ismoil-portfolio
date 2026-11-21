"""Hero, About, Contacts, Other links, Tech stack page and contact-form messages."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BeforeValidator, EmailStr, Field, model_validator

from app.core.contacts import InvalidContact, clean_phone, normalize_linkedin, normalize_telegram
from app.core.places import COUNTRY_CODES, time_zones
from app.core.text import clean_multiline, clean_single_line
from app.models.enums import Availability
from app.schemas.common import InputModel, OutputModel
from app.schemas.fields import HttpUrl, I18nOptional, I18nRequired, PersonNameI18n, UniqueIds, field_error
from app.schemas.media import MediaOut

# Paragraph texts (line breaks kept); defined here so the "kind" isn't read as a type name.
Paragraphs1000 = I18nRequired[1000, "multiline"]
OptionalParagraphs1000 = I18nOptional[1000, "multiline"]

# --- Hero ---------------------------------------------------------------------------------------


class HeroIn(InputModel):
    first_name: PersonNameI18n
    last_name: PersonNameI18n
    role: I18nRequired[500]
    description: OptionalParagraphs1000 = None
    resume_id: uuid.UUID
    availability: Availability


class HeroOut(OutputModel):
    first_name: dict[str, str]
    last_name: dict[str, str]
    role: dict[str, str]
    description: dict[str, str] | None
    resume: MediaOut
    availability: Availability
    updated_at: datetime


# --- About --------------------------------------------------------------------------------------


def _country(value: str) -> str:
    value = value.upper()
    if value not in COUNTRY_CODES:
        raise field_error("Pick a country from the list")
    return value


def _zone(value: str) -> str:
    if value not in time_zones():
        raise field_error("Pick a time zone from the list")
    return value


class AboutIn(InputModel):
    title: I18nRequired[200]
    paragraph_1: Paragraphs1000
    paragraph_2: OptionalParagraphs1000 = None
    city: I18nRequired[100]
    country_code: Annotated[str, AfterValidator(_country)]
    timezone: Annotated[str, AfterValidator(_zone)]
    open_to_remote: bool
    open_to_relocation: bool


class AboutOut(OutputModel):
    title: dict[str, str]
    paragraph_1: dict[str, str]
    paragraph_2: dict[str, str] | None
    city: dict[str, str]
    country_code: str
    timezone: str
    utc_offset: str  # "GMT+5", for display
    open_to_remote: bool
    open_to_relocation: bool
    updated_at: datetime


# --- Contacts -----------------------------------------------------------------------------------


def _blank_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


def _contact(normalize):
    def validate(value: str) -> str:
        try:
            return normalize(value)
        except InvalidContact as error:
            raise field_error(str(error)) from error

    return validate


Optional = lambda inner: Annotated[inner | None, BeforeValidator(_blank_to_none)]  # noqa: E731


class ContactsIn(InputModel):
    email: Optional(Annotated[EmailStr, Field(max_length=254)]) = None
    telegram: Optional(Annotated[str, Field(max_length=64), AfterValidator(_contact(normalize_telegram))]) = None
    whatsapp: Optional(Annotated[str, Field(max_length=32), AfterValidator(_contact(clean_phone))]) = None
    linkedin: Optional(Annotated[str, Field(max_length=2048), AfterValidator(_contact(normalize_linkedin))]) = None

    @model_validator(mode="after")
    def at_least_two(self) -> "ContactsIn":
        if sum(v is not None for v in (self.email, self.telegram, self.whatsapp, self.linkedin)) < 2:
            raise ValueError("Fill in at least two ways to reach you")
        return self


class ContactLink(OutputModel):
    url: str
    handle: str


class ContactsOut(OutputModel):
    email: str | None
    telegram: str | None
    whatsapp: str | None
    linkedin: str | None
    # What the site shows for each (null when not set).
    links: dict[str, ContactLink | None]
    updated_at: datetime


# --- Other links --------------------------------------------------------------------------------


class OtherLinkIn(InputModel):
    platform_id: uuid.UUID
    url: HttpUrl


class PlatformRef(OutputModel):
    id: uuid.UUID
    name: str
    icon_svg: str | None
    color: str | None


class OtherLinkOut(OutputModel):
    id: uuid.UUID
    platform: PlatformRef
    url: str
    position: int


# --- Tech stack page ----------------------------------------------------------------------------


class ShowcaseFilter(InputModel):
    kind: Literal["field", "instrument"]
    id: uuid.UUID


def _unique_filters(filters: list[ShowcaseFilter]) -> list[ShowcaseFilter]:
    if len({(f.kind, f.id) for f in filters}) != len(filters):
        raise field_error("Each filter can be picked only once")
    return filters


class TechShowcaseIn(InputModel):
    filters: Annotated[list[ShowcaseFilter], AfterValidator(_unique_filters), Field(max_length=50)] = []
    tech_ids: Annotated[UniqueIds(500), Field(min_length=1)]


class TechShowcaseOut(OutputModel):
    filters: list[ShowcaseFilter]
    tech_ids: list[uuid.UUID]


# --- Contact form messages ----------------------------------------------------------------------


def _single_line(max_length: int):
    def validate(value: str) -> str:
        value = clean_single_line(value)
        if not value:
            raise field_error("Fill in this field")
        if len(value) > max_length:
            raise field_error(f"Use at most {max_length} characters")
        return value

    return validate


def _message(value: str) -> str:
    value = clean_multiline(value)
    if not value:
        raise field_error("Write a message")
    if len(value) > 2000:
        raise field_error("Use at most 2000 characters")
    return value


def _reply_to(value: str) -> str:
    """An email address or a phone number (WhatsApp)."""
    value = clean_single_line(value)
    if "@" in value:
        local, _, domain = value.partition("@")
        if local and "." in domain and " " not in value and len(value) <= 200:
            return value
    else:
        try:
            return clean_phone(value)
        except InvalidContact:
            pass
    raise field_error("Enter a valid email or WhatsApp number")


class ContactMessageIn(InputModel):
    name: Annotated[str, Field(max_length=500), AfterValidator(_single_line(100))]
    contact: Annotated[str, Field(max_length=500), AfterValidator(_reply_to)]
    message: Annotated[str, Field(max_length=10_000), AfterValidator(_message)]
    # Hidden form field: people leave it empty, form-filling bots don't.
    website: str | None = Field(default=None, max_length=500)
    # "chat": the form was filled from a conversation with the AI assistant ("Send this chat to …").
    source: Literal["form", "chat"] = "form"


class ContactMessageOut(OutputModel):
    id: uuid.UUID
    name: str
    contact: str
    message: str
    source: str
    created_at: datetime


class MessagesPage(OutputModel):
    items: list[ContactMessageOut]
    total: int
