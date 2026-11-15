"""Reusable field types for request bodies.

    title: I18nRequired[200]             EN/RU/TG all required, ≤ 200 characters each, one line
    note: I18nOptional[1000] = None      all three or none (empty tabs = not set), paragraphs allowed
    body: I18nRequired[5000, "rich"]     sanitized HTML, the limit counts visible text
    first_name: PersonNameI18n           a name per language, no spaces

Errors point at the language: loc = ("title", "ru").
"""

import uuid
from datetime import UTC, datetime
from functools import cache
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BeforeValidator, Field, PlainSerializer, create_model
from pydantic_core import PydanticCustomError

from app.core.svg import InvalidSvg, sanitize_svg
from app.core.text import (
    InvalidValue,
    clean_multiline,
    clean_single_line,
    is_person_name,
    month_to_date,
    rich_text_length,
    sanitize_rich_html,
    validate_url,
)
from app.schemas.common import InputModel

LANGS = ("en", "ru", "tg")
Kind = Literal["text", "multiline", "rich", "name"]


def field_error(message: str) -> PydanticCustomError:
    return PydanticCustomError("invalid", message)


def _text_validator(max_length: int, kind: Kind):
    def validate(value: str) -> str:
        if kind == "rich":
            value = sanitize_rich_html(value)
            visible = rich_text_length(value)
            if visible == 0:
                raise field_error("Fill in this language")
            if visible > max_length or len(value) > max_length * 10 + 10_000:
                raise field_error(f"Use at most {max_length} characters")
            return value
        value = clean_multiline(value) if kind == "multiline" else clean_single_line(value)
        if not value:
            raise field_error("Fill in this language")
        if len(value) > max_length:
            raise field_error(f"Use at most {max_length} characters")
        if kind == "name" and not is_person_name(value):
            raise field_error("Use letters only, without spaces (hyphens and apostrophes are fine)")
        return value

    return validate


@cache
def _i18n_model(max_length: int, kind: Kind) -> type[InputModel]:
    text = Annotated[str, AfterValidator(_text_validator(max_length, kind))]
    return create_model(  # type: ignore[call-overload]
        f"I18n_{kind}_{max_length}", __base__=InputModel, **dict.fromkeys(LANGS, (text, ...))
    )


def _to_dict(value: Any) -> dict[str, str] | None:
    return value if value is None or isinstance(value, dict) else value.model_dump()


def _empty_to_none(kind: Kind):
    def convert(value: Any) -> Any:
        if isinstance(value, dict) and set(value) <= set(LANGS):
            texts = [str(v or "") for v in value.values()]
            empty = all((rich_text_length(t) if kind == "rich" else len(t.strip())) == 0 for t in texts)
            if empty:
                return None
        return value

    return convert


_SERIALIZE = PlainSerializer(_to_dict, return_type=dict[str, str] | None)


def _params(params: Any) -> tuple[int, Kind]:
    return params if isinstance(params, tuple) else (params, "text")


class I18nRequired:
    def __class_getitem__(cls, params: Any) -> Any:
        max_length, kind = _params(params)
        return Annotated[_i18n_model(max_length, kind), AfterValidator(_to_dict), _SERIALIZE]


class I18nOptional:
    def __class_getitem__(cls, params: Any) -> Any:
        max_length, kind = _params(params)
        return Annotated[
            _i18n_model(max_length, kind) | None,
            BeforeValidator(_empty_to_none(kind)),
            AfterValidator(_to_dict),
            _SERIALIZE,
        ]


PersonNameI18n = I18nRequired[100, "name"]


def _url(value: str) -> str:
    try:
        return validate_url(value)
    except InvalidValue as error:
        raise field_error(str(error)) from error


def _blank_to_none(value: Any) -> Any:
    return None if isinstance(value, str) and not value.strip() else value


HttpUrl = Annotated[str, AfterValidator(_url)]
OptionalHttpUrl = Annotated[HttpUrl | None, BeforeValidator(_blank_to_none)]


def _month(value: str) -> str:
    try:
        month = month_to_date(value)
    except InvalidValue as error:
        raise field_error(str(error)) from error
    now = datetime.now(UTC)
    if (month.year, month.month) > (now.year, now.month):
        raise field_error("This month is in the future")
    return value


Month = Annotated[str, AfterValidator(_month)]


def _color(value: str) -> str:
    if len(value) != 7 or value[0] != "#" or any(c not in "0123456789abcdefABCDEF" for c in value[1:]):
        raise field_error("Use a hex color like #3776AB")
    return value.upper()


HexColor = Annotated[str, AfterValidator(_color)]


def _line(max_length: int):
    def validate(value: str) -> str:
        value = clean_single_line(value)
        if not value:
            raise field_error("Fill in this field")
        if len(value) > max_length:
            raise field_error(f"Use at most {max_length} characters")
        return value

    return validate


class Line:
    """One line of text (trimmed, no control characters), required, at most N characters: Line[100]."""

    def __class_getitem__(cls, max_length: int) -> Any:
        return Annotated[str, AfterValidator(_line(max_length))]


def _svg(value: str) -> str:
    try:
        return sanitize_svg(value)
    except InvalidSvg as error:
        raise field_error(str(error)) from error


IconSvg = Annotated[str, AfterValidator(_svg)]
OptionalIconSvg = Annotated[IconSvg | None, BeforeValidator(_blank_to_none)]


def _unique(values: list) -> list:
    if len(set(values)) != len(values):
        raise field_error("Each item can be picked only once")
    return values


def UniqueIds(max_items: int = 100) -> Any:
    return Annotated[list[uuid.UUID], AfterValidator(_unique), Field(max_length=max_items)]
