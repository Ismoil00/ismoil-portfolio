"""Rules for experience, projects, testimonials and certificates."""

import re
import unicodedata
import uuid
from collections.abc import Sequence
from typing import ClassVar

from sqlalchemy import Table

from app.core.errors import Conflict, FieldErrors, NotFound
from app.core.text import month_to_date
from app.models import (
    Certificate,
    Company,
    DevelopmentField,
    Experience,
    Institute,
    Media,
    ProductType,
    Project,
    TechStack,
    Testimonial,
    links,
)
from app.models.enums import ClientKind, MediaPurpose
from app.repositories.content import EXPERIENCE_ORDER, ContentRepository
from app.repositories.links import replace_links
from app.schemas.content import CertificateIn, ExperienceIn, ProjectIn, TestimonialIn
from app.services.media import MediaService
from app.services.selectors import describe_usage

Errors = list[tuple[tuple[str | int, ...], str]]

MAX_PROJECT_IMAGES = 10
MAX_PROJECT_VIDEOS = 2
MAX_CERTIFICATE_IMAGES = 5


def slugify(text: str) -> str:
    """ "Design tokens plugin" → "design-tokens-plugin"."""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")[:80].strip("-") or "project"


class _ContentService[T]:
    label = "item"
    # What can point at this item (it can't be deleted while used).
    references: ClassVar[list] = []

    def __init__(self, repo: ContentRepository[T], media: MediaService) -> None:
        self.repo = repo
        self.media = media

    async def get(self, item_id: uuid.UUID) -> T:
        item = await self.repo.get(item_id)
        if item is None:
            raise NotFound(f"This {self.label} doesn't exist")
        return item

    async def _ref(self, errors: Errors, field: str, model: type, value: uuid.UUID | None) -> None:
        if value is not None and not await self.repo.existing_ids(model, [value]):
            errors.append(((field,), "Not found. Pick it again from the list."))

    async def _refs(self, errors: Errors, field: str, model: type, ids: Sequence[uuid.UUID]) -> None:
        existing = await self.repo.existing_ids(model, ids)
        errors += [
            ((field, i), "Not found. Pick it again from the list.") for i, v in enumerate(ids) if v not in existing
        ]

    async def _links(self, owner_id: uuid.UUID, specs: list[tuple[Table, str, str, Sequence[uuid.UUID]]]) -> None:
        for table, owner_col, target_col, ids in specs:
            await replace_links(self.repo.session, table, owner_col, owner_id, target_col, list(ids))

    @staticmethod
    def _dates(errors: Errors, start: str, end: str | None) -> None:
        if end is not None and month_to_date(end) < month_to_date(start):
            errors.append((("end",), "The end can't be before the start"))

    async def _files_of(self, item: T) -> list[Media]:
        return []

    async def delete(self, item_id: uuid.UUID) -> None:
        item = await self.get(item_id)
        usage = await self.repo.usage(self.references, item.id)
        if usage:
            raise Conflict(describe_usage(usage), code="in_use", usage=usage)
        files = await self._files_of(item)
        await self.repo.delete(item)
        await self.repo.commit()
        if files:
            await self.media.discard(files)


class ExperienceService(_ContentService[Experience]):
    label = "experience entry"

    async def all(self) -> list[Experience]:
        return await self.repo.all(*EXPERIENCE_ORDER)

    async def save(self, data: ExperienceIn, item_id: uuid.UUID | None = None) -> Experience:
        item = await self.get(item_id) if item_id else Experience()
        errors: Errors = []
        if data.is_current and data.end:
            errors.append((("end",), "A present job has no end month. Clear it, or untick “present”."))
        elif not data.is_current and not data.end:
            errors.append((("end",), "Pick the end month, or tick “present”."))
        self._dates(errors, data.start, data.end)
        if data.is_current and (other := await self.repo.present_experience(exclude=item.id)):
            errors.append(
                (("is_current",), f"“{other.title['en']}” is already marked as present. Give it an end month first.")
            )
        await self._ref(errors, "company_id", Company, data.company_id)
        await self._refs(errors, "tech_ids", TechStack, data.tech_ids)
        await self._refs(errors, "field_ids", DevelopmentField, data.field_ids)
        await self._refs(errors, "project_ids", Project, data.project_ids)
        await self._refs(errors, "testimonial_ids", Testimonial, data.testimonial_ids)
        if errors:
            raise FieldErrors(errors)

        item.title = data.title
        item.company_id = data.company_id
        item.start_month = month_to_date(data.start)
        item.end_month = month_to_date(data.end) if data.end else None
        item.is_current = data.is_current
        item.description = data.description
        await self.repo.add(item)
        await self._links(
            item.id,
            [
                (links.experience_techs, "experience_id", "tech_stack_id", data.tech_ids),
                (links.experience_fields, "experience_id", "field_id", data.field_ids),
                (links.experience_projects, "experience_id", "project_id", data.project_ids),
                (links.experience_testimonials, "experience_id", "testimonial_id", data.testimonial_ids),
            ],
        )
        await self.repo.commit()
        await self.repo.refresh(item)
        return item


