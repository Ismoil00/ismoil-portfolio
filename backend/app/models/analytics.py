"""Visit statistics: one row per page view or résumé download reported by the public site.

Nothing personal is stored: no IP address or name. `visitor_id` is a random id kept in a cookie only
when the visitor accepted analytics cookies; without it the visit is still counted, anonymously.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPk

EVENT_KINDS = ("page_view", "resume_download")
DEVICES = ("mobile", "tablet", "desktop")


def _one_of(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class VisitEvent(UUIDPk, Base):
    __tablename__ = "visit_events"
    __table_args__ = (
        CheckConstraint(_one_of("kind", EVENT_KINDS), name="kind"),
        CheckConstraint(_one_of("device", DEVICES), name="device"),
        Index("ix_visit_events_created_at", "created_at"),
        Index("ix_visit_events_ip_time", "ip_hash", "created_at"),
    )

    kind: Mapped[str] = mapped_column(String(32))
    path: Mapped[str] = mapped_column(String(300))
    locale: Mapped[str] = mapped_column(String(8))
    device: Mapped[str] = mapped_column(String(16))
    country: Mapped[str | None] = mapped_column(String(2))
    referrer_host: Mapped[str | None] = mapped_column(String(255))
    visitor_id: Mapped[uuid.UUID | None]
    # Only to stop one address flooding the numbers; a keyed hash, the address itself is never kept.
    ip_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
