"""Admin: Hero, About, Contacts (+ Other links, messages) and the Tech stack page."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import MediaServiceDep, SessionDep, SettingsDep, media_out
from app.core.contacts import channel_link
from app.core.places import utc_offset_label
from app.models import About, Contacts, Hero, OtherLink
from app.repositories.sections import MessagesRepository, OtherLinksRepository, SectionsRepository, ShowcaseRepository
from app.schemas.sections import (
    AboutIn,
    AboutOut,
    ContactLink,
    ContactMessageOut,
    ContactsIn,
    ContactsOut,
    HeroIn,
    HeroOut,
    MessagesPage,
    OtherLinkIn,
    OtherLinkOut,
    PlatformRef,
    ShowcaseFilter,
    TechShowcaseIn,
    TechShowcaseOut,
)
from app.schemas.selectors import OrderIn
from app.services.media import MediaService
from app.services.sections import MessagesService, OtherLinksService, SectionsService, TechShowcaseService

router = APIRouter(tags=["admin: sections"])


def _sections(session: SessionDep, media: MediaServiceDep) -> SectionsService:
    return SectionsService(SectionsRepository(session), media)


Sections = Annotated[SectionsService, Depends(_sections)]


def hero_out(hero: Hero, media: MediaService) -> HeroOut:
    return HeroOut(
        first_name=hero.first_name,
        last_name=hero.last_name,
        role=hero.role,
        description=hero.description,
        resume=media_out(hero.resume, media),
        availability=hero.availability,
        updated_at=hero.updated_at,
    )


def about_out(about: About) -> AboutOut:
    data = {k: getattr(about, k) for k in AboutOut.model_fields if k != "utc_offset"}
    return AboutOut(**data, utc_offset=utc_offset_label(about.timezone))


def contacts_out(contacts: Contacts) -> ContactsOut:
    links: dict[str, ContactLink | None] = {}
    for channel in ("email", "telegram", "whatsapp", "linkedin"):
        value = getattr(contacts, channel)
        if value:
            url, handle = channel_link(channel, value)
            links[channel] = ContactLink(url=url, handle=handle)
        else:
            links[channel] = None
    return ContactsOut(
        email=contacts.email,
        telegram=contacts.telegram,
        whatsapp=contacts.whatsapp,
        linkedin=contacts.linkedin,
        links=links,
        updated_at=contacts.updated_at,
    )


@router.get("/hero", response_model=HeroOut | None)
async def get_hero(service: Sections, media: MediaServiceDep) -> HeroOut | None:
    hero = await service.get_hero()
    return hero_out(hero, media) if hero else None


@router.put("/hero", response_model=HeroOut)
async def save_hero(data: HeroIn, service: Sections, media: MediaServiceDep) -> HeroOut:
    return hero_out(await service.save_hero(data), media)


@router.get("/about", response_model=AboutOut | None)
async def get_about(service: Sections) -> AboutOut | None:
    about = await service.get_about()
    return about_out(about) if about else None


@router.put("/about", response_model=AboutOut)
async def save_about(data: AboutIn, service: Sections) -> AboutOut:
    return about_out(await service.save_about(data))


@router.get("/contacts", response_model=ContactsOut | None)
async def get_contacts(service: Sections) -> ContactsOut | None:
    contacts = await service.get_contacts()
    return contacts_out(contacts) if contacts else None


@router.put("/contacts", response_model=ContactsOut)
async def save_contacts(data: ContactsIn, service: Sections) -> ContactsOut:
    return contacts_out(await service.save_contacts(data))


# --- other links --------------------------------------------------------------------------------


def _links(session: SessionDep) -> OtherLinksService:
    return OtherLinksService(OtherLinksRepository(session))


Links = Annotated[OtherLinksService, Depends(_links)]


def link_out(link: OtherLink) -> OtherLinkOut:
    return OtherLinkOut(
        id=link.id, platform=PlatformRef.model_validate(link.platform), url=link.url, position=link.position
    )


@router.get("/other-links", response_model=list[OtherLinkOut])
async def list_other_links(service: Links) -> list[OtherLinkOut]:
    return [link_out(link) for link in await service.all()]


@router.post("/other-links", response_model=OtherLinkOut, status_code=status.HTTP_201_CREATED)
async def create_other_link(data: OtherLinkIn, service: Links) -> OtherLinkOut:
    return link_out(await service.create(data))


@router.put("/other-links/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_other_links(data: OrderIn, service: Links) -> None:
    await service.reorder(data.ids)


@router.put("/other-links/{link_id}", response_model=OtherLinkOut)
async def update_other_link(link_id: uuid.UUID, data: OtherLinkIn, service: Links) -> OtherLinkOut:
    return link_out(await service.update(link_id, data))


@router.delete("/other-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_other_link(link_id: uuid.UUID, service: Links) -> None:
    await service.delete(link_id)


# --- tech stack page ----------------------------------------------------------------------------


def _showcase(session: SessionDep) -> TechShowcaseService:
    return TechShowcaseService(ShowcaseRepository(session))


Showcase = Annotated[TechShowcaseService, Depends(_showcase)]


def showcase_out(filters: list[tuple[str, uuid.UUID]], tech_ids: list[uuid.UUID]) -> TechShowcaseOut:
    return TechShowcaseOut(filters=[ShowcaseFilter(kind=k, id=i) for k, i in filters], tech_ids=tech_ids)


@router.get("/tech-showcase", response_model=TechShowcaseOut)
async def get_tech_showcase(service: Showcase) -> TechShowcaseOut:
    return showcase_out(*await service.get())


@router.put("/tech-showcase", response_model=TechShowcaseOut)
async def save_tech_showcase(data: TechShowcaseIn, service: Showcase) -> TechShowcaseOut:
    return showcase_out(*await service.save(data))


# --- contact-form messages ----------------------------------------------------------------------


def _messages(session: SessionDep, settings: SettingsDep) -> MessagesService:
    return MessagesService(MessagesRepository(session), settings)


Messages = Annotated[MessagesService, Depends(_messages)]


@router.get("/messages", response_model=MessagesPage)
async def list_messages(
    service: Messages,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> MessagesPage:
    items, total = await service.page(offset, limit)
    return MessagesPage(items=[ContactMessageOut.model_validate(m) for m in items], total=total)


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(message_id: uuid.UUID, service: Messages) -> None:
    await service.delete(message_id)
