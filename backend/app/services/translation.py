"""The admin panel's Translate button: fills Russian and Tajik from English, for review before saving."""

from app.core.errors import ServiceUnavailable
from app.core.text import clean_multiline, rich_text_length, sanitize_rich_html
from app.repositories.translation import Format, TranslationFailed, Translator


class TranslationService:
    def __init__(self, translator: Translator | None) -> None:
        self.translator = translator

    async def translate(self, text: str, fmt: Format) -> dict[str, str]:
        if self.translator is None:
            raise ServiceUnavailable(
                "Translation isn't set up yet: add ANTHROPIC_API_KEY to backend/.env and restart the backend. "
                "Until then, fill in the Russian and Tajik tabs by hand.",
                code="translation_off",
            )
        try:
            result = await self.translator.translate(text, fmt)
        except TranslationFailed as error:
            raise ServiceUnavailable(f"Couldn't translate: {error}", code="translation_failed") from error

        # The answer is cleaned like anything typed into the panel (it's saved through the same checks too).
        cleaned = {
            lang: sanitize_rich_html(value) if fmt == "html" else clean_multiline(value)
            for lang, value in result.items()
            if lang in ("ru", "tg")
        }
        empty = [
            lang
            for lang in ("ru", "tg")
            if not (rich_text_length(cleaned.get(lang, "")) if fmt == "html" else cleaned.get(lang))
        ]
        if empty:
            raise ServiceUnavailable(
                "Couldn't translate: the answer was incomplete. Try again.", code="translation_failed"
            )
        return cleaned
