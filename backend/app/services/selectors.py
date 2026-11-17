"""Selectors page rules: unique names, valid references, logos, ordering, and no deleting what's in use."""

import uuid
from dataclasses import dataclass, field

from sqlalchemy import Column, Table

from app.core.errors import Conflict, FieldErrors, NotFound
from app.models import (
    Certificate,
    Company,
    DevelopmentField,
    Experience,
    Institute,
    Instrument,
    LinkPlatform,
    OtherLink,
    ProductType,
    Project,
    TechStack,
    Testimonial,
    links,
)
from app.models.enums import MediaPurpose
from app.repositories.links import replace_links
from app.repositories.selectors import SelectorRepository
from app.schemas.common import InputModel
from app.services.media import MediaService

USAGE_LABELS = {
    "tech_stacks": ("technology", "technologies"),
    "experiences": ("experience", "experiences"),
    "projects": ("project", "projects"),
    "testimonials": ("testimonial", "testimonials"),
    "certificates": ("certificate", "certificates"),
    "other_links": ("other link", "other links"),
    "tech_section": ("Tech stack section", "Tech stack section"),
}


def describe_usage(usage: dict[str, int]) -> str:
    parts = [
        f"the {USAGE_LABELS[k][0]}" if k == "tech_section" else f"{n} {USAGE_LABELS[k][0 if n == 1 else 1]}"
        for k, n in usage.items()
    ]
    return f"It's still used by {', '.join(parts)}. Remove it there first."


@dataclass(frozen=True)
class LinkSpec:
    """A many-to-many list on the item, e.g. a tech stack's development fields."""

    body_field: str  # "field_ids"
    table: Table
    owner_col: str
    target_col: str
    target_model: type


@dataclass(frozen=True)
class SelectorSpec:
    model: type
    label: str  # for messages
    i18n_name: bool
    references: list[tuple[str, Column]] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)  # boolean columns that also count as "in use"
    links: list[LinkSpec] = field(default_factory=list)
    has_logo: bool = False


SPECS: dict[str, SelectorSpec] = {
    "development-fields": SelectorSpec(
        DevelopmentField,
        "development field",
        i18n_name=True,
        references=[
            ("tech_stacks", links.tech_stack_fields.c.field_id),
            ("experiences", links.experience_fields.c.field_id),
            ("certificates", links.certificate_fields.c.field_id),
            ("testimonials", Testimonial.field_id),  # "my role" on a testimonial
        ],
        flags=["filter_active"],
    ),
    "instruments": SelectorSpec(
        Instrument,
        "instrument",
        i18n_name=True,
        references=[("tech_stacks", links.tech_stack_instruments.c.instrument_id)],
        flags=["filter_active"],
    ),
    "tech-stacks": SelectorSpec(
        TechStack,
        "technology",
        i18n_name=False,
        references=[
            ("experiences", links.experience_techs.c.tech_stack_id),
            ("projects", links.project_techs.c.tech_stack_id),
            ("testimonials", Testimonial.tech_stack_id),  # "my role" on a testimonial
        ],
        flags=["showcase_active"],
        links=[
            LinkSpec("field_ids", links.tech_stack_fields, "tech_stack_id", "field_id", DevelopmentField),
            LinkSpec("instrument_ids", links.tech_stack_instruments, "tech_stack_id", "instrument_id", Instrument),
        ],
    ),
    "companies": SelectorSpec(
        Company,
        "company",
        i18n_name=False,
        references=[
            ("experiences", Experience.company_id),
            ("projects", Project.company_id),
            ("testimonials", Testimonial.company_id),
        ],
        has_logo=True,
    ),
    "institutes": SelectorSpec(
        Institute,
        "institute",
        i18n_name=True,
        references=[("certificates", Certificate.institute_id)],
        has_logo=True,
    ),
    "product-types": SelectorSpec(
        ProductType, "product type", i18n_name=True, references=[("projects", links.project_types.c.product_type_id)]
    ),
    "link-platforms": SelectorSpec(
        LinkPlatform, "link platform", i18n_name=False, references=[("other_links", OtherLink.platform_id)]
    ),
}


