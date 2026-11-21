"""The public site's AI assistant: usage counters (limits and the free quota) and the questions behind the
admin's "Top questions" list.

`chat_usage` holds no text at all: keyed hashes of the chat cookie, the IP and its network, which model
answered and how many tokens it counted. It's kept 2 days. `chat_questions` holds the question only when
the visitor accepted analytics cookies, with emails, phone numbers and links masked, for 90 days.
"""

from datetime import datetime

from sqlalchemy import DateTime, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPk


class ChatUsage(UUIDPk, Base):
    __tablename__ = "chat_usage"
    __table_args__ = (
        Index("ix_chat_usage_created_at", "created_at"),
        Index("ix_chat_usage_session_time", "session_hash", "created_at"),
        Index("ix_chat_usage_ip_time", "ip_hash", "created_at"),
        Index("ix_chat_usage_net_time", "net_hash", "created_at"),
        Index("ix_chat_usage_model_time", "model", "created_at"),
    )

    session_hash: Mapped[str | None] = mapped_column(String(64))
    ip_hash: Mapped[str] = mapped_column(String(64))
    net_hash: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(64))
    # Tokens that count toward Groq's limits (prompt tokens served from its cache don't).
    tokens: Mapped[int] = mapped_column(server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChatQuestion(UUIDPk, Base):
    __tablename__ = "chat_questions"
    __table_args__ = (
        Index("ix_chat_questions_created_at", "created_at"),
        Index("ix_chat_questions_normalized", "normalized"),
    )

    question: Mapped[str] = mapped_column(String(500))
    # Lowercase, single spaces, no closing punctuation: "What has he built?" and "what has he built" match.
    normalized: Mapped[str] = mapped_column(String(500))
    locale: Mapped[str] = mapped_column(String(8))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
