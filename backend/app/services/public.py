"""What the public site shows: one language at a time, computed numbers, only published data."""

import re
from datetime import UTC, date, datetime

from app.core.contacts import channel_link
from app.core.errors import NotFound, ServiceUnavailable
from app.core.places import utc_offset_label
from app.core.roles import role_label
from app.core.text import date_to_month
from app.models import Certificate, Company, Experience, Institute, Media, Project, TechStack, Testimonial
from app.repositories.public import ListQuery, PublicRepository
from app.repositories.storage import Storage
from app.schemas import public as s

CHANNEL_LABELS = {"email": "Email", "telegram": "Telegram", "whatsapp": "WhatsApp", "linkedin": "LinkedIn"}
CARD_STACK = 3


def tr(value: dict[str, str] | None, lang: str) -> str | None:
    """The text in `lang`, falling back to English."""
    if not value:
        return None
    return value.get(lang) or value.get("en")


def month_index(value: date) -> int:
    return value.year * 12 + value.month - 1


def total_months(ranges: list[tuple[date, date | None]], today: date | None = None) -> int:
    """Months covered by several periods; overlaps (and a shared boundary month) count once."""
    now = today or datetime.now(UTC).date()
    spans = sorted((month_index(start), month_index(end or now)) for start, end in ranges)
    total, current = 0, None
    for start, end in spans:
        if current and start <= current[1]:
            current[1] = max(current[1], end)
        else:
            if current:
                total += current[1] - current[0] + 1
            current = [start, end]
    if current:
        total += current[1] - current[0] + 1
    return total


def paragraphs(text: str | None) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text or "") if p.strip()]


