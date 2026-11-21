"""Settings of the admin panel itself (one row)."""

from sqlalchemy import CheckConstraint, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps
from app.models.enums import Translator, sql_in
from app.models.sections import single_row


class AdminSettings(Timestamps, Base):
    """How the admin panel helps you (which translator fills Russian and Tajik from English) and whether
    the public site shows the AI assistant."""

    __tablename__ = "admin_settings"
    __table_args__ = (single_row(), CheckConstraint(sql_in(Translator, "translator"), name="translator"))

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    translator: Mapped[str] = mapped_column(
        String(16), default=Translator.MANUAL.value, server_default=Translator.MANUAL.value
    )
    # Off until switched on in Settings (it also needs GROQ_API_KEY).
    assistant_enabled: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
