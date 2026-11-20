"""visit statistics

A table for the site's own visit statistics: page views and résumé downloads reported by the public
site, read by the admin panel's Analytics page. No IP address or name is stored.

Revision ID: 5d2e8f1a9c3b
Revises: cabc4de0774f
Create Date: 2026-11-20 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5d2e8f1a9c3b"
down_revision: str | Sequence[str] | None = "cabc4de0774f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "visit_events",
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("path", sa.String(length=300), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False),
        sa.Column("device", sa.String(length=16), nullable=False),
        sa.Column("country", sa.String(length=2), nullable=True),
        sa.Column("referrer_host", sa.String(length=255), nullable=True),
        sa.Column("visitor_id", sa.Uuid(), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint("kind IN ('page_view', 'resume_download')", name=op.f("ck_visit_events_kind")),
        sa.CheckConstraint("device IN ('mobile', 'tablet', 'desktop')", name=op.f("ck_visit_events_device")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_visit_events")),
    )
    op.create_index("ix_visit_events_created_at", "visit_events", ["created_at"])
    op.create_index("ix_visit_events_ip_time", "visit_events", ["ip_hash", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_visit_events_ip_time", table_name="visit_events")
    op.drop_index("ix_visit_events_created_at", table_name="visit_events")
    op.drop_table("visit_events")