class PublicService:
    def __init__(self, repo: PublicRepository, storage: Storage) -> None:
        self.repo = repo
        self.storage = storage

    # --- building blocks ------------------------------------------------------------------------

    def url(self, media: Media | None) -> str | None:
        return self.storage.url(media.storage_key) if media else None

    def media_item(self, media: Media) -> s.MediaItem:
        video = media.content_type.startswith("video/")
        return s.MediaItem(
            type="video" if video else "image",
            src=self.url(media) or "",
            poster=self.url(media.poster) if video else None,
            width=media.width,
            height=media.height,
        )

    def organization(self, org: Company | Institute, lang: str) -> s.Organization:
        name = org.name if isinstance(org.name, str) else tr(org.name, lang)
        return s.Organization(name=name or "", url=org.website_url, logo=self.url(org.logo))

    @staticmethod
    def tech(t: TechStack) -> s.TechRef:
        return s.TechRef(id=str(t.id), name=t.name, icon=t.icon_svg, color=t.color)

    @staticmethod
    def icon_ref(item, lang: str) -> s.IconRef:
        return s.IconRef(id=str(item.id), title=tr(item.name, lang) or "", icon=item.icon_svg)

    @staticmethod
    def refs(items, lang: str) -> list[s.Ref]:
        return [s.Ref(id=str(i.id), title=tr(i.name, lang) or "") for i in sorted(items, key=lambda i: i.position)]

    @staticmethod
    def bounds(ranges: list[tuple[date, date | None]]) -> s.DateBounds:
        if not ranges:
            return s.DateBounds(min_date=None, max_date=None)
        today = datetime.now(UTC).date().replace(day=1)
        return s.DateBounds(
            min_date=date_to_month(min(start for start, _ in ranges)),
            max_date=date_to_month(max(end or today for _, end in ranges)),
        )

    # --- profile and skills ---------------------------------------------------------------------

    async def profile(self, lang: str) -> s.Profile:
        hero, about, contacts = await self.repo.sections()
        if hero is None or about is None:
            raise ServiceUnavailable("The site's content isn't set up yet", code="not_set_up")
        first, last = tr(hero.first_name, lang) or "", tr(hero.last_name, lang) or ""

        channels: list[s.ContactChannel] = []
        for channel in ("email", "telegram", "whatsapp", "linkedin"):
            value = getattr(contacts, channel) if contacts else None
            if value:
                url, handle = channel_link(channel, value)
                channels.append(s.ContactChannel(id=channel, label=CHANNEL_LABELS[channel], url=url, handle=handle))

        other_links = [
            s.OtherLink(
                id=str(link.id),
                label=link.platform.name,
                url=link.url,
                icon=link.platform.icon_svg,
                color=link.platform.color,
            )
            for link in await self.repo.other_links()
        ]
        _, techs = await self.repo.showcase()
        ranges = await self.repo.experience_ranges()
        return s.Profile(
            first_name=first,
            last_name=last,
            full_name=f"{first} {last}".strip(),
            role=tr(hero.role, lang) or "",
            tagline=tr(hero.description, lang),
            availability=hero.availability,
            resume_url=self.url(hero.resume) or "",
            about=s.AboutBlock(
                title=tr(about.title, lang) or "",
                paragraphs=paragraphs(tr(about.paragraph_1, lang)) + paragraphs(tr(about.paragraph_2, lang)),
                city=tr(about.city, lang) or "",
                country_code=about.country_code,
                utc_offset=utc_offset_label(about.timezone),
                open_to_remote=about.open_to_remote,
                open_to_relocation=about.open_to_relocation,
            ),
            email=contacts.email if contacts else None,
            contacts=channels,
            other_links=other_links,
            stats=s.Stats(
                experience_months=total_months(ranges),
                roles=len(ranges),
                projects=await self.repo.count(Project),
                certificates=await self.repo.count(Certificate),
                technologies=len(techs),
            ),
        )

    async def skills(self, lang: str) -> s.Skills:
        filters, techs = await self.repo.showcase()
        categories = [self.icon_ref(item, lang) for _, item in filters]
        shown = {c.id for c in categories}
        items = [
            s.TechItem(
                id=str(t.id),
                name=t.name,
                icon=t.icon_svg,
                color=t.color,
                url=t.docs_url,
                categories=[str(c.id) for c in (*t.fields, *t.instruments) if str(c.id) in shown],
            )
            for t in techs
        ]
        return s.Skills(categories=categories, items=items)

    # --- experience -----------------------------------------------------------------------------

    def experience_item(self, e: Experience, lang: str) -> s.ExperienceItem:
        return s.ExperienceItem(
            id=str(e.id),
            role=tr(e.title, lang) or "",
            company=self.organization(e.company, lang),
            start=date_to_month(e.start_month),
            end=date_to_month(e.end_month) if e.end_month else None,
            description=tr(e.description, lang) or "",
            stack=[self.tech(t) for t in e.techs],
            projects=[s.Ref(id=p.slug, title=tr(p.title, lang) or "") for p in e.projects],
            testimonials=[s.Ref(id=str(t.id), title=tr(t.author_name, lang) or "") for t in e.testimonials],
        )

    async def experience_page(self, lang: str, q: ListQuery) -> s.ExperiencePage:
        items, total = await self.repo.experiences(q)
        return s.ExperiencePage(items=[self.experience_item(e, lang) for e in items], total=total)

    async def experience_filters(self, lang: str) -> s.ExperienceFilters:
        records = await self.repo.all_experiences()
        techs = {t.id: t for e in records for t in e.techs}
        fields = {f.id: f for e in records for f in e.fields}
        return s.ExperienceFilters(
            companies=sorted({e.company.name for e in records}, key=str.casefold),
            stack=[self.tech(t) for t in sorted(techs.values(), key=lambda t: t.name.casefold())],
            fields=[
                s.Ref(id=str(f.id), title=tr(f.name, lang) or "")
                for f in sorted(fields.values(), key=lambda f: f.position)
            ],
            **self.bounds([(e.start_month, e.end_month) for e in records]).model_dump(),
        )

    # --- projects -------------------------------------------------------------------------------

    def cover(self, p: Project) -> s.MediaItem | None:
        chosen = p.cover or next((m for m in p.media if m.content_type.startswith("image/")), None)
        if chosen is None:
            chosen = next((m for m in p.media if m.poster), None)
            return (
                s.MediaItem(
                    type="image",
                    src=self.url(chosen.poster) or "",
                    poster=None,
                    width=chosen.width,
                    height=chosen.height,
                )
                if chosen
                else None
            )
        return self.media_item(chosen)

    def project_card(self, p: Project, lang: str) -> s.ProjectCard:
        return s.ProjectCard(
            id=p.slug,
            title=tr(p.title, lang) or "",
            types=[self.icon_ref(t, lang) for t in p.types],
            end=date_to_month(p.end_month),
            stack=[self.tech(t) for t in p.techs[:CARD_STACK]],
            cover=self.cover(p),
            repo_url=p.repo_url,
            live_url=p.live_url,
            is_private=p.is_private,
        )

    async def projects_page(self, lang: str, q: ListQuery) -> s.ProjectsPage:
        items, total = await self.repo.projects(q)
        return s.ProjectsPage(items=[self.project_card(p, lang) for p in items], total=total)

    async def project(self, lang: str, slug: str) -> s.ProjectDetail:
        p = await self.repo.project_by_slug(slug)
        if p is None:
            raise NotFound("Project not found")
        text = paragraphs(tr(p.description, lang))
        summary = re.sub(r"\*\*(.+?)\*\*", r"\1", text[0]) if text else ""
        card = self.project_card(p, lang).model_dump()
        card["stack"] = [self.tech(t) for t in p.techs]
        return s.ProjectDetail(
            **card,
            summary=summary[:300],
            description=text,
            start=date_to_month(p.start_month),
            client=s.ProjectClient(
                kind=p.client_kind,
                name=p.company.name if p.company else None,
                url=p.company.website_url if p.company else None,
            ),
            traffic=p.traffic,
            media=[self.media_item(m) for m in p.media],
        )

    async def project_slugs(self) -> list[str]:
        return await self.repo.project_slugs()

    async def project_filters(self, lang: str) -> s.ProjectFilters:
        records = await self.repo.all_projects()
        clients = sorted({p.company.name for p in records if p.company}, key=str.casefold)
        clients += [kind for kind in ("private", "self") if any(p.client_kind == kind for p in records)]
        techs = {t.id: t for p in records for t in p.techs}
        types = {t.id: t for p in records for t in p.types}
        return s.ProjectFilters(
            clients=clients,
            stack=[self.tech(t) for t in sorted(techs.values(), key=lambda t: t.name.casefold())],
            types=[self.icon_ref(t, lang) for t in sorted(types.values(), key=lambda t: t.position)],
            **self.bounds([(p.start_month, p.end_month) for p in records]).model_dump(),
        )

    # --- certificates ---------------------------------------------------------------------------

    def certificate_item(self, c: Certificate, lang: str) -> s.CertificateItem:
        return s.CertificateItem(
            id=str(c.id),
            title=tr(c.title, lang) or "",
            issuer=self.organization(c.institute, lang),
            start=date_to_month(c.start_month),
            end=date_to_month(c.end_month),
            fields=[s.Ref(id=str(f.id), title=tr(f.name, lang) or "") for f in c.fields],
            images=[self.media_item(m) for m in c.images],
            verify_url=c.verify_url,
        )

    async def certificates_page(self, lang: str, q: ListQuery) -> s.CertificatesPage:
        items, total = await self.repo.certificates(q)
        return s.CertificatesPage(items=[self.certificate_item(c, lang) for c in items], total=total)

    async def certificate_filters(self, lang: str) -> s.CertificateFilters:
        records = await self.repo.all_certificates()
        fields = {f.id: f for c in records for f in c.fields}
        return s.CertificateFilters(
            fields=[
                s.Ref(id=str(f.id), title=tr(f.name, lang) or "")
                for f in sorted(fields.values(), key=lambda f: f.position)
            ],
            **self.bounds([(c.start_month, c.end_month) for c in records]).model_dump(),
        )

    # --- testimonials ---------------------------------------------------------------------------

    def testimonial_item(self, t: Testimonial, lang: str) -> s.TestimonialItem:
        return s.TestimonialItem(
            id=str(t.id),
            author=tr(t.author_name, lang) or "",
            role=tr(t.author_role, lang) or "",
            company=self.organization(t.company, lang),
            my_role=role_label((t.field or t.tech_stack).name)[lang],
            date=t.given_on.isoformat(),
            quote=tr(t.quote, lang),
            media=self.media_item(t.media) if t.media else None,
            projects=[
                s.TestimonialProject(title=tr(p.title, lang) or "", href=f"/projects/{p.slug}") for p in t.projects
            ],
            verify_url=t.verify_url,
        )

    async def testimonials_page(self, lang: str, q: ListQuery) -> s.TestimonialsPage:
        items, total = await self.repo.testimonials(q)
        return s.TestimonialsPage(items=[self.testimonial_item(t, lang) for t in items], total=total)

    async def testimonial_filters(self) -> s.DateBounds:
        first, last = await self.repo.testimonial_dates()
        return s.DateBounds(
            min_date=date_to_month(first) if first else None, max_date=date_to_month(last) if last else None
        )