class SelectorService:
    def __init__(self, repo: SelectorRepository, spec: SelectorSpec, media: MediaService) -> None:
        self.repo = repo
        self.spec = spec
        self.media = media

    async def all_items(self) -> list[tuple[object, dict[str, int]]]:
        items = await self.repo.all()
        usage = await self.repo.usage(self.spec.references, self.spec.flags)
        return [(item, usage.get(item.id, {})) for item in items]

    async def usage_of(self, item_id: uuid.UUID) -> dict[str, int]:
        return (await self.repo.usage(self.spec.references, self.spec.flags, [item_id])).get(item_id, {})

    async def _get(self, item_id: uuid.UUID):
        item = await self.repo.get(item_id)
        if item is None:
            raise NotFound(f"This {self.spec.label} doesn't exist")
        return item

    async def _validate(self, data: InputModel, exclude: uuid.UUID | None) -> None:
        errors: list[tuple[tuple[str | int, ...], str]] = []
        name = data.name["en"] if self.spec.i18n_name else data.name
        if await self.repo.name_taken(name, i18n=self.spec.i18n_name, exclude=exclude):
            loc = ("name", "en") if self.spec.i18n_name else ("name",)
            errors.append((loc, f"A {self.spec.label} with this name already exists"))
        for link in self.spec.links:
            ids = getattr(data, link.body_field)
            existing = await self.repo.existing_ids(link.target_model, ids)
            errors += [((link.body_field, i), "Not found") for i, value in enumerate(ids) if value not in existing]
        if errors:
            raise FieldErrors(errors)

    def _values(self, data: InputModel) -> dict:
        exclude = {link.body_field for link in self.spec.links} | {"logo_id"}
        return data.model_dump(exclude=exclude)

    async def _save_links(self, item, data: InputModel) -> None:
        for link in self.spec.links:
            await replace_links(
                self.repo.session, link.table, link.owner_col, item.id, link.target_col, getattr(data, link.body_field)
            )

    async def create(self, data: InputModel):
        await self._validate(data, exclude=None)
        item = self.spec.model(**self._values(data), position=await self.repo.next_position())
        if self.spec.has_logo and data.logo_id:
            [logo] = await self.media.claim([data.logo_id], {MediaPurpose.LOGO}, field="logo_id")
            item.logo_id = logo.id
        await self.repo.add(item)
        await self._save_links(item, data)
        await self.repo.commit()
        await self.repo.refresh(item)
        return item

    async def update(self, item_id: uuid.UUID, data: InputModel):
        item = await self._get(item_id)
        await self._validate(data, exclude=item.id)
        for key, value in self._values(data).items():
            setattr(item, key, value)
        old_logo = None
        if self.spec.has_logo and item.logo_id != data.logo_id:
            old_logo = item.logo
            if data.logo_id:
                await self.media.claim([data.logo_id], {MediaPurpose.LOGO}, field="logo_id", owner_id=str(item.id))
            item.logo_id = data.logo_id
        await self._save_links(item, data)
        await self.repo.commit()
        await self.repo.refresh(item)
        if old_logo is not None:
            await self.media.discard([old_logo])
        return item

    async def delete(self, item_id: uuid.UUID) -> None:
        item = await self._get(item_id)
        usage = await self.usage_of(item.id)
        if usage:
            raise Conflict(describe_usage(usage), code="in_use", usage=usage)
        logo = item.logo if self.spec.has_logo else None
        await self.repo.delete(item)
        await self.repo.commit()
        if logo is not None:
            await self.media.discard([logo])

    async def reorder(self, ids: list[uuid.UUID]) -> None:
        if set(ids) != set(await self.repo.all_ids()):
            raise FieldErrors.single(("ids",), "List every item exactly once")
        await self.repo.set_positions(ids)
        await self.repo.commit()