class ProjectService(_ContentService[Project]):
    label = "project"
    references: ClassVar[list] = [
        ("experiences", links.experience_projects.c.project_id),
        ("testimonials", links.testimonial_projects.c.project_id),
    ]

    async def all(self) -> list[Project]:
        return await self.repo.all(Project.end_month.desc(), Project.start_month.desc(), Project.created_at.desc())

    async def _files_of(self, item: Project) -> list[Media]:
        return list(item.media)

    async def _unique_slug(self, base: str, exclude: uuid.UUID | None) -> str:
        slug, n = base, 2
        while await self.repo.slug_taken(slug, exclude):
            slug, n = f"{base}-{n}", n + 1
        return slug

    async def save(self, data: ProjectIn, item_id: uuid.UUID | None = None) -> Project:
        item = await self.get(item_id) if item_id else Project()
        errors: Errors = []
        self._dates(errors, data.start, data.end)

        if data.client_kind == ClientKind.COMPANY and data.company_id is None:
            errors.append((("company_id",), "Pick the client company"))
        elif data.client_kind != ClientKind.COMPANY and data.company_id is not None:
            errors.append((("company_id",), "A company is only set when the client is a company"))
        await self._ref(errors, "company_id", Company, data.company_id)

        # Private (NDA) ⇔ neither a live nor a source link; private projects show no media.
        has_links = bool(data.live_url or data.repo_url)
        if data.is_private:
            for key in ("live_url", "repo_url"):
                if getattr(data, key):
                    errors.append(((key,), "Private projects have no links. Untick “private” to add them."))
            if data.media_ids:
                errors.append((("media_ids",), "Private projects have no images or videos."))
        elif not has_links:
            errors.append((("is_private",), "Without a live or source link, the project is private: tick “private”."))

        await self._refs(errors, "type_ids", ProductType, data.type_ids)
        await self._refs(errors, "tech_ids", TechStack, data.tech_ids)

        if data.slug and await self.repo.slug_taken(data.slug, item.id):
            errors.append((("slug",), "Another project already uses this address"))
        if errors:
            raise FieldErrors(errors)

        files = await self.media.claim(
            data.media_ids,
            {MediaPurpose.PROJECT_IMAGE, MediaPurpose.PROJECT_VIDEO},
            field="media_ids",
            owner_id=str(item.id) if item.id else None,
        )
        images = [m for m in files if m.purpose == MediaPurpose.PROJECT_IMAGE]
        videos = [m for m in files if m.purpose == MediaPurpose.PROJECT_VIDEO]
        if len(images) > MAX_PROJECT_IMAGES:
            errors.append((("media_ids",), f"At most {MAX_PROJECT_IMAGES} images"))
        if len(videos) > MAX_PROJECT_VIDEOS:
            errors.append((("media_ids",), f"At most {MAX_PROJECT_VIDEOS} videos"))
        if data.cover_id is not None and data.cover_id not in {m.id for m in images}:
            errors.append((("cover_id",), "Pick the cover from the gallery's images"))
        if errors:
            raise FieldErrors(errors)

        old_files = list(item.media) if item_id else []
        item.title = data.title
        item.slug = data.slug or item.slug or await self._unique_slug(slugify(data.title["en"]), item.id)
        item.description = data.description
        item.start_month = month_to_date(data.start)
        item.end_month = month_to_date(data.end)
        item.client_kind = data.client_kind
        item.company_id = data.company_id
        item.traffic = data.traffic
        item.live_url = data.live_url
        item.repo_url = data.repo_url
        item.is_private = data.is_private
        item.cover_id = data.cover_id
        await self.repo.add(item)
        await self._links(
            item.id,
            [
                (links.project_types, "project_id", "product_type_id", data.type_ids),
                (links.project_techs, "project_id", "tech_stack_id", data.tech_ids),
                (links.project_media, "project_id", "media_id", data.media_ids),
            ],
        )
        await self.repo.commit()
        await self.repo.refresh(item)
        removed = [m for m in old_files if m.id not in set(data.media_ids)]
        if removed:
            await self.media.discard(removed)
        return item


