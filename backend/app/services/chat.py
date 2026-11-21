"""The public site's AI assistant: who may ask (visitor limits), which free Groq model answers (the quota
guard), and the answer streamed back as NDJSON lines.

Everything that can refuse a question is checked before the answer starts, so refusals are plain JSON
errors with a status code: 503 `chat_off`, 429 `chat_limit` (this visitor asked a lot) or `chat_busy`
(every model's share of the free quota is used up for now), 400 `chat_turns` (the conversation is long).
"""

import json
import re
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import anyio

from app.core.config import Settings
from app.core.errors import AppError, ServiceUnavailable, TooManyRequests
from app.core.throttle import retry_after
from app.models import ChatQuestion, ChatUsage
from app.repositories.chat import ChatRepository
from app.repositories.chat_model import ChatModel, ChatModelFailed, ModelLimited, ModelUnreachable, Usage
from app.schemas.analytics import AssistantUsageOut, ModelUsageOut
from app.schemas.chat import ChatIn
from app.services.chat_prompt import build_messages

KEEP_USAGE = timedelta(days=2)  # deleted by the daily cleanup (services/maintenance.py)
KEEP_QUESTIONS = timedelta(days=90)
CHARS_PER_TOKEN = 3.5  # a cautious estimate, before the model reports the real count


def utcnow() -> datetime:
    return datetime.now(UTC)


# --- questions kept for "Top questions" -------------------------------------------------------------

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}")
_LINK = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)
_PHONE = re.compile(r"\+?\d[\d\s().-]{6,}\d")


def redact(text: str) -> str:
    """Emails, links and phone numbers (9+ digits, so years like 2020-2024 stay) are masked."""
    text = _EMAIL.sub("[email]", text)
    text = _LINK.sub("[link]", text)
    return _PHONE.sub(lambda m: "[phone]" if sum(c.isdigit() for c in m.group()) >= 9 else m.group(), text)


def normalize(text: str) -> str:
    """Wording up to case, spacing and closing punctuation: how "Top questions" groups the same question."""
    return re.sub(r"\s+", " ", text).strip().rstrip(".!?…;:,").strip().lower()[:500]


# --- the service ----------------------------------------------------------------------------------


@dataclass(frozen=True)
class Asker:
    """Keyed hashes only: the visitor's chat cookie (when the browser keeps it), IP address and network."""

    ip_hash: str
    net_hash: str
    session_hash: str | None = None


@dataclass(frozen=True)
class Answer:
    """A question that passed every check: the models to try, in order, and what they're told."""

    models: list[str]
    messages: list[dict[str, str]]
    usage_id: uuid.UUID
    estimate: int


Record = Callable[[uuid.UUID, str, int], Awaitable[None]]


async def usage_report(
    repo: ChatRepository, settings: Settings, *, ready: bool, enabled: bool, now: datetime | None = None
) -> AssistantUsageOut:
    """How much of each model's share of the free quota is used in the last day, hour and minute."""
    now = now or utcnow()
    models = []
    for model in settings.chat_models:
        use = await repo.model_use(
            model, day=now - timedelta(days=1), hour=now - timedelta(hours=1), minute=now - timedelta(minutes=1)
        )
        models.append(
            ModelUsageOut(
                model=model,
                requests_day=use.requests_day,
                requests_day_limit=settings.chat_model_requests_per_day,
                tokens_day=use.tokens_day,
                tokens_day_limit=settings.chat_model_tokens_per_day,
                tokens_hour=use.tokens_hour,
                tokens_hour_limit=settings.chat_model_tokens_per_day // max(1, settings.chat_hour_share),
                tokens_minute=use.tokens_minute,
                tokens_minute_limit=settings.chat_model_tokens_per_minute,
            )
        )
    return AssistantUsageOut(ready=ready, enabled=enabled, models=models)


def _line(payload: dict) -> bytes:
    return (json.dumps(payload, ensure_ascii=False) + "\n").encode()


