"""Generic database access for selector tables (one repository class, configured per table)."""

import uuid
from collections import defaultdict

from sqlalchemy import Column, func, select, update

from app.repositories.base import Repository


class SelectorRepository[T](Repository):
    def __init__(self, session, model: type[T]) -> None:
        super().__init__(session)
        self.model = model

    async def all(self) -> list[T]:
        query = select(self.model).order_by(self.model.position, self.model.created_at)
        return list(await self.session.scalars(query))

    async def get(self, item_id: uuid.UUID) -> T | None:
        return await self.session.get(self.model, item_id)

    async def add(self, item: T) -> None:
        self.session.add(item)
        await self.session.flush()

    async def delete(self, item: T) -> None:
        await self.session.delete(item)
        await self.session.flush()

    async def refresh(self, item: T) -> None:
        await self.session.refresh(item)

    async def next_position(self) -> int:
        current = await self.session.scalar(select(func.max(self.model.position)))
        return 0 if current is None else current + 1

    async def name_taken(self, name: str, *, i18n: bool, exclude: uuid.UUID | None) -> bool:
        column = self.model.name["en"].astext if i18n else self.model.name
        query = select(self.model.id).where(func.lower(column) == name.lower())
        if exclude is not None:
            query = query.where(self.model.id != exclude)
        return await self.session.scalar(query.limit(1)) is not None

    async def existing_ids(self, model: type, ids: list[uuid.UUID]) -> set[uuid.UUID]:
        if not ids:
            return set()
        return set(await self.session.scalars(select(model.id).where(model.id.in_(ids))))

    async def all_ids(self) -> list[uuid.UUID]:
        return list(await self.session.scalars(select(self.model.id)))

    async def set_positions(self, ids: list[uuid.UUID]) -> None:
        for position, item_id in enumerate(ids):
            await self.session.execute(update(self.model).where(self.model.id == item_id).values(position=position))

    async def usage(
        self, references: list[tuple[str, Column]], flags: list[str], ids: list[uuid.UUID] | None = None
    ) -> dict[uuid.UUID, dict[str, int]]:
        """{item id: {"projects": 2, …}} — counted for all items at once (for list pages)."""
        found: dict[uuid.UUID, dict[str, int]] = defaultdict(dict)
        for label, column in references:
            query = select(column, func.count()).where(column.is_not(None)).group_by(column)
            if ids is not None:
                query = query.where(column.in_(ids))
            for item_id, count in await self.session.execute(query):
                found[item_id][label] = found[item_id].get(label, 0) + count
        for flag in flags:
            query = select(self.model.id).where(getattr(self.model, flag).is_(True))
            if ids is not None:
                query = query.where(self.model.id.in_(ids))
            for item_id in await self.session.scalars(query):
                found[item_id]["tech_section"] = 1
        return found
