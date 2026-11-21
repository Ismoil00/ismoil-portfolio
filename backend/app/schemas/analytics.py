"""Visit statistics: what the public site reports, and what the admin panel reads."""

import uuid
from datetime import date
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.common import InputModel, OutputModel


class VisitEventIn(InputModel):
    kind: Literal["page_view", "resume_download"]
    # A path on the site ("/en/projects"); the query string and #fragment are dropped.
    path: str = Field(pattern=r"^/", max_length=300)
    locale: Literal["en", "ru", "tg"]
    device: Literal["mobile", "tablet", "desktop"]
    # Two-letter country code from the hosting platform (Vercel), when known.
    country: str | None = Field(None, pattern=r"^[A-Za-z]{2}$")
    # The page the visitor came from (any URL); only its host is kept.
    referrer: str | None = Field(None, max_length=2048)
    # Only when the visitor accepted analytics cookies.
    visitor_id: uuid.UUID | None = None
    user_agent: str = Field("", max_length=1000)

    @field_validator("path")
    @classmethod
    def _no_query(cls, value: str) -> str:
        return value.split("?", 1)[0].split("#", 1)[0] or "/"


class CountOut(OutputModel):
    name: str
    count: int


class DayOut(OutputModel):
    date: date
    page_views: int
    visitors: int


class TotalsOut(OutputModel):
    page_views: int
    visitors: int
    resume_downloads: int
    messages: int


class ModelUsageOut(OutputModel):
    """One Groq model's use of its free quota, over the windows Groq counts in (rolling), next to the
    share the site allows itself (a little below Groq's own limits)."""

    model: str
    requests_day: int
    requests_day_limit: int
    tokens_day: int
    tokens_day_limit: int
    tokens_hour: int
    tokens_hour_limit: int
    tokens_minute: int
    tokens_minute_limit: int


class AssistantUsageOut(OutputModel):
    ready: bool  # GROQ_API_KEY is set
    enabled: bool  # switched on in Settings
    models: list[ModelUsageOut]


class AnalyticsOut(OutputModel):
    days: int
    totals: TotalsOut
    daily: list[DayOut]
    pages: list[CountOut]
    referrers: list[CountOut]
    countries: list[CountOut]
    locales: list[CountOut]
    devices: list[CountOut]
    # The AI assistant's most asked questions (only from visitors who accepted analytics cookies).
    questions: list[CountOut]
    # The AI assistant's use of Groq's free quota right now (filled in by the endpoint).
    assistant: AssistantUsageOut | None = None
