"""Text rules: plain text cleaning, person names, URLs, rich text, months."""

from datetime import date

import pytest

from app.core.text import (
    InvalidValue,
    clean_multiline,
    clean_single_line,
    date_to_month,
    is_person_name,
    month_to_date,
    rich_text_length,
    sanitize_rich_html,
    validate_url,
)

# --- plain text ---------------------------------------------------------------------------------


def test_single_line_trims_and_collapses_whitespace_and_drops_control_chars():
    assert clean_single_line("  Full-stack\t engineer\x00\x07 ") == "Full-stack engineer"
    assert clean_single_line("a\nb") == "a b"


def test_multiline_keeps_paragraphs_but_normalizes_line_endings():
    text = "First line\r\nsecond\x00 line\r\n\r\n\r\n\r\nNew paragraph  "
    assert clean_multiline(text) == "First line\nsecond line\n\nNew paragraph"


# --- names --------------------------------------------------------------------------------------


@pytest.mark.parametrize("name", ["Ismoil", "Исмоил", "Шарифов", "Jean-Luc", "O'Neil", "Ғаффорӣ", "José"])
def test_valid_person_names(name):
    assert is_person_name(name)


@pytest.mark.parametrize("name", ["", "Ismoil Sharifov", "R2D2", "<script>", "-Ann", "Ann-", "a_b", "x" * 101])
def test_invalid_person_names(name):
    assert not is_person_name(name)


# --- URLs ---------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    ["https://example.com", "http://example.com/path?q=1#x", "https://sub.example.co.uk/a/b", "https://t.me/+992000"],
)
def test_valid_urls(url):
    assert validate_url(url) == url


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html;base64,PHNjcmlwdD4=",
        "ftp://example.com",
        "//example.com",
        "example.com",
        "https://",
        "https://user:pass@example.com",
        "https://exa mple.com",
        "https://example.com/\x00",
        "https://example.com/" + "a" * 2050,
    ],
)
def test_invalid_urls(url):
    with pytest.raises(InvalidValue):
        validate_url(url)


def test_mailto_only_when_allowed():
    with pytest.raises(InvalidValue):
        validate_url("mailto:me@example.com")
    assert validate_url("mailto:me@example.com", allow_mailto=True) == "mailto:me@example.com"


# --- rich text ----------------------------------------------------------------------------------


def test_rich_text_keeps_allowed_formatting():
    html = "<p><strong>Bold</strong> <em>it</em> <u>u</u> <s>s</s></p><ul><li>one</li></ul><ol><li>two</li></ol>"
    assert sanitize_rich_html(html) == html


def test_rich_text_removes_scripts_handlers_and_unknown_tags():
    dirty = '<p onclick="steal()">Hi<script>alert(1)</script><img src=x onerror=alert(1)><iframe></iframe></p>'
    clean = sanitize_rich_html(dirty)
    assert "script" not in clean and "onclick" not in clean and "img" not in clean and "iframe" not in clean
    assert clean == "<p>Hi</p>"


def test_rich_text_links_are_safe():
    clean = sanitize_rich_html('<p><a href="javascript:alert(1)">x</a> <a href="https://ok.example">ok</a></p>')
    assert "javascript" not in clean
    assert 'href="https://ok.example"' in clean
    assert 'rel="noopener noreferrer nofollow"' in clean
    assert 'target="_blank"' in clean


def test_rich_text_length_counts_visible_characters_only():
    assert rich_text_length("<p><strong>Hello</strong> &amp; bye</p>") == len("Hello & bye")
    assert rich_text_length("<ul><li>a</li><li>b</li></ul>") == 2


def test_rich_text_without_text_counts_as_empty():
    assert rich_text_length(sanitize_rich_html("<p><br></p><p>  </p>")) == 0


# --- months -------------------------------------------------------------------------------------


def test_month_round_trip():
    assert month_to_date("2024-03") == date(2024, 3, 1)
    assert date_to_month(date(2024, 3, 1)) == "2024-03"


@pytest.mark.parametrize("value", ["2024-13", "2024-3", "24-03", "2024-03-01", "", "abcd-ef"])
def test_invalid_months(value):
    with pytest.raises(InvalidValue):
        month_to_date(value)
