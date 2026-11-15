"""Contact channels: what's accepted, and the links/handles built from them."""

import pytest

from app.core.contacts import (
    InvalidContact,
    channel_link,
    clean_phone,
    normalize_linkedin,
    normalize_phone,
    normalize_telegram,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("+992 209 53 80 80", "+992209538080"),
        ("+992-209-538-080", "+992209538080"),
        ("+1 (415) 555-0100", "+14155550100"),
    ],
)
def test_phone_numbers_are_normalized(raw, expected):
    assert normalize_phone(raw) == expected


def test_phone_kept_as_typed_for_display():
    assert clean_phone("  +992   209 538080 ") == "+992 209 538080"


@pytest.mark.parametrize("raw", ["992209538080", "+12", "+99220953808012345", "call me", "+992 abc"])
def test_invalid_phone_numbers(raw):
    with pytest.raises(InvalidContact):
        normalize_phone(raw)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("@ismoil98", "ismoil98"),
        ("ismoil_dev", "ismoil_dev"),
        ("https://t.me/ismoil98", "ismoil98"),
        ("+992  209538080 ", "+992 209538080"),
    ],
)
def test_telegram_accepts_username_link_or_phone(raw, expected):
    assert normalize_telegram(raw) == expected


@pytest.mark.parametrize("raw", ["ab", "has space", "@1abc", "https://evil.example/x"])
def test_invalid_telegram(raw):
    with pytest.raises(InvalidContact):
        normalize_telegram(raw)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://linkedin.com/in/ismoil-sharifov-b162a5425", "https://www.linkedin.com/in/ismoil-sharifov-b162a5425"),
        ("https://www.linkedin.com/in/ismoil-sharifov/", "https://www.linkedin.com/in/ismoil-sharifov"),
        ("linkedin.com/in/someone", "https://www.linkedin.com/in/someone"),
    ],
)
def test_linkedin_profile_links(raw, expected):
    assert normalize_linkedin(raw) == expected


@pytest.mark.parametrize("raw", ["https://example.com/in/x", "https://linkedin.com/company/x", "javascript:alert(1)"])
def test_invalid_linkedin(raw):
    with pytest.raises(InvalidContact):
        normalize_linkedin(raw)


def test_links_and_handles():
    assert channel_link("email", "me@example.com") == ("mailto:me@example.com", "me@example.com")
    assert channel_link("telegram", "ismoil98") == ("https://t.me/ismoil98", "@ismoil98")
    assert channel_link("telegram", "+992 209538080") == ("https://t.me/+992209538080", "+992 209538080")
    assert channel_link("whatsapp", "+992 209-538-080") == ("https://wa.me/992209538080", "+992 209-538-080")
    assert channel_link("linkedin", "https://www.linkedin.com/in/ismoil-sharifov") == (
        "https://www.linkedin.com/in/ismoil-sharifov",
        "ismoil-sharifov",
    )
