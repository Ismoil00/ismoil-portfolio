"""testimonial quotes become rich text

A testimonial's quote used to be plain text (a blank line starts a paragraph). It is now sanitized
HTML from the same editor as the experience and project descriptions, so the stored quotes are
converted: paragraphs → <p>, line breaks → <br>. Quotes stay optional (NULL). No table changes.

Revision ID: 99b59344f6a3
Revises: 3f102cca93cc
Create Date: 2026-11-18 16:00:18.487326
"""

import html
import re
from collections.abc import Callable, Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "99b59344f6a3"
down_revision: str | Sequence[str] | None = "3f102cca93cc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

testimonials = sa.table("testimonials", sa.column("id", sa.Uuid()), sa.column("quote", postgresql.JSONB()))


def plain_to_html(text: str) -> str:
    """'A.\\n\\nB\\nC' → '<p>A.</p><p>B<br>C</p>' (the text is escaped first)."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text or "") if p.strip()]
    return "".join(
        "<p>" + "<br>".join(line.strip() for line in html.escape(p, quote=False).split("\n")) + "</p>"
        for p in paragraphs
    )


def html_to_plain(value: str) -> str:
    """The way back (for a downgrade): paragraphs and list items become paragraphs, tags are dropped."""
    text = re.sub(r"<br\s*/?>", "\n", value or "")
    text = re.sub(r"</(p|li)>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return "\n\n".join(p.strip() for p in html.unescape(text).split("\n\n") if p.strip())


def _convert(change: Callable[[str], str]) -> None:
    bind = op.get_bind()
    for row in bind.execute(
        sa.select(testimonials.c.id, testimonials.c.quote).where(testimonials.c.quote.is_not(None))
    ):
        if not isinstance(row.quote, dict):
            continue  # a JSON null: nothing to convert
        quote = {lang: change(value) for lang, value in row.quote.items()}
        bind.execute(testimonials.update().where(testimonials.c.id == row.id).values(quote=quote))


def upgrade() -> None:
    _convert(plain_to_html)


def downgrade() -> None:
    _convert(html_to_plain)
