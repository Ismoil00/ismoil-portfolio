"""The Translate button: English → Russian + Tajik, results cleaned like any other input."""

import pytest

from app.core.errors import ServiceUnavailable
from app.repositories.translation import TranslationFailed
from app.services.translation import TranslationService


class FakeTranslator:
    def __init__(self, result: dict[str, str] | None = None, fail: bool = False) -> None:
        self.result = result or {"ru": "Привет", "tg": "Салом"}
        self.fail = fail
        self.calls: list[tuple[str, str]] = []

    async def translate(self, text: str, fmt: str) -> dict[str, str]:
        self.calls.append((text, fmt))
        if self.fail:
            raise TranslationFailed("upstream error")
        return self.result


async def test_translates_plain_text():
    translator = FakeTranslator({"ru": "  Привет,\r\nмир  ", "tg": "Салом"})
    result = await TranslationService(translator).translate("Hello, world", "text")
    assert result == {"ru": "Привет,\nмир", "tg": "Салом"}
    assert translator.calls == [("Hello, world", "text")]


async def test_html_results_are_sanitized():
    translator = FakeTranslator(
        {"ru": "<p><strong>Привет</strong><script>x</script></p>", "tg": "<p onclick='x'>Салом</p>"}
    )
    result = await TranslationService(translator).translate("<p><strong>Hi</strong></p>", "html")
    assert result == {"ru": "<p><strong>Привет</strong></p>", "tg": "<p>Салом</p>"}


async def test_without_an_api_key_the_feature_is_off():
    with pytest.raises(ServiceUnavailable) as error:
        await TranslationService(None).translate("Hello", "text")
    assert "ANTHROPIC_API_KEY" in error.value.message


async def test_upstream_failures_become_a_clear_message():
    with pytest.raises(ServiceUnavailable) as error:
        await TranslationService(FakeTranslator(fail=True)).translate("Hello", "text")
    assert "Couldn't translate" in error.value.message


async def test_missing_language_in_the_answer_is_an_error():
    with pytest.raises(ServiceUnavailable):
        await TranslationService(FakeTranslator({"ru": "Привет", "tg": ""})).translate("Hello", "text")
