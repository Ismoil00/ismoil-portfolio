"""In-memory stand-ins for repositories and the clock, so services are tested without a database."""

import uuid
from datetime import UTC, datetime, timedelta

from app.models import AdminSession, AdminUser


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

    async def get_user_by_email(self, email: str) -> AdminUser | None:
        return self.users.get(email)

    async def add_user(self, user: AdminUser) -> None:
        user.id = user.id or uuid.uuid4()
        self.users[user.email] = user

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
