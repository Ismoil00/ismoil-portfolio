"""one english name per selector item

The lists with names in 3 languages (development fields, instruments, institutes, product types)
get a unique index on the English name, ignoring letter case — the rule the Selectors page already
checks, now also kept by the database for data that doesn't go through the page (the seed loaded
two "Game development" fields, and then neither could be saved under its own name).

Duplicates are merged first: the one listed first is kept, everything that pointed at the others
is moved to it (links that would repeat are dropped), a missing icon / logo / active filter is
taken over, and the others are deleted. The downgrade only drops the indexes.

Revision ID: b3d5141bfcfd
Revises: 99b59344f6a3
Create Date: 2026-11-18 16:59:22.796070
"""

# ruff: noqa: S608 — table and column names below are this file's own constants; values are bound parameters.
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b3d5141bfcfd"
down_revision: str | Sequence[str] | None = "99b59344f6a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# table → (link tables as (table, owner column, target column), plain foreign keys as (table, column))
REFERENCES = {
    "development_fields": (
        [
            ("tech_stack_fields", "tech_stack_id", "field_id"),
            ("experience_fields", "experience_id", "field_id"),
            ("certificate_fields", "certificate_id", "field_id"),
        ],
        [("testimonials", "field_id")],
    ),
    "instruments": ([("tech_stack_instruments", "tech_stack_id", "instrument_id")], []),
    "institutes": ([], [("certificates", "institute_id")]),
    "product_types": ([("project_types", "project_id", "product_type_id")], []),
}
TAKE_OVER = {
    "development_fields": ["icon_svg", "filter"],
    "instruments": ["icon_svg", "filter"],
    "institutes": ["logo_id"],
    "product_types": [],
}


def _merge_duplicates(table: str) -> None:
    bind = op.get_bind()
    groups = bind.execute(
        sa.text(
            f"SELECT array_agg(id ORDER BY position, created_at, id) FROM {table} "
            "GROUP BY lower(name ->> 'en') HAVING count(*) > 1"
        )
    ).scalars()
    links, foreign_keys = REFERENCES[table]
    for ids in groups:
        keep, others = ids[0], ids[1:]
        for other in others:
            params = {"keep": keep, "other": other}
            for link, owner, target in links:
                bind.execute(
                    sa.text(
                        f"DELETE FROM {link} WHERE {target} = :other "
                        f"AND {owner} IN (SELECT {owner} FROM {link} WHERE {target} = :keep)"
                    ),
                    params,
                )
                bind.execute(sa.text(f"UPDATE {link} SET {target} = :keep WHERE {target} = :other"), params)
            for fk_table, column in foreign_keys:
                bind.execute(sa.text(f"UPDATE {fk_table} SET {column} = :keep WHERE {column} = :other"), params)
            for what in TAKE_OVER[table]:
                if what == "filter":
                    bind.execute(
                        sa.text(
                            f"UPDATE {table} k SET filter_active = true, filter_position = o.filter_position "
                            f"FROM {table} o WHERE k.id = :keep AND o.id = :other AND o.filter_active AND NOT k.filter_active"
                        ),
                        params,
                    )
                elif what == "logo_id":  # unique: free it on the other row first
                    logo = bind.execute(
                        sa.text(
                            f"SELECT o.logo_id FROM {table} o, {table} k WHERE o.id = :other AND k.id = :keep AND k.logo_id IS NULL"
                        ),
                        params,
                    ).scalar()
                    if logo:
                        bind.execute(sa.text(f"UPDATE {table} SET logo_id = NULL WHERE id = :other"), params)
                        bind.execute(
                            sa.text(f"UPDATE {table} SET logo_id = :logo WHERE id = :keep"), {**params, "logo": logo}
                        )
                else:
                    bind.execute(
                        sa.text(
                            f"UPDATE {table} k SET {what} = o.{what} FROM {table} o "
                            f"WHERE k.id = :keep AND o.id = :other AND k.{what} IS NULL AND o.{what} IS NOT NULL"
                        ),
                        params,
                    )
            bind.execute(sa.text(f"DELETE FROM {table} WHERE id = :other"), params)


def upgrade() -> None:
    for table in REFERENCES:
        _merge_duplicates(table)
        op.create_index(f"uq_{table}_name_en", table, [sa.text("lower(name ->> 'en')")], unique=True)


def downgrade() -> None:
    for table in REFERENCES:
        op.drop_index(f"uq_{table}_name_en", table_name=table)
