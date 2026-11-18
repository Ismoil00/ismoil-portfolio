"""Admin login: the user, their sessions, and login attempts (for throttling)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPk


class AdminUser(UUIDPk, Base):
    __tablename__ = "admin_users"

    username: Mapped[str] = mapped_column(String(32), unique=True)  # lowercase; rules in services/auth.py
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AdminSession(UUIDPk, Base):
    """A signed-in browser. Only hashes of the session and CSRF tokens are stored."""

    __tablename__ = "admin_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ip_hash: Mapped[str] = mapped_column(String(64))
    user_agent: Mapped[str] = mapped_column(String(255))

    user: Mapped[AdminUser] = relationship(lazy="joined")


class LoginAttempt(UUIDPk, Base):
    __tablename__ = "login_attempts"
    __table_args__ = (Index("ix_login_attempts_ip_time", "ip_hash", "created_at"),)

    ip_hash: Mapped[str] = mapped_column(String(64))
    succeeded: Mapped[bool]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
