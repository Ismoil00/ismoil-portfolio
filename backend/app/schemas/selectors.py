"""Selectors: request and response bodies for each kind of reusable list."""

import uuid

from app.schemas.common import InputModel, OutputModel
from app.schemas.fields import HexColor, I18nRequired, IconSvg, Line, OptionalHttpUrl, OptionalIconSvg, UniqueIds
from app.schemas.media import MediaOut

# --- requests -----------------------------------------------------------------------------------


class DevelopmentFieldIn(InputModel):
    name: I18nRequired[100]
    icon_svg: OptionalIconSvg = None


class InstrumentIn(InputModel):
    name: I18nRequired[100]
    icon_svg: OptionalIconSvg = None


class TechStackIn(InputModel):
    name: Line[100]
    icon_svg: IconSvg
    color: HexColor
    docs_url: OptionalHttpUrl = None
    field_ids: UniqueIds() = []
    instrument_ids: UniqueIds() = []


class PositionIn(InputModel):
    name: I18nRequired[100]


class CompanyIn(InputModel):
    name: Line[100]
    website_url: OptionalHttpUrl = None
    logo_id: uuid.UUID | None = None


class InstituteIn(InputModel):
    name: I18nRequired[200]
    website_url: OptionalHttpUrl = None
    logo_id: uuid.UUID | None = None


class ProductTypeIn(InputModel):
    name: I18nRequired[100]
    icon_svg: IconSvg


class LinkPlatformIn(InputModel):
    name: Line[100]
    icon_svg: OptionalIconSvg = None
    color: HexColor | None = None


class OrderIn(InputModel):
    ids: UniqueIds(10_000)


# --- responses ----------------------------------------------------------------------------------


class SelectorOut(OutputModel):
    id: uuid.UUID
    position: int
    # What uses the item ({"projects": 2}); items in use can't be deleted.
    usage: dict[str, int] = {}


class DevelopmentFieldOut(SelectorOut):
    name: dict[str, str]
    icon_svg: str | None


class InstrumentOut(DevelopmentFieldOut):
    pass


class TechStackOut(SelectorOut):
    name: str
    icon_svg: str
    color: str
    docs_url: str | None
    field_ids: list[uuid.UUID]
    instrument_ids: list[uuid.UUID]


class PositionOut(SelectorOut):
    name: dict[str, str]


class CompanyOut(SelectorOut):
    name: str
    website_url: str | None
    logo: MediaOut | None


class InstituteOut(SelectorOut):
    name: dict[str, str]
    website_url: str | None
    logo: MediaOut | None


class ProductTypeOut(SelectorOut):
    name: dict[str, str]
    icon_svg: str


class LinkPlatformOut(SelectorOut):
    name: str
    icon_svg: str | None
    color: str | None
