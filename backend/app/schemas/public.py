"""Responses of the public site's read-only endpoints: one language, camelCase JSON, computed values,
optional things as null (the site hides them)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.models.enums import Availability, ClientKind, Traffic


class PublicModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, serialize_by_alias=True)


class Ref(PublicModel):
    id: str
    title: str


class IconRef(Ref):
    icon: str | None


class TechRef(PublicModel):
    id: str
    name: str
    icon: str
    color: str


class Organization(PublicModel):
    name: str
    url: str | None
    logo: str | None


class MediaItem(PublicModel):
    type: Literal["image", "video"]
    src: str
    poster: str | None
    width: int | None
    height: int | None


# --- profile ------------------------------------------------------------------------------------


class ContactChannel(PublicModel):
    id: Literal["email", "telegram", "whatsapp", "linkedin"]
    label: str
    url: str
    handle: str


class OtherLink(PublicModel):
    id: str
    label: str
    url: str
    icon: str | None  # SVG; none → the site shows a globe
    color: str | None  # none → the site's accent


class AboutBlock(PublicModel):
    title: str
    paragraphs: list[str]
    city: str
    country_code: str
    utc_offset: str
    open_to_remote: bool
    open_to_relocation: bool


class Stats(PublicModel):
    experience_months: int
    roles: int
    projects: int
    certificates: int
    technologies: int


class Profile(PublicModel):
    first_name: str
    last_name: str
    full_name: str
    role: str
    tagline: str | None
    availability: Availability
    resume_url: str
    about: AboutBlock
    email: str | None
    contacts: list[ContactChannel]
    other_links: list[OtherLink]
    stats: Stats


class TechItem(PublicModel):
    id: str
    name: str
    icon: str
    color: str
    url: str | None
    categories: list[str]


class Skills(PublicModel):
    categories: list[IconRef]
    items: list[TechItem]


# --- experience ---------------------------------------------------------------------------------


class ExperienceItem(PublicModel):
    id: str
    role: str
    company: Organization
    start: str
    end: str | None
    description: str  # sanitized HTML
    stack: list[TechRef]
    projects: list[Ref]  # id = project slug
    testimonials: list[Ref]


class ExperiencePage(PublicModel):
    items: list[ExperienceItem]
    total: int


class ExperienceFilters(PublicModel):
    companies: list[str]
    stack: list[TechRef]
    fields: list[Ref]
    min_date: str | None
    max_date: str | None


# --- projects -----------------------------------------------------------------------------------


class ProjectCard(PublicModel):
    id: str  # the slug
    title: str
    types: list[IconRef]
    end: str
    stack: list[TechRef]  # the first three
    cover: MediaItem | None
    repo_url: str | None
    live_url: str | None
    is_private: bool


class ProjectClient(PublicModel):
    kind: ClientKind
    name: str | None
    url: str | None


class ProjectDetail(ProjectCard):
    summary: str
    description: list[str]  # paragraphs, **text** emphasized
    start: str
    client: ProjectClient
    traffic: Traffic | None
    media: list[MediaItem]


class ProjectsPage(PublicModel):
    items: list[ProjectCard]
    total: int


class ProjectFilters(PublicModel):
    clients: list[str]  # company names, plus "private" / "self"
    stack: list[TechRef]
    types: list[IconRef]
    min_date: str | None
    max_date: str | None


# --- certificates and testimonials --------------------------------------------------------------


class CertificateItem(PublicModel):
    id: str
    title: str
    issuer: Organization
    start: str
    end: str
    fields: list[Ref]
    images: list[MediaItem]
    verify_url: str | None


class CertificatesPage(PublicModel):
    items: list[CertificateItem]
    total: int


class CertificateFilters(PublicModel):
    fields: list[Ref]
    min_date: str | None
    max_date: str | None


class TestimonialProject(PublicModel):
    title: str
    href: str


class TestimonialItem(PublicModel):
    id: str
    author: str
    role: str
    company: Organization
    my_position: str
    date: str  # YYYY-MM-DD
    quote: str | None
    media: MediaItem | None
    projects: list[TestimonialProject]
    verify_url: str


class TestimonialsPage(PublicModel):
    items: list[TestimonialItem]
    total: int


class DateBounds(PublicModel):
    min_date: str | None
    max_date: str | None
