"""The migration that made selector names unique merges duplicates first: the first one listed is
kept and everything pointing at the others moves to it. Run here on a database with duplicates
(the index is dropped inside the test's transaction, which is rolled back afterwards)."""

import importlib.util
from datetime import date

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import select, text

from app.core.config import BASE_DIR
from app.models import (
    Company,
    DevelopmentField,
    TechStack,
    content,  # content.Testimonial: a bare name starting with "Test" would be collected
    links,
)

[MIGRATION] = (BASE_DIR / "alembic" / "versions").glob("*_one_english_name_per_selector_item.py")


def _merge(sync_session, table: str) -> None:
    spec = importlib.util.spec_from_file_location("merge_migration", MIGRATION)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with Operations.context(MigrationContext.configure(sync_session.connection())):
        module._merge_duplicates(table)


async def test_duplicates_are_merged_into_the_first_with_everything_that_used_them(db_session):
    await db_session.execute(text("DROP INDEX uq_development_fields_name_en"))
    keep = DevelopmentField(name={"en": "Game development", "ru": "Геймдев", "tg": "Бозисозӣ"}, position=1)
    other = DevelopmentField(
        name={"en": "game DEVELOPMENT", "ru": "Разработка игр", "tg": "Таҳияи бозиҳо"},
        position=2,
        icon_svg="<svg/>",
        filter_active=True,
        filter_position=4,
    )
    both, only_other = (TechStack(name=n, icon_svg="<svg/>", color="#FFFFFF") for n in ("Unity", "Godot"))
    company = Company(name="Pixel Forge")
    db_session.add_all([keep, other, both, only_other, company])
    await db_session.flush()
    await db_session.execute(
        links.tech_stack_fields.insert(),
        [
            {"tech_stack_id": both.id, "field_id": keep.id, "position": 0},
            {"tech_stack_id": both.id, "field_id": other.id, "position": 1},
            {"tech_stack_id": only_other.id, "field_id": other.id, "position": 0},
        ],
    )
    testimonial = content.Testimonial(
        author_name={"en": "A", "ru": "A", "tg": "A"},
        author_role={"en": "B", "ru": "B", "tg": "B"},
        company_id=company.id,
        field_id=other.id,
        given_on=date(2025, 1, 1),
        verify_url="https://example.com/",
    )
    db_session.add(testimonial)
    await db_session.flush()
    keep_id, other_id, testimonial_id = keep.id, other.id, testimonial.id
    db_session.expunge_all()

    await db_session.run_sync(_merge, "development_fields")

    left = (
        await db_session.scalars(select(DevelopmentField).where(DevelopmentField.id.in_([keep_id, other_id])))
    ).all()
    assert [f.id for f in left] == [keep_id]
    assert left[0].name["ru"] == "Геймдев"  # the kept one's own texts
    assert left[0].icon_svg == "<svg/>" and left[0].filter_active and left[0].filter_position == 4  # taken over
    rows = (
        await db_session.execute(select(links.tech_stack_fields.c.tech_stack_id, links.tech_stack_fields.c.field_id))
    ).all()
    assert sorted((str(t), f) for t, f in rows) == sorted([(str(both.id), keep_id), (str(only_other.id), keep_id)])
    assert (await db_session.get(content.Testimonial, testimonial_id)).field_id == keep_id
