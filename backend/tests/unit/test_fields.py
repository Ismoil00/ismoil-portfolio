"""Reusable request field types: three-language texts, names, links, months, colors."""

import pytest
from pydantic import ValidationError

from app.schemas.common import InputModel
from app.schemas.fields import HexColor, HttpUrl, I18nOptional, I18nRequired, Month, PersonNameI18n

RichBody = I18nRequired[50, "rich"]


class Sample(InputModel):
    title: I18nRequired[200]
    note: I18nOptional[1000] = None
    body: RichBody | None = None
    url: HttpUrl | None = None
    month: Month | None = None
    color: HexColor | None = None


class Names(InputModel):
    first: PersonNameI18n


def errors(**data):
    with pytest.raises(ValidationError) as error:
        Sample(**data)
    return {tuple(e["loc"]): e["msg"] for e in error.value.errors()}


TITLE = {"en": "Hello", "ru": "Привет", "tg": "Салом"}


def test_valid_texts_are_trimmed():
    sample = Sample(title={"en": "  Hello ", "ru": "Привет", "tg": "Салом"})
    assert sample.title == TITLE


def test_every_language_is_required():
    found = errors(title={"en": "Hello", "ru": "", "tg": "Салом"})
    assert ("title", "ru") in found
    assert ("title", "tg") in errors(title={"en": "Hello", "ru": "Привет"})


def test_length_is_checked_per_language():
    assert ("title", "tg") in errors(title={**TITLE, "tg": "x" * 201})


def test_unknown_languages_are_refused():
    assert errors(title={**TITLE, "de": "Hallo"})


def test_optional_text_is_all_or_nothing():
    assert Sample(title=TITLE, note=None).note is None
    assert Sample(title=TITLE, note={"en": "", "ru": " ", "tg": ""}).note is None  # empty tabs = not set
    assert ("note", "ru") in errors(title=TITLE, note={"en": "Hi", "ru": "", "tg": "Салом"})


def test_rich_text_is_sanitized_and_measured_by_visible_text():
    sample = Sample(title=TITLE, body={lang: "<p><b>ok</b><script>x</script></p>" for lang in ("en", "ru", "tg")})
    assert sample.body["en"] == "<p><b>ok</b></p>"
    long_html = "<p>" + "<strong>a</strong>" * 40 + "</p>"  # 40 visible characters, long HTML
    assert Sample(title=TITLE, body={lang: long_html for lang in ("en", "ru", "tg")}).body
    assert ("body", "en") in errors(title=TITLE, body={lang: "<p>" + "a" * 51 + "</p>" for lang in ("en", "ru", "tg")})
    assert ("body", "ru") in errors(title=TITLE, body={"en": "<p>a</p>", "ru": "<p> </p>", "tg": "<p>a</p>"})


def test_links_months_and_colors():
    ok = Sample(title=TITLE, url="https://example.com", month="2024-03", color="#3776ab")
    assert ok.color == "#3776AB"
    assert ("url",) in errors(title=TITLE, url="javascript:alert(1)")
    assert ("month",) in errors(title=TITLE, month="2024-13")
    assert ("color",) in errors(title=TITLE, color="red")


def test_month_cannot_be_in_the_future():
    assert ("month",) in errors(title=TITLE, month="2999-01")


def test_person_names_per_language():
    assert Names(first={"en": "Ismoil", "ru": "Исмоил", "tg": "Исмоил"})
    with pytest.raises(ValidationError) as error:
        Names(first={"en": "Ismoil Sharifov", "ru": "Исмоил", "tg": "Исмоил"})
    assert error.value.errors()[0]["loc"] == ("first", "en")
