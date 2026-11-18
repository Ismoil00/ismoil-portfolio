"""Loads backend/seed/content.json (the site's real content, exported once from the old static data)
into an empty database. Seeded rows go through the same cleaning as admin input (SVGs, rich text).
`add_missing_selectors` brings later additions to the seed's selector lists into a filled database."""

import io
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.contacts import clean_phone, normalize_linkedin
from app.core.svg import sanitize_svg
from app.core.text import month_to_date, sanitize_rich_html
from app.models import (
    About,
    Certificate,
    Company,
    Contacts,
    DevelopmentField,
    Experience,
    Hero,
    Institute,
    Instrument,
    LinkPlatform,
    OtherLink,
    ProductType,
    Project,
    TechStack,
    links,
)
from app.models.enums import MediaPurpose
from app.repositories.links import replace_links
from app.services.media import IncomingFile, MediaService


class SeedError(Exception):
    pass


def _svg(value: str | None) -> str | None:
    return sanitize_svg(value) if value else None


async def load_seed(session: AsyncSession, media: MediaService, data: dict[str, Any], *, repo_root: Path) -> None:
    for model in (Hero, TechStack, Experience, Project):
        if await session.scalar(select(func.count()).select_from(model)):
            raise SeedError("The database already has content. Seeding only fills an empty database.")

    # The résumé first: uploading commits on its own, so it must not split the rest in two.
    resume_path = repo_root / data["resume_file"]
    content = resume_path.read_bytes()
    resume = await media.upload(
        MediaPurpose.RESUME, IncomingFile(data=io.BytesIO(content), size=len(content), filename=resume_path.name)
    )

    keys: dict[str, dict[str, uuid.UUID]] = {}

    def add_all(kind: str, rows: list) -> None:
        keys[kind] = {}
        for position, (key, row) in enumerate(rows):
            row.id = uuid.uuid4()
            if hasattr(row, "position"):
                row.position = position
            session.add(row)
            keys[kind][key] = row.id

    # Selectors
    add_all(
        "fields",
        [
            (f["key"], DevelopmentField(name=f["name"], icon_svg=_svg(f["icon_svg"])))
            for f in data["development_fields"]
        ],
    )
    add_all(
        "instruments",
        [(i["key"], Instrument(name=i["name"], icon_svg=_svg(i["icon_svg"]))) for i in data["instruments"]],
    )
    add_all(
        "techs",
        [
            (
                t["key"],
                TechStack(
                    name=t["name"],
                    icon_svg=sanitize_svg(t["icon_svg"]),
                    color=t["color"].upper(),
                    docs_url=t["docs_url"],
                ),
            )
            for t in data["tech_stacks"]
        ],
    )
    add_all(
        "types",
        [(t["key"], ProductType(name=t["name"], icon_svg=sanitize_svg(t["icon_svg"]))) for t in data["product_types"]],
    )
    add_all(
        "platforms",
        [
            (p["key"], LinkPlatform(name=p["name"], icon_svg=_svg(p["icon_svg"]), color=p["color"]))
            for p in data["link_platforms"]
        ],
    )
    add_all("companies", [(c["key"], Company(name=c["name"])) for c in data["companies"]])
    add_all("institutes", [(i["key"], Institute(name=i["name"])) for i in data["institutes"]])
    await session.flush()

    for tech in data["tech_stacks"]:
        tech_id = keys["techs"][tech["key"]]
        await replace_links(
            session,
            links.tech_stack_fields,
            "tech_stack_id",
            tech_id,
            "field_id",
            [keys["fields"][f] for f in tech["fields"]],
        )
        await replace_links(
            session,
            links.tech_stack_instruments,
            "tech_stack_id",
            tech_id,
            "instrument_id",
            [keys["instruments"][i] for i in tech["instruments"]],
        )

    # Tech stack section: which technologies and filters are shown, in order.
    shown = [t for t in data["tech_stacks"] if t["showcase"]]
    for position, tech in enumerate(shown):
        row = await session.get(TechStack, keys["techs"][tech["key"]])
        row.showcase_active, row.showcase_position = True, position
    for position, (kind, key) in enumerate(data["filters"]):
        model = DevelopmentField if kind == "field" else Instrument
        row = await session.get(model, keys["fields" if kind == "field" else "instruments"][key])
        row.filter_active, row.filter_position = True, position

    # Sections
    hero = data["hero"]
    session.add(
        Hero(
            id=1,
            **{k: hero[k] for k in ("first_name", "last_name", "role", "description", "availability")},
            resume_id=resume.id,
        )
    )
    session.add(About(id=1, **data["about"]))
    c = data["contacts"]
    session.add(
        Contacts(
            id=1,
            email=c["email"],
            telegram=clean_phone(c["telegram"]) if c["telegram"].startswith("+") else c["telegram"],
            whatsapp=clean_phone(c["whatsapp"]),
            linkedin=normalize_linkedin(c["linkedin"]),
        )
    )
    for position, link in enumerate(data["other_links"]):
        session.add(OtherLink(platform_id=keys["platforms"][link["platform"]], url=link["url"], position=position))

    # Projects first: experience links to them.
    keys["projects"] = {}
    for p in data["projects"]:
        project = Project(
            slug=p["slug"],
            title=p["title"],
            description={lang: sanitize_rich_html(text) for lang, text in p["description"].items()},
            start_month=month_to_date(p["start"]),
            end_month=month_to_date(p["end"]),
            client_kind=p["client_kind"],
            company_id=keys["companies"][p["company"]] if p["company"] else None,
            traffic=p["traffic"],
            live_url=p["live_url"],
            repo_url=p["repo_url"],
            is_private=not (p["live_url"] or p["repo_url"]),
        )
        session.add(project)
        await session.flush()
        keys["projects"][p["key"]] = project.id
        await replace_links(
            session,
            links.project_types,
            "project_id",
            project.id,
            "product_type_id",
            [keys["types"][t] for t in p["types"]],
        )
        await replace_links(
            session,
            links.project_techs,
            "project_id",
            project.id,
            "tech_stack_id",
            [keys["techs"][t] for t in p["techs"]],
        )

    for e in data["experiences"]:
        experience = Experience(
            title=e["title"],
            company_id=keys["companies"][e["company"]],
            start_month=month_to_date(e["start"]),
            end_month=month_to_date(e["end"]) if e["end"] else None,
            is_current=e["end"] is None,
            description={lang: sanitize_rich_html(html) for lang, html in e["description"].items()},
        )
        session.add(experience)
        await session.flush()
        await replace_links(
            session,
            links.experience_techs,
            "experience_id",
            experience.id,
            "tech_stack_id",
            [keys["techs"][t] for t in e["techs"]],
        )
        await replace_links(
            session,
            links.experience_fields,
            "experience_id",
            experience.id,
            "field_id",
            [keys["fields"][f] for f in e["fields"]],
        )
        await replace_links(
            session,
            links.experience_projects,
            "experience_id",
            experience.id,
            "project_id",
            [keys["projects"][p] for p in e["projects"]],
        )

    for c in data["certificates"]:
        certificate = Certificate(
            title=c["title"],
            institute_id=keys["institutes"][c["institute"]],
            start_month=month_to_date(c["start"]),
            end_month=month_to_date(c["end"]),
            verify_url=c["verify_url"],
        )
        session.add(certificate)
        await session.flush()
        await replace_links(
            session,
            links.certificate_fields,
            "certificate_id",
            certificate.id,
            "field_id",
            [keys["fields"][f] for f in c["fields"]],
        )

    await session.commit()


