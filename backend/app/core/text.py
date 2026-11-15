"""Rules for text values: cleaning, person names, links, rich text and "YYYY-MM" months."""

import html
import re
import unicodedata
from datetime import date
from urllib.parse import urlsplit

import nh3


class InvalidValue(ValueError):
    pass


# Control characters, zero-width space, and bidi overrides (used to disguise text, "Trojan source").
_INVISIBLE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f​‎‏‪-‮⁦-⁩]")


def clean_single_line(text: str) -> str:
    text = _INVISIBLE.sub("", unicodedata.normalize("NFC", text))
    return re.sub(r"\s+", " ", text).strip()


def clean_multiline(text: str) -> str:
    """Keeps line breaks and paragraphs (blank lines), at most one blank line in a row."""
    text = unicodedata.normalize("NFC", text).replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    text = _INVISIBLE.sub("", text)
    lines = [re.sub(r" {2,}", " ", line).rstrip() for line in text.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


# Letters of any script, joined by single hyphens or apostrophes ("Jean-Luc", "O'Neil"). No spaces.
_NAME = re.compile(r"[^\W\d_]+(?:['’ʼ-][^\W\d_]+)*")


def is_person_name(value: str) -> bool:
    value = unicodedata.normalize("NFC", value)
    return 0 < len(value) <= 100 and _NAME.fullmatch(value) is not None


_URL_FORBIDDEN = re.compile(r"[\s\x00-\x1f\x7f]")
_HOST = re.compile(r"(?=.{1,253}$)(?!-)[^\s/:?#@\\]+")
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def validate_url(url: str, *, allow_mailto: bool = False) -> str:
    """Absolute http(s) link (or mailto: when allowed); anything that could run code is refused."""
    if not url or len(url) > 2048 or _URL_FORBIDDEN.search(url):
        raise InvalidValue("Enter a valid link")
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    if scheme == "mailto" and allow_mailto:
        if not _EMAIL.fullmatch(parts.path):
            raise InvalidValue("Enter a valid email link")
        return url
    if scheme not in {"http", "https"}:
        raise InvalidValue("Links must start with https:// or http://")
    try:
        host, _port = parts.hostname, parts.port  # .port raises on a bad port
    except ValueError as error:
        raise InvalidValue("Enter a valid link") from error
    if not host or parts.username or parts.password or not _HOST.fullmatch(host) or "." not in host.strip("."):
        raise InvalidValue("Enter a valid link")
    return url


RICH_TAGS = {"p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a"}


def sanitize_rich_html(value: str) -> str:
    """Formatting from the rich-text editor, reduced to an allow-list; links open safely in a new tab."""
    return nh3.clean(
        value,
        tags=RICH_TAGS,
        attributes={"a": {"href"}},
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer nofollow",
        set_tag_attribute_values={"a": {"target": "_blank"}},
        strip_comments=True,
    )


def rich_text_length(value: str) -> int:
    """Number of visible characters (tags removed, entities decoded, whitespace runs counted once)."""
    text = html.unescape(nh3.clean(value, tags=set()))
    return len(re.sub(r"\s+", " ", text).strip())


_MONTH = re.compile(r"(\d{4})-(0[1-9]|1[0-2])")


def month_to_date(value: str) -> date:
    match = _MONTH.fullmatch(value or "")
    if not match:
        raise InvalidValue("Use the YYYY-MM format")
    return date(int(match[1]), int(match[2]), 1)


def date_to_month(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"
