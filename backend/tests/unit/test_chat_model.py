"""The Groq client wrapper, without Groq: how its refusals are told apart. A model at its free limit (429)
or overloaded (5xx) rests and the next one is tried; a failed connection is tried once more and is never
taken for a limit (it says nothing about a model's quota)."""

from types import SimpleNamespace

import groq
import httpx
import pytest

from app.repositories.chat_model import ChatModelFailed, GroqChatModel, ModelLimited, ModelUnreachable, Usage

URL = "https://api.groq.com/openai/v1/chat/completions"
REQUEST = httpx.Request("POST", URL)


def connection_error() -> groq.APIConnectionError:
    return groq.APIConnectionError(request=REQUEST)


def status_error(status: int, headers: dict | None = None) -> groq.APIStatusError:
    response = httpx.Response(status, headers=headers or {}, request=REQUEST)
    kind = {429: groq.RateLimitError, 401: groq.AuthenticationError}.get(status, groq.APIStatusError)
    if status >= 500:
        kind = groq.InternalServerError
    return kind("refused", response=response, body=None)


def chunk(text: str | None = None, usage=None):
    return SimpleNamespace(
        choices=[SimpleNamespace(delta=SimpleNamespace(content=text))] if text is not None else [],
        x_groq=SimpleNamespace(usage=usage) if usage else None,
        usage=None,
    )


async def answer_stream():
    yield chunk("Ismoil ")
    yield chunk("built it.")
    usage = SimpleNamespace(
        prompt_tokens=2_000, completion_tokens=100, prompt_tokens_details=SimpleNamespace(cached_tokens=1_500)
    )
    yield chunk(usage=usage)


class FakeCompletions:
    """Plays the given outcomes in turn: an exception to raise, or a stream to return."""

    def __init__(self, *outcomes) -> None:
        self.outcomes = list(outcomes)
        self.calls = 0

    async def create(self, **kwargs):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome()


def model_with(*outcomes) -> tuple[GroqChatModel, FakeCompletions]:
    model = GroqChatModel("test-key")
    completions = FakeCompletions(*outcomes)
    model.client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    return model, completions


async def collect(model: GroqChatModel) -> list:
    return [piece async for piece in model.stream("openai/gpt-oss-120b", [{"role": "user", "content": "Hi"}], 400)]


async def test_the_answer_comes_in_pieces_and_cached_prompt_tokens_dont_count():
    model, _ = model_with(answer_stream)
    assert await collect(model) == ["Ismoil ", "built it.", Usage(tokens=500 + 100)]


async def test_a_failed_connection_is_tried_once_more():
    model, completions = model_with(connection_error(), answer_stream)
    assert (await collect(model))[:2] == ["Ismoil ", "built it."]
    assert completions.calls == 2


async def test_a_connection_that_fails_twice_is_unreachable_not_limited():
    model, _ = model_with(connection_error(), connection_error())
    with pytest.raises(ModelUnreachable):
        await collect(model)


@pytest.mark.parametrize(("status", "headers", "wait"), [(429, {"retry-after": "7"}, 7), (429, {}, 60), (503, {}, 60)])
async def test_a_model_at_its_limit_or_overloaded_rests(status, headers, wait):
    model, completions = model_with(status_error(status, headers))
    with pytest.raises(ModelLimited) as limited:
        await collect(model)
    assert limited.value.retry_after == wait
    assert completions.calls == 1  # never retried here: the next model is tried instead


async def test_a_refused_key_is_an_error():
    model, _ = model_with(status_error(401))
    with pytest.raises(ChatModelFailed, match="GROQ_API_KEY"):
        await collect(model)
