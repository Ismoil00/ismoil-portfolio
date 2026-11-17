"""testimonial role is a field or a technology; drop positions

My role on a testimonial is now a development field or a technology (exactly one), shown with
"development" added. The Positions list goes away.

Revision ID: a5b16569363c
Revises: ba844e7ce9b0
Create Date: 2026-11-16 23:11:46.219697
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a5b16569363c"
down_revision: str | Sequence[str] | None = "ba844e7ce9b0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ONE_ROLE = "(field_id IS NULL) <> (tech_stack_id IS NULL)"


def _no_testimonials(step: str) -> None:
    # A position can't be turned into a field or a technology (or back) automatically.
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM testimonials")):
        raise RuntimeError(f"{step}: delete the testimonials first, or set their role by hand")


def upgrade() -> None:
    _no_testimonials("Upgrade")
    op.drop_constraint(op.f("fk_testimonials_position_id_positions"), "testimonials", type_="foreignkey")
    op.drop_index(op.f("ix_testimonials_position_id"), table_name="testimonials")
    op.drop_column("testimonials", "position_id")
    op.drop_table("positions")

    op.add_column("testimonials", sa.Column("field_id", sa.Uuid(), nullable=True))
    op.add_column("testimonials", sa.Column("tech_stack_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_testimonials_field_id"), "testimonials", ["field_id"], unique=False)
    op.create_index(op.f("ix_testimonials_tech_stack_id"), "testimonials", ["tech_stack_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_testimonials_field_id_development_fields"),
        "testimonials",
        "development_fields",
        ["field_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        op.f("fk_testimonials_tech_stack_id_tech_stacks"),
        "testimonials",
        "tech_stacks",
        ["tech_stack_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    # Autogenerate doesn't see CHECK constraints on an existing table, so it's added here by hand.
    op.create_check_constraint(op.f("ck_testimonials_one_role"), "testimonials", ONE_ROLE)


def downgrade() -> None:
    _no_testimonials("Downgrade")
    op.drop_constraint(op.f("ck_testimonials_one_role"), "testimonials", type_="check")
    op.drop_constraint(op.f("fk_testimonials_tech_stack_id_tech_stacks"), "testimonials", type_="foreignkey")
    op.drop_constraint(op.f("fk_testimonials_field_id_development_fields"), "testimonials", type_="foreignkey")
    op.drop_index(op.f("ix_testimonials_tech_stack_id"), table_name="testimonials")
    op.drop_index(op.f("ix_testimonials_field_id"), table_name="testimonials")
    op.drop_column("testimonials", "tech_stack_id")
    op.drop_column("testimonials", "field_id")

    op.create_table(
        "positions",
        sa.Column("name", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_positions")),
    )
    op.add_column("testimonials", sa.Column("position_id", sa.Uuid(), nullable=False))
    op.create_index(op.f("ix_testimonials_position_id"), "testimonials", ["position_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_testimonials_position_id_positions"),
        "testimonials",
        "positions",
        ["position_id"],
        ["id"],
        ondelete="RESTRICT",
    )
