"""Rules for the Hero, About and Contacts sections, Other links, the Tech stack page and messages."""

import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from app.core.config import Settings
from app.core.errors import FieldErrors, NotFound, TooManyRequests
from app.core.throttle import retry_after
from app.models import About, ContactMessage, Contacts, DevelopmentField, Hero, Instrument, OtherLink, TechStack
from app.models.enums import MediaPurpose
from app.repositories.sections import MessagesRepository, OtherLinksRepository, SectionsRepository, ShowcaseRepository
from app.schemas.sections import AboutIn, ContactMessageIn, ContactsIn, HeroIn, OtherLinkIn, TechShowcaseIn
from app.services.media import MediaService


def utcnow() -> datetime:
    return datetime.now(UTC)


class SectionsService:
    def __init__(self, repo: SectionsRepository, media: MediaService) -> None:
        self.repo = repo
        self.media = media

    async def get_hero(self) -> Hero | None:
        return await self.repo.get_hero()

    async def save_hero(self, data: HeroIn) -> Hero:
        hero = await self.repo.get_hero()
        old_resume = None
        if hero is None or hero.resume_id != data.resume_id:
            await self.media.claim([data.resume_id], {MediaPurpose.RESUME}, field="resume_id", owner_id="1")
            old_resume = hero.resume if hero else None
        hero = hero or Hero(id=1)
        for key, value in data.model_dump().items():
            setattr(hero, key, value)
        await self.repo.save(hero)
        await self.repo.commit()
        await self.repo.refresh(hero)
        if old_resume is not None:
            await self.media.discard([old_resume])
        return hero

    async def get_about(self) -> About | None:
        return await self.repo.get_about()

    async def save_about(self, data: AboutIn) -> About:
        about = await self.repo.get_about() or About(id=1)
        for key, value in data.model_dump().items():
            setattr(about, key, value)
        await self.repo.save(about)
        await self.repo.commit()
        await self.repo.refresh(about)
        return about

    async def get_contacts(self) -> Contacts | None:
        return await self.repo.get_contacts()

    async def save_contacts(self, data: ContactsIn) -> Contacts:
        contacts = await self.repo.get_contacts() or Contacts(id=1)
        for key, value in data.model_dump().items():
            setattr(contacts, key, value)
        await self.repo.save(contacts)
        await self.repo.commit()
        await self.repo.refresh(contacts)
        return contacts


class OtherLinksService:
    def __init__(self, repo: OtherLinksRepository) -> None:
        self.repo = repo

    async def all(self) -> list[OtherLink]:
        return await self.repo.all()

    async def _check_platform(self, platform_id: uuid.UUID) -> None:
        if await self.repo.platform(platform_id) is None:
            raise FieldErrors.single(("platform_id",), "Pick a platform from the list")

    async def _get(self, link_id: uuid.UUID) -> OtherLink:
        link = await self.repo.get(link_id)
        if link is None:
            raise NotFound("This link doesn't exist")
        return link

    async def create(self, data: OtherLinkIn) -> OtherLink:
        await self._check_platform(data.platform_id)
        link = OtherLink(platform_id=data.platform_id, url=data.url, position=await self.repo.next_position())
        await self.repo.add(link)
        await self.repo.commit()
        await self.repo.refresh(link)
        return link

    async def update(self, link_id: uuid.UUID, data: OtherLinkIn) -> OtherLink:
        link = await self._get(link_id)
        await self._check_platform(data.platform_id)
        link.platform_id, link.url = data.platform_id, data.url
        await self.repo.commit()
        await self.repo.refresh(link)
        return link

    async def delete(self, link_id: uuid.UUID) -> None:
        await self.repo.delete(await self._get(link_id))
        await self.repo.commit()

    async def reorder(self, ids: list[uuid.UUID]) -> None:
        if set(ids) != set(await self.repo.all_ids()):
            raise FieldErrors.single(("ids",), "List every link exactly once")
        await self.repo.set_positions(ids)
        await self.repo.commit()


class TechShowcaseService:
    """The Tech stack page: which filters and technologies the public site shows, in order."""

    def __init__(self, repo: ShowcaseRepository) -> None:
        self.repo = repo

    async def get(self) -> tuple[list[tuple[str, uuid.UUID]], list[uuid.UUID]]:
        filters = [(kind, item_id) for kind, item_id, _ in await self.repo.active_filters()]
        return filters, await self.repo.active_tech_ids()

    async def save(self, data: TechShowcaseIn) -> tuple[list[tuple[str, uuid.UUID]], list[uuid.UUID]]:
        fields = await self.repo.existing_ids(DevelopmentField, [f.id for f in data.filters if f.kind == "field"])
        instruments = await self.repo.existing_ids(Instrument, [f.id for f in data.filters if f.kind == "instrument"])
        techs = await self.repo.existing_ids(TechStack, data.tech_ids)
        errors: list[tuple[tuple[str | int, ...], str]] = [
            (("filters", i), "Not found")
            for i, f in enumerate(data.filters)
            if f.id not in (fields if f.kind == "field" else instruments)
        ]
        errors += [(("tech_ids", i), "Not found") for i, tech_id in enumerate(data.tech_ids) if tech_id not in techs]
        if errors:
            raise FieldErrors(errors)
        filters = [(f.kind, f.id) for f in data.filters]
        await self.repo.replace(filters, data.tech_ids)
        await self.repo.commit()
        return filters, list(data.tech_ids)


class MessagesService:
    def __init__(self, repo: MessagesRepository, settings: Settings, *, clock: Callable[[], datetime] = utcnow) -> None:
        self.repo = repo
        self.settings = settings
        self.clock = clock

    async def receive(self, data: ContactMessageIn, *, ip_hash: str) -> None:
        """A message from the public contact form: rate-limited per visitor; bots are quietly ignored."""
        if data.website:
            return
        now = self.clock()
        window = timedelta(hours=1)
        since = now - window
        wait = retry_after(
            await self.repo.sent_since(since, ip_hash), self.settings.contact_max_per_hour, window, now
        ) or retry_after(await self.repo.sent_since(since), self.settings.contact_max_per_hour_global, window, now)
        if wait is not None:
            raise TooManyRequests("Too many messages right now. Try again later.", retry_after=wait)
        await self.repo.add(
            ContactMessage(
                name=data.name,
                contact=data.contact,
                message=data.message,
                source=data.source,
                ip_hash=ip_hash,
                created_at=now,
            )
        )
        await self.repo.commit()

    async def page(self, offset: int, limit: int) -> tuple[list[ContactMessage], int]:
        return await self.repo.page(offset, limit)

    async def delete(self, message_id: uuid.UUID) -> None:
        message = await self.repo.get(message_id)
        if message is None:
            raise NotFound("This message doesn't exist")
        await self.repo.delete(message)
        await self.repo.commit()
