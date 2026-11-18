"""admins sign in with a username

The admin signs in with a username instead of an email (the app never sends mail, so the address
was only a name). Each admin's username is made from the part of the email before "@", fitted to
the username rules (3–32 Latin letters, digits, dots, hyphens or underscores, starting with a
letter or digit); a name that is already given gets a number ("admin-2").

The downgrade can't bring the old addresses back: each admin gets "<username>@example.com".

Revision ID: cabc4de0774f
Revises: b3d5141bfcfd
Create Date: 2026-11-18 19:10:00.000000
"""

import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "cabc4de0774f"
down_revision: str | Sequence[str] | None = "b3d5141bfcfd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MIN_LENGTH, MAX_LENGTH = 3, 32  # as in app/services/auth.py at the time of writing


def username_from_email(email: str, taken: set[str]) -> str:
    """'Site.Owner+cms@example.com' → 'site.owner-cms'; 'admin' → 'admin-2' when 'admin' is taken."""
    name = re.sub(r"[^a-z0-9._-]", "-", email.rsplit("@", 1)[0].strip().lower())
    name = re.sub(r"^[^a-z0-9]+", "", name)[:MAX_LENGTH]
    if len(name) < MIN_LENGTH:
        name = "admin"
    candidate, n = name, 2
    while candidate in taken:
        suffix = f"-{n}"
        candidate = name[: MAX_LENGTH - len(suffix)] + suffix
        n += 1
    return candidate


def upgrade() -> None:
    bind = op.get_bind()
    op.add_column("admin_users", sa.Column("username", sa.String(length=MAX_LENGTH), nullable=True))
    taken: set[str] = set()
    for user_id, email in bind.execute(sa.text("SELECT id, email FROM admin_users ORDER BY created_at, id")):
        username = username_from_email(email, taken)
        taken.add(username)
        bind.execute(
            sa.text("UPDATE admin_users SET username = :username WHERE id = :id"), {"username": username, "id": user_id}
        )
    op.alter_column("admin_users", "username", nullable=False)
    op.create_unique_constraint(op.f("uq_admin_users_username"), "admin_users", ["username"])
    op.drop_constraint(op.f("uq_admin_users_email"), "admin_users", type_="unique")
    op.drop_column("admin_users", "email")


def downgrade() -> None:
    op.add_column("admin_users", sa.Column("email", sa.String(length=254), nullable=True))
    op.execute("UPDATE admin_users SET email = username || '@example.com'")
    op.alter_column("admin_users", "email", nullable=False)
    op.create_unique_constraint(op.f("uq_admin_users_email"), "admin_users", ["email"])
    op.drop_constraint(op.f("uq_admin_users_username"), "admin_users", type_="unique")
    op.drop_column("admin_users", "username")
