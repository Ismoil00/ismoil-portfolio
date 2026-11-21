"""chat assistant

The public site's AI assistant: usage counters for its limits (no text), the questions behind the admin's
"Top questions" list (only with analytics consent), its on/off switch in the admin settings, and where a
contact message came from (the form, or a conversation sent from the assistant).

Revision ID: 7c41b9e2d6a8
Revises: 5d2e8f1a9c3b
Create Date: 2026-11-20 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7c41b9e2d6a8"
down_revision: str | Sequence[str] | None = "5d2e8f1a9c3b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_usage",
        sa.Column("session_hash", sa.String(length=64), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=False),
        sa.Column("net_hash", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=64), nullable=False),
        sa.Column("tokens", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_usage")),
    )
    op.create_index("ix_chat_usage_created_at", "chat_usage", ["created_at"])
    op.create_index("ix_chat_usage_session_time", "chat_usage", ["session_hash", "created_at"])
    op.create_index("ix_chat_usage_ip_time", "chat_usage", ["ip_hash", "created_at"])
    op.create_index("ix_chat_usage_net_time", "chat_usage", ["net_hash", "created_at"])
    op.create_index("ix_chat_usage_model_time", "chat_usage", ["model", "created_at"])

    op.create_table(
        "chat_questions",
        sa.Column("question", sa.String(length=500), nullable=False),
        sa.Column("normalized", sa.String(length=500), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_questions")),
    )
    op.create_index("ix_chat_questions_created_at", "chat_questions", ["created_at"])
    op.create_index("ix_chat_questions_normalized", "chat_questions", ["normalized"])

    op.add_column(
        "admin_settings",
        sa.Column("assistant_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column("contact_messages", sa.Column("source", sa.String(length=8), server_default="form", nullable=False))
    op.create_check_constraint(op.f("ck_contact_messages_source"), "contact_messages", "source IN ('form', 'chat')")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_contact_messages_source"), "contact_messages", type_="check")
    op.drop_column("contact_messages", "source")
    op.drop_column("admin_settings", "assistant_enabled")
    op.drop_index("ix_chat_questions_normalized", table_name="chat_questions")
    op.drop_index("ix_chat_questions_created_at", table_name="chat_questions")
    op.drop_table("chat_questions")
    op.drop_index("ix_chat_usage_model_time", table_name="chat_usage")
    op.drop_index("ix_chat_usage_net_time", table_name="chat_usage")
    op.drop_index("ix_chat_usage_ip_time", table_name="chat_usage")
    op.drop_index("ix_chat_usage_session_time", table_name="chat_usage")
    op.drop_index("ix_chat_usage_created_at", table_name="chat_usage")
    op.drop_table("chat_usage")
