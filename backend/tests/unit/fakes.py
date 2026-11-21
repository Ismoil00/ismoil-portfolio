"""In-memory stand-ins for repositories, the clock and the AI model, so services are tested without a
database or Groq."""

import uuid
from datetime import UTC, datetime, timedelta

from app.models import AdminSession, AdminUser, ChatQuestion, ChatUsage
from app.repositories.chat import ModelUse
from app.repositories.chat_model import ChatModelFailed, ModelLimited, ModelUnreachable, Usage


class FakeChatModel:
    """Writes `answer` in a few pieces like the real model, then reports `tokens`. Models named in `limited`
    refuse (free quota used up); `fail` refuses everything; `cut_after` stops after that many pieces."""

    def __init__(
        self,
        answer: str = "Ismoil built a shop. See [it](/projects/shop).",
        *,
        tokens: int = 1_200,
        limited: tuple[str, ...] = (),
        unreachable: tuple[str, ...] = (),
        fail: bool = False,
        cut_after: int | None = None,
    ) -> None:
        self.answer = answer
        self.tokens = tokens
        self.limited = set(limited)
        self.unreachable = set(unreachable)
        self.fail = fail
        self.cut_after = cut_after
        self.calls: list[tuple[str, list[dict[str, str]], int]] = []

    async def stream(self, model: str, messages: list[dict[str, str]], max_tokens: int):
        self.calls.append((model, messages, max_tokens))
        if model in self.limited:
            raise ModelLimited(30)
        if model in self.unreachable:
            raise ModelUnreachable("no connection")
        if self.fail:
            raise ChatModelFailed("refused")
        third = max(1, len(self.answer) // 3)
        pieces = [self.answer[i : i + third] for i in range(0, len(self.answer), third)]
        for index, piece in enumerate(pieces):
            if self.cut_after is not None and index == self.cut_after:
                raise ModelLimited(30)
            yield piece
        yield Usage(tokens=self.tokens)


class FakeChatRepository:
    def __init__(self) -> None:
        self.usage: list[ChatUsage] = []
        self.questions: list[ChatQuestion] = []
        self.commits = 0

    async def add_usage(self, row: ChatUsage) -> None:
        row.id = row.id or uuid.uuid4()
        self.usage.append(row)

    async def finish_usage(self, usage_id: uuid.UUID, model: str, tokens: int) -> None:
        row = next(u for u in self.usage if u.id == usage_id)
        row.model, row.tokens = model, tokens

    async def times_since(self, column, value: str, since: datetime) -> list[datetime]:
        return sorted(u.created_at for u in self.usage if getattr(u, column.key) == value and u.created_at >= since)

    async def model_use(self, model: str, *, day: datetime, hour: datetime, minute: datetime) -> ModelUse:
        rows = [u for u in self.usage if u.model == model and u.created_at >= day]
        return ModelUse(
            requests_day=len(rows),
            tokens_day=sum(u.tokens for u in rows),
            tokens_hour=sum(u.tokens for u in rows if u.created_at >= hour),
            requests_minute=sum(1 for u in rows if u.created_at >= minute),
            tokens_minute=sum(u.tokens for u in rows if u.created_at >= minute),
        )

    async def add_question(self, row: ChatQuestion) -> None:
        self.questions.append(row)

    async def commit(self) -> None:
        self.commits += 1


class FakeClock:
    def __init__(self, start: datetime | None = None) -> None:
        self.now = start or datetime(2026, 1, 15, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


class FakeAuthRepository:
    def __init__(self) -> None:
        self.users: dict[str, AdminUser] = {}
        self.sessions: dict[str, AdminSession] = {}
        self.attempts: list[tuple[str, bool, datetime]] = []
        self.commits = 0

    async def get_user_by_username(self, username: str) -> AdminUser | None:
        return self.users.get(username)

    async def add_user(self, user: AdminUser) -> None:
        user.id = user.id or uuid.uuid4()
        self.users[user.username] = user

    async def add_session(self, session: AdminSession) -> None:
        session.id = session.id or uuid.uuid4()
        session.user = next(u for u in self.users.values() if u.id == session.user_id)
        self.sessions[session.token_hash] = session

    async def get_session(self, token_hash: str) -> AdminSession | None:
        return self.sessions.get(token_hash)

    async def delete_session(self, session: AdminSession) -> None:
        self.sessions.pop(session.token_hash, None)

    async def delete_user_sessions(self, user_id: uuid.UUID) -> None:
        self.sessions = {k: s for k, s in self.sessions.items() if s.user_id != user_id}

    async def add_attempt(self, ip_hash: str, succeeded: bool, at: datetime) -> None:
        self.attempts.append((ip_hash, succeeded, at))

    async def failures_since(self, ip_hash: str, since: datetime) -> list[datetime]:
        return sorted(at for ip, ok, at in self.attempts if ip == ip_hash and not ok and at >= since)

    async def failures_since_any(self, since: datetime) -> list[datetime]:
        return sorted(at for _, ok, at in self.attempts if not ok and at >= since)

    async def commit(self) -> None:
        self.commits += 1
