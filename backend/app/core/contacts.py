"""Contact channels (email, Telegram, WhatsApp, LinkedIn): accepted formats, and the link + visible
handle the site shows for each. Phone numbers are kept as typed (for display); links use the digits."""

import re
from typing import Literal
from urllib.parse import urlsplit

Channel = Literal["email", "telegram", "whatsapp", "linkedin"]


class InvalidContact(ValueError):
    pass


_PHONE = re.compile(r"\+\d{7,15}")
_TELEGRAM_USER = re.compile(r"[A-Za-z][A-Za-z0-9_]{4,31}")
_LINKEDIN_SLUG = re.compile(r"[A-Za-z0-9\-_%.]{3,100}")


def normalize_phone(value: str) -> str:
    """International number with the leading "+": spaces, dashes, dots and brackets are dropped."""
    compact = re.sub(r"[\s\-().]", "", value.strip())
    if not _PHONE.fullmatch(compact):
        raise InvalidContact("Use the international format, like +992 209 538 080")
    return compact


def normalize_telegram(value: str) -> str:
    """A username ("ismoil98", "@ismoil98", "https://t.me/ismoil98") or a phone number."""
    value = value.strip()
    if value.startswith("+"):
        return clean_phone(value)
    if value.lower().startswith(("https://t.me/", "http://t.me/", "t.me/")):
        value = value.split("t.me/", 1)[1].strip("/")
    value = value.removeprefix("@")
    if not _TELEGRAM_USER.fullmatch(value):
        raise InvalidContact("Use your Telegram username (5–32 letters, digits or _) or phone number")
    return value


def normalize_linkedin(value: str) -> str:
    """A LinkedIn profile link (linkedin.com/in/…), returned in one canonical form."""
    value = value.strip()
    if not value.lower().startswith(("https://", "http://")):
        value = f"https://{value}"
    parts = urlsplit(value)
    host = (parts.hostname or "").lower()
    segments = [s for s in parts.path.split("/") if s]
    if host not in {"linkedin.com", "www.linkedin.com"} or len(segments) != 2 or segments[0] != "in":
        raise InvalidContact("Use your profile link, like https://www.linkedin.com/in/your-name")
    if not _LINKEDIN_SLUG.fullmatch(segments[1]):
        raise InvalidContact("Use your profile link, like https://www.linkedin.com/in/your-name")
    return f"https://www.linkedin.com/in/{segments[1]}"


def clean_phone(value: str) -> str:
    """The number as typed (spaces tidied) after checking it's a valid international number."""
    normalize_phone(value)
    return re.sub(r"\s+", " ", value.strip())


def channel_link(channel: Channel, value: str) -> tuple[str, str]:
    """(url, handle) for a stored value: the url opens a conversation, the handle is shown under it."""
    if channel == "email":
        return f"mailto:{value}", value
    if channel == "telegram":
        if value.startswith("+"):
            return f"https://t.me/{normalize_phone(value)}", value
        return f"https://t.me/{value}", f"@{value}"
    if channel == "whatsapp":
        return f"https://wa.me/{normalize_phone(value).removeprefix('+')}", value
    return value, value.rstrip("/").rsplit("/", 1)[-1]
