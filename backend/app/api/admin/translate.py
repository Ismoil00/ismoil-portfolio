"""Admin: the Translate button (English → Russian + Tajik)."""

from typing import Literal

from fastapi import APIRouter, Request
from pydantic import Field

from app.schemas.common import InputModel, OutputModel
from app.services.translation import TranslationService

router = APIRouter(tags=["admin: translate"])


class TranslateIn(InputModel):
    # 5000 visible characters of rich text can be a lot longer as HTML.
    text: str = Field(min_length=1, max_length=60_000)
    format: Literal["text", "html"] = "text"


class TranslateOut(OutputModel):
    ru: str
    tg: str


@router.post("/translate", response_model=TranslateOut)
async def translate(data: TranslateIn, request: Request) -> TranslateOut:
    service = TranslationService(getattr(request.app.state, "translator", None))
    return TranslateOut(**await service.translate(data.text, data.format))
