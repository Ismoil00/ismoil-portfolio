"""Database access for admin users, sessions and login attempts."""

import uuid
from datetime import datetime

from sqlalchemy import delete, select

from app.models import AdminSession, AdminUser, LoginAttempt
from app.repositories.base import Repository


class AuthRepository(Repository):
    async def get_user_by_username(self, username: str) -> AdminUser | None:
        return await self.session.scalar(select(AdminUser).where(AdminUser.username == username))

    async def add_user(self, user: AdminUser) -> None:
        self.session.add(user)
        await self.session.flush()

    async def add_session(self, session: AdminSession) -> None:
        self.session.add(session)
        await self.session.flush()

    async def get_session(self, token_hash: str) -> AdminSession | None:
        return await self.session.scalar(select(AdminSession).where(AdminSession.token_hash == token_hash))

    async def delete_session(self, session: AdminSession) -> None:
        await self.session.delete(session)
        await self.session.flush()

    async def delete_user_sessions(self, user_id: uuid.UUID) -> None:
        await self.session.execute(delete(AdminSession).where(AdminSession.user_id == user_id))

    async def delete_other_sessions(self, user_id: uuid.UUID, keep_id: uuid.UUID) -> None:
        """Signs out every other browser of this user (after a username or password change)."""
        await self.session.execute(
            delete(AdminSession).where(AdminSession.user_id == user_id, AdminSession.id != keep_id)
        )

    async def add_attempt(self, ip_hash: str, succeeded: bool, at: datetime) -> None:
        self.session.add(LoginAttempt(ip_hash=ip_hash, succeeded=succeeded, created_at=at))
        await self.session.flush()

    async def failures_since(self, ip_hash: str, since: datetime) -> list[datetime]:
        rows = await self.session.scalars(
            select(LoginAttempt.created_at)
            .where(LoginAttempt.ip_hash == ip_hash, LoginAttempt.succeeded.is_(False), LoginAttempt.created_at >= since)
            .order_by(LoginAttempt.created_at)
        )
        return list(rows)

    async def failures_since_any(self, since: datetime) -> list[datetime]:
        rows = await self.session.scalars(
            select(LoginAttempt.created_at)
            .where(LoginAttempt.succeeded.is_(False), LoginAttempt.created_at >= since)
            .order_by(LoginAttempt.created_at)
        )
        return list(rows)

    async def purge(self, before: datetime) -> None:
        """Forget old login attempts and expired sessions."""
        await self.session.execute(delete(LoginAttempt).where(LoginAttempt.created_at < before))
        await self.session.execute(delete(AdminSession).where(AdminSession.expires_at < before))