class ChatService:
    def __init__(
        self,
        repo: ChatRepository,
        settings: Settings,
        model: ChatModel | None,
        *,
        enabled: bool,
        paused: dict[str, datetime] | None = None,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self.repo = repo
        self.settings = settings
        self.model = model
        # The admin's switch; without GROQ_API_KEY there's no model and the assistant is off regardless.
        self.enabled = enabled and model is not None
        # Models Groq refused lately, until when (kept per server instance: a best-effort shortcut).
        self.paused = paused if paused is not None else {}
        self.clock = clock

    async def start(self, data: ChatIn, asker: Asker, facts: Callable[[], Awaitable[str]]) -> Answer:
        """Checks everything that can refuse the question, then records it (and, with the visitor's
        analytics consent, keeps its masked text for "Top questions")."""
        if not self.enabled:
            raise ServiceUnavailable("The assistant is off right now.", code="chat_off")
        if sum(m.role == "user" for m in data.messages) > self.settings.chat_max_turns:
            raise AppError("This conversation is long enough. Start a new chat.", code="chat_turns")
        now = self.clock()
        await self._check_visitor(asker, now)

        messages = build_messages(await facts(), data)
        prompt_chars = sum(len(m["content"]) for m in messages)
        estimate = int(prompt_chars / CHARS_PER_TOKEN) + self.settings.chat_answer_max_tokens
        models = await self._models_with_room(now, estimate)

        usage = ChatUsage(
            session_hash=asker.session_hash,
            ip_hash=asker.ip_hash,
            net_hash=asker.net_hash,
            model=models[0],
            tokens=estimate,  # until the model reports the real count
            created_at=now,
        )
        await self.repo.add_usage(usage)
        if data.save_question:
            question = redact(data.question)[:500]
            await self.repo.add_question(
                ChatQuestion(question=question, normalized=normalize(question), locale=data.locale, created_at=now)
            )
        await self.repo.commit()
        return Answer(models=models, messages=messages, usage_id=usage.id, estimate=estimate)

    async def stream(self, answer: Answer, record: Record) -> AsyncIterator[bytes]:
        """The answer as NDJSON lines: {"type": "text", "text": …} pieces, then {"type": "done"}, or
        {"type": "error", "code": …} when no model could finish. A refused model hands over to the next one,
        unless it had already started writing."""
        used, tokens, wrote = answer.models[0], None, False
        # What to tell the visitor when every model refused: "busy" (limits) or "try again" (no connection).
        refusal = "chat_busy"
        try:
            for model in answer.models:
                used = model
                try:
                    async for piece in self.model.stream(  # type: ignore[union-attr]  # enabled ⇒ model
                        model, answer.messages, self.settings.chat_answer_max_tokens
                    ):
                        if isinstance(piece, Usage):
                            tokens = piece.tokens
                        elif piece:
                            wrote = True
                            yield _line({"type": "text", "text": piece})
                except ModelLimited as limited:
                    self.paused[model] = self.clock() + timedelta(seconds=limited.retry_after)
                    if wrote:
                        yield _line({"type": "error", "code": "chat_failed"})
                        return
                    refusal = "chat_busy"
                    continue
                except ModelUnreachable:
                    # The connection, not the model: try the next one, set nothing aside.
                    if wrote:
                        yield _line({"type": "error", "code": "chat_failed"})
                        return
                    refusal = "chat_failed"
                    continue
                except ChatModelFailed:
                    yield _line({"type": "error", "code": "chat_failed"})
                    return
                yield _line({"type": "done"})
                return
            yield _line({"type": "error", "code": refusal})
        finally:
            # The real count when known; the estimate if an answer was cut off; nothing if none was written.
            # When the visitor presses Stop the server cancels this answer: the count is still saved, whole
            # (a write cut off midway would leave a broken database connection behind).
            with anyio.CancelScope(shield=True):
                await record(answer.usage_id, used, tokens if tokens is not None else (answer.estimate if wrote else 0))

    async def _check_visitor(self, asker: Asker, now: datetime) -> None:
        s, ten, day = self.settings, timedelta(minutes=10), timedelta(days=1)
        waits: list[int | None] = []
        for column, value in ((ChatUsage.session_hash, asker.session_hash), (ChatUsage.ip_hash, asker.ip_hash)):
            if value is None:
                continue
            times = await self.repo.times_since(column, value, now - day)
            waits.append(retry_after([t for t in times if t >= now - ten], s.chat_max_per_10_minutes, ten, now))
            waits.append(retry_after(times, s.chat_max_per_day, day, now))
        network = await self.repo.times_since(ChatUsage.net_hash, asker.net_hash, now - day)
        waits.append(retry_after(network, s.chat_max_per_network_per_day, day, now))
        if wait := max((w for w in waits if w is not None), default=None):
            raise TooManyRequests(
                "You've asked a lot in a short time. Try again later.", retry_after=wait, code="chat_limit"
            )

    async def _models_with_room(self, now: datetime, estimate: int) -> list[str]:
        """The models whose share of the free quota fits this question, in the configured order."""
        s = self.settings
        hour_budget = s.chat_model_tokens_per_day // max(1, s.chat_hour_share)
        room, waits = [], []
        for model in s.chat_models:
            paused_until = self.paused.get(model)
            if paused_until and paused_until > now:
                waits.append(int((paused_until - now).total_seconds()) + 1)
                continue
            use = await self.repo.model_use(
                model, day=now - timedelta(days=1), hour=now - timedelta(hours=1), minute=now - timedelta(minutes=1)
            )
            if (
                use.requests_day >= s.chat_model_requests_per_day
                or use.tokens_day + estimate > s.chat_model_tokens_per_day
            ):
                waits.append(3600)
            elif use.tokens_hour + estimate > hour_budget:
                waits.append(600)
            # Groq's per-minute limit counts whole prompts, cached parts included: each recent question is
            # taken at this question's full size (or its recorded count, when that's larger).
            elif max(use.tokens_minute, use.requests_minute * estimate) + estimate > s.chat_model_tokens_per_minute:
                waits.append(60)
            else:
                room.append(model)
        if not room:
            raise TooManyRequests(
                "The assistant is busy right now. Try again later.",
                retry_after=min(waits, default=60),
                code="chat_busy",
            )
        return room
