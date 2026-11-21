"""The AI assistant's language model: Groq's free tier (an outside service, so it lives with the repositories).

Free means hard limits per model: at a limit Groq answers 429 instead of billing. The service then moves on
to the next model (app/services/chat.py), so a refusal here is never retried.
"""

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

import groq

logger = logging.getLogger(__name__)

DEFAULT_WAIT = 60  # seconds, when Groq doesn't say how long


@dataclass(frozen=True)
class Usage:
    """Tokens one answer counted toward the model's limits (prompt tokens served from Groq's cache don't)."""

    tokens: int


class ModelLimited(Exception):
    """This model can't answer now (free quota used up, or overloaded): try the next one."""

    def __init__(self, retry_after: int) -> None:
        super().__init__(f"Model limited for {retry_after}s")
        self.retry_after = retry_after


class ChatModelFailed(Exception):
    pass


class ModelUnreachable(ChatModelFailed):
    """No connection to Groq (twice in a row). It says nothing about this model's quota: the next model is
    tried (in effect, another attempt) and none is set aside."""


class ChatModel(Protocol):
    def stream(self, model: str, messages: list[dict[str, str]], max_tokens: int) -> AsyncIterator[str | Usage]:
        """The answer in pieces of text as they're written, then (when known) one Usage."""
        ...


def _wait(error: groq.APIStatusError) -> int:
    try:
        return max(1, int(float(error.response.headers.get("retry-after", DEFAULT_WAIT))))
    except ValueError:
        return DEFAULT_WAIT


def _counted(usage) -> int:
    details = getattr(usage, "prompt_tokens_details", None)
    cached = getattr(details, "cached_tokens", 0) or 0
    return max(0, usage.prompt_tokens - cached) + usage.completion_tokens


class GroqChatModel:
    def __init__(self, api_key: str) -> None:
        # No automatic retries: a model at its limit is skipped for the next one instead of keeping the
        # visitor waiting. Only a failed connection is tried once more (see stream).
        self.client = groq.AsyncGroq(api_key=api_key, timeout=groq.Timeout(30.0, connect=5.0), max_retries=0)

    async def _open(self, model: str, messages: list[dict[str, str]], max_tokens: int):
        return await self.client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]  # plain role/content dicts
            stream=True,
            max_completion_tokens=max_tokens,
            # Short factual answers need little thinking; Qwen can skip it entirely. The thinking itself is
            # never sent back.
            reasoning_effort="none" if model.startswith("qwen/") else "low",
            include_reasoning=False,
        )

    async def stream(self, model: str, messages: list[dict[str, str]], max_tokens: int) -> AsyncIterator[str | Usage]:
        try:
            try:
                response = await self._open(model, messages, max_tokens)
            except groq.APIConnectionError as error:
                # One failed connection isn't an outage: try a new one right away.
                logger.warning("Groq connection failed (%s), trying again: %s", model, error)
                response = await self._open(model, messages, max_tokens)
        except groq.RateLimitError as error:
            logger.warning("Groq: %s is at its free limit for now (retry after %ss)", model, _wait(error))
            raise ModelLimited(_wait(error)) from error
        except groq.AuthenticationError as error:
            raise ChatModelFailed("The Groq API key was refused. Check GROQ_API_KEY.") from error
        except groq.APIStatusError as error:
            if error.status_code >= 500:  # overloaded or down: another model may still answer
                logger.warning("Groq: %s is unavailable (%s)", model, error.status_code)
                raise ModelLimited(_wait(error)) from error
            logger.warning("Groq refused the request (%s): %s", model, error)
            raise ChatModelFailed("The assistant couldn't answer this.") from error
        except groq.APIConnectionError as error:
            logger.warning("Groq is unreachable (%s): %s", model, error)
            raise ModelUnreachable("The assistant can't reach its model right now.") from error

        try:
            async for chunk in response:
                for choice in chunk.choices:
                    if choice.delta.content:
                        yield choice.delta.content
                usage = (chunk.x_groq.usage if chunk.x_groq else None) or chunk.usage
                if usage is not None:
                    yield Usage(tokens=_counted(usage))
        except groq.APIError as error:
            logger.warning("Groq stopped mid-answer (%s): %s", model, error)
            raise ChatModelFailed("The answer was cut off.") from error
