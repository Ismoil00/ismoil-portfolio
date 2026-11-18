"""project descriptions become rich text

The project description used to be plain text (a blank line starts a paragraph, **text** is
emphasized). It is now sanitized HTML from the same editor as the experience description, so the
stored texts are converted: paragraphs → <p>, line breaks → <br>, **text** → <strong>.
No table changes.

Revision ID: 3f102cca93cc
Revises: a5b16569363c
Create Date: 2026-11-18 14:35:38.380630
"""

import html
import re
from collections.abc import Callable, Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "3f102cca93cc"
down_revision: str | Sequence[str] | None = "a5b16569363c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

projects = sa.table("projects", sa.column("id", sa.Uuid()), sa.column("description", postgresql.JSONB()))


def plain_to_html(text: str) -> str:
    """'A **b**.\\n\\nC\\nD' → '<p>A <strong>b</strong>.</p><p>C<br>D</p>' (text escaped first)."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text or "") if p.strip()]

    def inline(paragraph: str) -> str:
        escaped = html.escape(paragraph, quote=False)
        escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
        return "<br>".join(line.strip() for line in escaped.split("\n"))

    return "".join(f"<p>{inline(p)}</p>" for p in paragraphs)


def html_to_plain(value: str) -> str:
    """The way back (for a downgrade): paragraphs and list items become paragraphs, bold becomes **."""
    text = re.sub(r"<(strong|b)>(.*?)</\1>", r"**\2**", value or "", flags=re.S)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"</(p|li)>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return "\n\n".join(p.strip() for p in html.unescape(text).split("\n\n") if p.strip())


def _convert(change: Callable[[str], str]) -> None:
    bind = op.get_bind()
    for row in bind.execute(sa.select(projects.c.id, projects.c.description)):
        description = {lang: change(value) for lang, value in (row.description or {}).items()}
        bind.execute(projects.update().where(projects.c.id == row.id).values(description=description))


def upgrade() -> None:
    _convert(plain_to_html)


def downgrade() -> None:
    _convert(html_to_plain)
