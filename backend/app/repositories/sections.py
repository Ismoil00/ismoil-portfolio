"""Database access for the single-row sections, other links, the Tech stack page and messages."""

import uuid
from datetime import datetime

from sqlalchemy import func, select, update

from app.models import (
    About,
    ContactMessage,
    Contacts,
    DevelopmentField,
    Hero,
    Instrument,
    LinkPlatform,
    OtherLink,
    TechStack,
)
from app.repositories.base import Repository


class SectionsRepository(Repository):
    async def get_hero(self) -> Hero | None:
        return await self.session.get(Hero, 1)

    async def get_about(self) -> About | None:
        return await self.session.get(About, 1)

    async def get_contacts(self) -> Contacts | None:
        return await self.session.get(Contacts, 1)

    async def save(self, row: object) -> None:
        self.session.add(row)
        await self.session.flush()

    async def refresh(self, row: object) -> None:
        await self.session.refresh(row)


class OtherLinksRepository(Repository):
    async def all(self) -> list[OtherLink]:
        return list(await self.session.scalars(select(OtherLink).order_by(OtherLink.position, OtherLink.created_at)))

    async def get(self, link_id: uuid.UUID) -> OtherLink | None:
        return await self.session.get(OtherLink, link_id)

    async def platform(self, platform_id: uuid.UUID) -> LinkPlatform | None:
        return await self.session.get(LinkPlatform, platform_id)

    async def next_position(self) -> int:
        current = await self.session.scalar(select(func.max(OtherLink.position)))
        return 0 if current is None else current + 1

    async def add(self, link: OtherLink) -> None:
        self.session.add(link)
        await self.session.flush()

    async def delete(self, link: OtherLink) -> None:
        await self.session.delete(link)
        await self.session.flush()

    async def refresh(self, link: OtherLink) -> None:
        await self.session.refresh(link)

    async def all_ids(self) -> list[uuid.UUID]:
        return list(await self.session.scalars(select(OtherLink.id)))

    async def set_positions(self, ids: list[uuid.UUID]) -> None:
        for position, link_id in enumerate(ids):
            await self.session.execute(update(OtherLink).where(OtherLink.id == link_id).values(position=position))


class ShowcaseRepository(Repository):
    async def active_filters(self) -> list[tuple[str, uuid.UUID, int]]:
        """(kind, id, position) of the activated filters, in display order."""
        rows: list[tuple[str, uuid.UUID, int]] = []
        for kind, model in (("field", DevelopmentField), ("instrument", Instrument)):
            query = select(model.id, model.filter_position).where(model.filter_active.is_(True))
            rows += [(kind, item_id, position) for item_id, position in await self.session.execute(query)]
        return sorted(rows, key=lambda row: row[2])

    async def active_tech_ids(self) -> list[uuid.UUID]:
        query = select(TechStack.id).where(TechStack.showcase_active.is_(True)).order_by(TechStack.showcase_position)
        return list(await self.session.scalars(query))

    async def existing_ids(self, model: type, ids: list[uuid.UUID]) -> set[uuid.UUID]:
        if not ids:
            return set()
        return set(await self.session.scalars(select(model.id).where(model.id.in_(ids))))

    async def replace(self, filters: list[tuple[str, uuid.UUID]], tech_ids: list[uuid.UUID]) -> None:
        for model in (DevelopmentField, Instrument):
            await self.session.execute(update(model).values(filter_active=False, filter_position=0))
        await self.session.execute(update(TechStack).values(showcase_active=False, showcase_position=0))
        for position, (kind, item_id) in enumerate(filters):
            model = DevelopmentField if kind == "field" else Instrument
            await self.session.execute(
                update(model).where(model.id == item_id).values(filter_active=True, filter_position=position)
            )
        for position, tech_id in enumerate(tech_ids):
            await self.session.execute(
                update(TechStack)
                .where(TechStack.id == tech_id)
                .values(showcase_active=True, showcase_position=position)
            )


class MessagesRepository(Repository):
    async def add(self, message: ContactMessage) -> None:
        self.session.add(message)
        await self.session.flush()

    async def page(self, offset: int, limit: int) -> tuple[list[ContactMessage], int]:
        total = await self.session.scalar(select(func.count()).select_from(ContactMessage)) or 0
        query = (
            select(ContactMessage)
            .order_by(ContactMessage.created_at.desc(), ContactMessage.id)
            .offset(offset)
            .limit(limit)
        )
        return list(await self.session.scalars(query)), total

    async def get(self, message_id: uuid.UUID) -> ContactMessage | None:
        return await self.session.get(ContactMessage, message_id)

    async def delete(self, message: ContactMessage) -> None:
        await self.session.delete(message)
        await self.session.flush()

    async def sent_since(self, since: datetime, ip_hash: str | None = None) -> list[datetime]:
        """When messages arrived since `since` (from one visitor, or from everyone), oldest first."""
        query = select(ContactMessage.created_at).where(ContactMessage.created_at >= since)
        if ip_hash is not None:
            query = query.where(ContactMessage.ip_hash == ip_hash)
        return list(await self.session.scalars(query.order_by(ContactMessage.created_at)))
