"""Read queries for the public site: filters and paging run in SQL."""

import uuid
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import Select, func, or_, select

from app.models import (
    About,
    Certificate,
    Company,
    Contacts,
    DevelopmentField,
    Experience,
    Hero,
    Instrument,
    OtherLink,
    Project,
    TechStack,
    Testimonial,
    links,
)
from app.repositories.base import Repository
from app.repositories.content import EXPERIENCE_ORDER


@dataclass
class ListQuery:
    offset: int = 0
    limit: int = 10
    start: date | None = None  # keep records overlapping [start, end]
    end: date | None = None
    companies: list[str] = field(default_factory=list)
    clients: list[str] = field(default_factory=list)
    stack: list[uuid.UUID] = field(default_factory=list)
    fields: list[uuid.UUID] = field(default_factory=list)
    types: list[uuid.UUID] = field(default_factory=list)


def _linked(owner_col, target_col, ids: list[uuid.UUID]):
    """owner id IN (owners linked to any of `ids`)."""
    return select(owner_col).where(target_col.in_(ids))


class PublicRepository(Repository):
    async def sections(self) -> tuple[Hero | None, About | None, Contacts | None]:
        return (
            await self.session.get(Hero, 1),
            await self.session.get(About, 1),
            await self.session.get(Contacts, 1),
        )

    async def other_links(self) -> list[OtherLink]:
        return list(await self.session.scalars(select(OtherLink).order_by(OtherLink.position, OtherLink.created_at)))

    async def count(self, model: type) -> int:
        return await self.session.scalar(select(func.count()).select_from(model)) or 0

    async def showcase(self) -> tuple[list[tuple[str, object]], list[TechStack]]:
        filters: list[tuple[int, str, object]] = []
        for kind, model in (("field", DevelopmentField), ("instrument", Instrument)):
            for item in await self.session.scalars(select(model).where(model.filter_active.is_(True))):
                filters.append((item.filter_position, kind, item))
        techs = await self.session.scalars(
            select(TechStack).where(TechStack.showcase_active.is_(True)).order_by(TechStack.showcase_position)
        )
        return [(kind, item) for _, kind, item in sorted(filters, key=lambda f: f[0])], list(techs)

    async def experience_ranges(self) -> list[tuple[date, date | None]]:
        rows = await self.session.execute(select(Experience.start_month, Experience.end_month))
        return [(start, end) for start, end in rows]

    async def _page(self, query: Select, order: tuple, q: ListQuery) -> tuple[list, int]:
        total = await self.session.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
        items = await self.session.scalars(query.order_by(*order).offset(q.offset).limit(q.limit))
        return list(items.unique()), total

    async def experiences(self, q: ListQuery) -> tuple[list[Experience], int]:
        query = select(Experience)
        if q.companies:
            query = query.where(Experience.company_id.in_(select(Company.id).where(Company.name.in_(q.companies))))
        if q.stack:
            ids = _linked(links.experience_techs.c.experience_id, links.experience_techs.c.tech_stack_id, q.stack)
            query = query.where(Experience.id.in_(ids))
        if q.fields:
            ids = _linked(links.experience_fields.c.experience_id, links.experience_fields.c.field_id, q.fields)
            query = query.where(Experience.id.in_(ids))
        if q.start:
            query = query.where(or_(Experience.is_current.is_(True), Experience.end_month >= q.start))
        if q.end:
            query = query.where(Experience.start_month <= q.end)
        return await self._page(query, EXPERIENCE_ORDER, q)

    async def all_experiences(self) -> list[Experience]:
        return list(await self.session.scalars(select(Experience)))

    async def projects(self, q: ListQuery) -> tuple[list[Project], int]:
        query = select(Project)
        if q.clients:
            names = [c for c in q.clients if c not in ("private", "self")]
            conditions = []
            if names:
                conditions.append(Project.company_id.in_(select(Company.id).where(Company.name.in_(names))))
            for special in {"private", "self"} & set(q.clients):
                conditions.append(Project.client_kind == special)
            query = query.where(or_(*conditions))
        if q.types:
            ids = _linked(links.project_types.c.project_id, links.project_types.c.product_type_id, q.types)
            query = query.where(Project.id.in_(ids))
        if q.stack:
            ids = _linked(links.project_techs.c.project_id, links.project_techs.c.tech_stack_id, q.stack)
            query = query.where(Project.id.in_(ids))
        if q.start:
            query = query.where(Project.end_month >= q.start)
        if q.end:
            query = query.where(Project.start_month <= q.end)
        return await self._page(
            query, (Project.end_month.desc(), Project.start_month.desc(), Project.created_at.desc()), q
        )

    async def all_projects(self) -> list[Project]:
        return list(await self.session.scalars(select(Project)))

    async def project_by_slug(self, slug: str) -> Project | None:
        return await self.session.scalar(select(Project).where(Project.slug == slug))

    async def project_slugs(self) -> list[str]:
        return list(await self.session.scalars(select(Project.slug).order_by(Project.slug)))

    async def certificates(self, q: ListQuery) -> tuple[list[Certificate], int]:
        query = select(Certificate)
        if q.fields:
            ids = _linked(links.certificate_fields.c.certificate_id, links.certificate_fields.c.field_id, q.fields)
            query = query.where(Certificate.id.in_(ids))
        if q.start:
            query = query.where(Certificate.end_month >= q.start)
        if q.end:
            query = query.where(Certificate.start_month <= q.end)
        order = (Certificate.end_month.desc(), Certificate.start_month.desc(), Certificate.created_at.desc())
        return await self._page(query, order, q)

    async def all_certificates(self) -> list[Certificate]:
        return list(await self.session.scalars(select(Certificate)))

    async def testimonials(self, q: ListQuery) -> tuple[list[Testimonial], int]:
        query = select(Testimonial)
        if q.start:
            query = query.where(Testimonial.given_on >= q.start)
        if q.end:
            # `end` is the 1st of the last month: keep the whole month.
            next_month = date(q.end.year + q.end.month // 12, q.end.month % 12 + 1, 1)
            query = query.where(Testimonial.given_on < next_month)
        return await self._page(query, (Testimonial.given_on.desc(), Testimonial.created_at.desc()), q)

    async def testimonial_dates(self) -> tuple[date | None, date | None]:
        row = (await self.session.execute(select(func.min(Testimonial.given_on), func.max(Testimonial.given_on)))).one()
        return row[0], row[1]