class TestimonialService(_ContentService[Testimonial]):
    label = "testimonial"
    references: ClassVar[list] = [("experiences", links.experience_testimonials.c.testimonial_id)]

    async def all(self) -> list[Testimonial]:
        return await self.repo.all(Testimonial.given_on.desc(), Testimonial.created_at.desc())

    async def _files_of(self, item: Testimonial) -> list[Media]:
        return [item.media] if item.media else []

    async def save(self, data: TestimonialIn, item_id: uuid.UUID | None = None) -> Testimonial:
        item = await self.get(item_id) if item_id else Testimonial()
        errors: Errors = []
        await self._ref(errors, "company_id", Company, data.company_id)
        if (data.field_id is None) == (data.tech_stack_id is None):
            message = "Choose only one" if data.field_id else "Choose a development field or a technology"
            errors.append((("field_id",), message))
        await self._ref(errors, "field_id", DevelopmentField, data.field_id)
        await self._ref(errors, "tech_stack_id", TechStack, data.tech_stack_id)
        await self._refs(errors, "project_ids", Project, data.project_ids)
        if errors:
            raise FieldErrors(errors)
        if data.media_id is not None and data.media_id != item.media_id:
            await self.media.claim(
                [data.media_id],
                {MediaPurpose.TESTIMONIAL_IMAGE, MediaPurpose.TESTIMONIAL_VIDEO},
                field="media_id",
                owner_id=str(item.id) if item.id else None,
            )

        old_file = item.media if item_id and item.media_id != data.media_id else None
        for key in (
            "author_name",
            "author_role",
            "company_id",
            "field_id",
            "tech_stack_id",
            "given_on",
            "quote",
            "media_id",
            "verify_url",
        ):
            setattr(item, key, getattr(data, key))
        await self.repo.add(item)
        await self._links(item.id, [(links.testimonial_projects, "testimonial_id", "project_id", data.project_ids)])
        await self.repo.commit()
        await self.repo.refresh(item)
        if old_file is not None:
            await self.media.discard([old_file])
        return item


class CertificateService(_ContentService[Certificate]):
    label = "certificate"

    async def all(self) -> list[Certificate]:
        return await self.repo.all(
            Certificate.end_month.desc(), Certificate.start_month.desc(), Certificate.created_at.desc()
        )

    async def _files_of(self, item: Certificate) -> list[Media]:
        return list(item.images)

    async def save(self, data: CertificateIn, item_id: uuid.UUID | None = None) -> Certificate:
        item = await self.get(item_id) if item_id else Certificate()
        errors: Errors = []
        self._dates(errors, data.start, data.end)
        await self._ref(errors, "institute_id", Institute, data.institute_id)
        await self._refs(errors, "field_ids", DevelopmentField, data.field_ids)
        if len(data.image_ids) > MAX_CERTIFICATE_IMAGES:
            errors.append((("image_ids",), f"At most {MAX_CERTIFICATE_IMAGES} images"))
        if errors:
            raise FieldErrors(errors)
        await self.media.claim(
            data.image_ids,
            {MediaPurpose.CERTIFICATE_IMAGE},
            field="image_ids",
            owner_id=str(item.id) if item.id else None,
        )

        old_files = list(item.images) if item_id else []
        item.title = data.title
        item.institute_id = data.institute_id
        item.start_month = month_to_date(data.start)
        item.end_month = month_to_date(data.end)
        item.verify_url = data.verify_url
        await self.repo.add(item)
        await self._links(
            item.id,
            [
                (links.certificate_fields, "certificate_id", "field_id", data.field_ids),
                (links.certificate_media, "certificate_id", "media_id", data.image_ids),
            ],
        )
        await self.repo.commit()
        await self.repo.refresh(item)
        removed = [m for m in old_files if m.id not in set(data.image_ids)]
        if removed:
            await self.media.discard(removed)
        return item
