"""Database access for experience, projects, testimonials and certificates."""

import uuid
from collections.abc import Sequence

from sqlalchemy import Column, func, nulls_first, select
from sqlalchemy.orm import InstrumentedAttribute

from app.models import Experience, Project
from app.repositories.base import Repository


class ContentRepository[T](Repository):
    def __init__(self, session, model: type[T]) -> None:
        super().__init__(session)
        self.model = model

    async def get(self, item_id: uuid.UUID) -> T | None:
        return await self.session.get(self.model, item_id)

    async def all(self, *order_by: object) -> list[T]:
        return list(await self.session.scalars(select(self.model).order_by(*order_by)))

    async def add(self, item: T) -> None:
        self.session.add(item)
        await self.session.flush()

    async def delete(self, item: T) -> None:
        await self.session.delete(item)
        await self.session.flush()

    async def refresh(self, item: T) -> None:
        await self.session.refresh(item)

    async def existing_ids(self, model: type, ids: Sequence[uuid.UUID]) -> set[uuid.UUID]:
        if not ids:
            return set()
        return set(await self.session.scalars(select(model.id).where(model.id.in_(list(ids)))))

    async def usage(
        self, references: list[tuple[str, Column | InstrumentedAttribute]], item_id: uuid.UUID
    ) -> dict[str, int]:
        found: dict[str, int] = {}
        for label, column in references:
            count = await self.session.scalar(select(func.count()).where(column == item_id))
            if count:
                found[label] = count
        return found

    async def present_experience(self, exclude: uuid.UUID | None) -> Experience | None:
        query = select(Experience).where(Experience.is_current.is_(True))
        if exclude is not None:
            query = query.where(Experience.id != exclude)
        return await self.session.scalar(query.limit(1))

    async def slug_taken(self, slug: str, exclude: uuid.UUID | None) -> bool:
        query = select(Project.id).where(Project.slug == slug)
        if exclude is not None:
            query = query.where(Project.id != exclude)
        return await self.session.scalar(query.limit(1)) is not None


EXPERIENCE_ORDER = (
    Experience.is_current.desc(),
    Experience.start_month.desc(),
    nulls_first(Experience.end_month.desc()),
)
