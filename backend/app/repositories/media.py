"""Database access for uploaded-file records, and where each file is used."""

import uuid
from datetime import datetime

from sqlalchemy import select, union_all

from app.models import Company, Hero, Institute, Media, Project, Testimonial, links
from app.repositories.base import Repository

# (what uses it, owner id column, file column) — every column that can point at a file.
REFERENCES = [
    ("hero", Hero.id, Hero.resume_id),
    ("company", Company.id, Company.logo_id),
    ("institute", Institute.id, Institute.logo_id),
    ("testimonial", Testimonial.id, Testimonial.media_id),
    ("project", links.project_media.c.project_id, links.project_media.c.media_id),
    ("project", Project.id, Project.cover_id),
    ("certificate", links.certificate_media.c.certificate_id, links.certificate_media.c.media_id),
]


class MediaRepository(Repository):
    async def add(self, media: Media) -> None:
        self.session.add(media)
        await self.session.flush()

    async def get(self, media_id: uuid.UUID) -> Media | None:
        return await self.session.get(Media, media_id)

    async def get_many(self, ids: list[uuid.UUID]) -> list[Media]:
        if not ids:
            return []
        return list(await self.session.scalars(select(Media).where(Media.id.in_(ids))))

    async def get_by_key(self, key: str) -> Media | None:
        return await self.session.scalar(select(Media).where(Media.storage_key == key))

    async def delete(self, media: Media) -> None:
        await self.session.delete(media)
        await self.session.flush()

    async def usage(self, media_id: uuid.UUID) -> list[tuple[str, str]]:
        """(kind, owner id) of everything using this file; a poster counts as used by its video."""
        found: list[tuple[str, str]] = []
        for label, owner, column in REFERENCES:
            rows = await self.session.scalars(select(owner).where(column == media_id))
            found += [(label, str(owner_id)) for owner_id in rows]
        video = await self.session.scalar(select(Media.id).where(Media.poster_id == media_id))
        if video is not None:
            found.append(("video", str(video)))
        return found

    async def unlinked_before(self, cutoff: datetime) -> list[Media]:
        """Uploads older than `cutoff` that nothing uses (a used video's poster counts as used)."""
        used = union_all(
            *(select(column.label("media_id")).where(column.is_not(None)) for _, _, column in REFERENCES)
        ).subquery()
        used_ids = select(used.c.media_id)
        used_posters = select(Media.poster_id).where(Media.id.in_(used_ids), Media.poster_id.is_not(None))
        query = select(Media).where(Media.created_at < cutoff, Media.id.not_in(used_ids), Media.id.not_in(used_posters))
        return list(await self.session.scalars(query))
