"""Many-to-many link tables. Every one keeps a `position`, so lists keep the order they were saved in.

Links are written by the repositories with plain INSERT/DELETE (see repositories/links.py) and read
through view-only relationships ordered by `position`.
"""

from sqlalchemy import Column, ForeignKey, Integer, Table, UniqueConstraint

from app.db.base import Base


def link_table(
    name: str,
    owner: tuple[str, str],
    target: tuple[str, str],
    *,
    unique_target: bool = False,
) -> Table:
    """`owner`/`target` = (column name, referenced table). Owner rows cascade; targets in use can't
    be deleted (the services report what uses them first)."""
    owner_col, owner_table = owner
    target_col, target_table = target
    args: list = [
        Column(owner_col, ForeignKey(f"{owner_table}.id", ondelete="CASCADE"), primary_key=True),
        Column(target_col, ForeignKey(f"{target_table}.id", ondelete="RESTRICT"), primary_key=True, index=True),
        Column("position", Integer, nullable=False, default=0),
    ]
    if unique_target:  # a file belongs to one owner only
        args.append(UniqueConstraint(target_col, name=f"uq_{name}_{target_col}"))
    return Table(name, Base.metadata, *args)


tech_stack_fields = link_table(
    "tech_stack_fields", ("tech_stack_id", "tech_stacks"), ("field_id", "development_fields")
)
tech_stack_instruments = link_table(
    "tech_stack_instruments", ("tech_stack_id", "tech_stacks"), ("instrument_id", "instruments")
)

experience_techs = link_table("experience_techs", ("experience_id", "experiences"), ("tech_stack_id", "tech_stacks"))
experience_fields = link_table(
    "experience_fields", ("experience_id", "experiences"), ("field_id", "development_fields")
)
experience_projects = link_table("experience_projects", ("experience_id", "experiences"), ("project_id", "projects"))
experience_testimonials = link_table(
    "experience_testimonials", ("experience_id", "experiences"), ("testimonial_id", "testimonials")
)

project_types = link_table("project_types", ("project_id", "projects"), ("product_type_id", "product_types"))
project_techs = link_table("project_techs", ("project_id", "projects"), ("tech_stack_id", "tech_stacks"))
project_media = link_table("project_media", ("project_id", "projects"), ("media_id", "media"), unique_target=True)

testimonial_projects = link_table(
    "testimonial_projects", ("testimonial_id", "testimonials"), ("project_id", "projects")
)

certificate_fields = link_table(
    "certificate_fields", ("certificate_id", "certificates"), ("field_id", "development_fields")
)
certificate_media = link_table(
    "certificate_media", ("certificate_id", "certificates"), ("media_id", "media"), unique_target=True
)