@dataclass
class AddedSelectors:
    fields: list[str] = field(default_factory=list)
    techs: list[str] = field(default_factory=list)


def _key(name: str) -> str:
    # The same rule as the Selectors page: names are unique in any letter case.
    return name.strip().lower()


async def add_missing_selectors(session: AsyncSession, data: dict[str, Any]) -> AddedSelectors:
    """Adds the seed's development fields and technologies that have no item of the same (English)
    name yet. What is in the database is never changed or deleted; new items go after it, and new
    technologies aren't shown on the Tech stack page until they are picked there."""
    fields = list(await session.scalars(select(DevelopmentField)))
    techs = list(await session.scalars(select(TechStack)))
    instruments = list(await session.scalars(select(Instrument)))
    field_ids = {_key(f.name["en"]): f.id for f in fields}
    instrument_ids = {_key(i.name["en"]): i.id for i in instruments}
    tech_names = {_key(t.name) for t in techs}
    added = AddedSelectors()

    position = max((f.position for f in fields), default=-1) + 1
    for item in data["development_fields"]:
        if _key(item["name"]["en"]) in field_ids:
            continue
        row = DevelopmentField(id=uuid.uuid4(), name=item["name"], icon_svg=_svg(item["icon_svg"]), position=position)
        session.add(row)
        field_ids[_key(item["name"]["en"])] = row.id
        added.fields.append(item["name"]["en"])
        position += 1
    await session.flush()

    # A technology links to fields and instruments by seed key; the database knows them by name.
    seed_fields = {f["key"]: _key(f["name"]["en"]) for f in data["development_fields"]}
    seed_instruments = {i["key"]: _key(i["name"]["en"]) for i in data["instruments"]}

    def ids(keys: list[str], names: dict[str, str], known: dict[str, uuid.UUID]) -> list[uuid.UUID]:
        return [known[names[k]] for k in keys if k in names and names[k] in known]  # missing ones are skipped

    position = max((t.position for t in techs), default=-1) + 1
    for item in data["tech_stacks"]:
        if _key(item["name"]) in tech_names:
            continue
        row = TechStack(
            id=uuid.uuid4(),
            name=item["name"],
            icon_svg=sanitize_svg(item["icon_svg"]),
            color=item["color"].upper(),
            docs_url=item["docs_url"],
            position=position,
        )
        session.add(row)
        await session.flush()
        field_links = ids(item["fields"], seed_fields, field_ids)
        instrument_links = ids(item["instruments"], seed_instruments, instrument_ids)
        await replace_links(session, links.tech_stack_fields, "tech_stack_id", row.id, "field_id", field_links)
        await replace_links(
            session, links.tech_stack_instruments, "tech_stack_id", row.id, "instrument_id", instrument_links
        )
        tech_names.add(_key(item["name"]))
        added.techs.append(item["name"])
        position += 1

    await session.commit()
    return added
