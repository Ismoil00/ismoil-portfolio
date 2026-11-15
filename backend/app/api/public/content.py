"""Public: read-only content for the public site (no session needed)."""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from app.api.deps import SessionDep, StorageDep
from app.core.text import month_to_date
from app.repositories.public import ListQuery, PublicRepository
from app.schemas import public as s
from app.schemas.fields import Month
from app.services.public import PublicService

router = APIRouter(tags=["public"])

Lang = Annotated[Literal["en", "ru", "tg"], Query()]


def get_service(session: SessionDep, storage: StorageDep) -> PublicService:
    return PublicService(PublicRepository(session), storage)


Service = Annotated[PublicService, Depends(get_service)]


def list_query(
    offset: Annotated[int, Query(ge=0, le=10_000)] = 0,
    limit: Annotated[int, Query(ge=1, le=30)] = 10,
    start: Annotated[Month | None, Query(alias="from")] = None,
    end: Annotated[Month | None, Query(alias="to")] = None,
    company: Annotated[list[str], Query(max_length=50)] = [],  # noqa: B006 — FastAPI copies defaults
    client: Annotated[list[str], Query(max_length=50)] = [],  # noqa: B006
    stack: Annotated[list[uuid.UUID], Query(max_length=50)] = [],  # noqa: B006
    field: Annotated[list[uuid.UUID], Query(max_length=50)] = [],  # noqa: B006
    type: Annotated[list[uuid.UUID], Query(max_length=50)] = [],  # noqa: B006
) -> ListQuery:
    return ListQuery(
        offset=offset,
        limit=limit,
        start=month_to_date(start) if start else None,
        end=month_to_date(end) if end else None,
        companies=[c[:100] for c in company],
        clients=[c[:100] for c in client],
        stack=stack,
        fields=field,
        types=type,
    )


Paging = Annotated[ListQuery, Depends(list_query)]


@router.get("/profile", response_model=s.Profile)
async def profile(service: Service, lang: Lang = "en") -> s.Profile:
    return await service.profile(lang)


@router.get("/skills", response_model=s.Skills)
async def skills(service: Service, lang: Lang = "en") -> s.Skills:
    return await service.skills(lang)


@router.get("/experience", response_model=s.ExperiencePage)
async def experience(service: Service, q: Paging, lang: Lang = "en") -> s.ExperiencePage:
    return await service.experience_page(lang, q)


@router.get("/experience/filters", response_model=s.ExperienceFilters)
async def experience_filters(service: Service, lang: Lang = "en") -> s.ExperienceFilters:
    return await service.experience_filters(lang)


@router.get("/experience/summary", response_model=s.ExperienceSummary)
async def experience_summary(service: Service) -> s.ExperienceSummary:
    return await service.experience_summary()


@router.get("/projects", response_model=s.ProjectsPage)
async def projects(service: Service, q: Paging, lang: Lang = "en") -> s.ProjectsPage:
    return await service.projects_page(lang, q)


@router.get("/projects/filters", response_model=s.ProjectFilters)
async def project_filters(service: Service, lang: Lang = "en") -> s.ProjectFilters:
    return await service.project_filters(lang)


@router.get("/projects/slugs", response_model=list[str])
async def project_slugs(service: Service) -> list[str]:
    return await service.project_slugs()


@router.get("/projects/{slug}", response_model=s.ProjectDetail)
async def project(slug: str, service: Service, lang: Lang = "en") -> s.ProjectDetail:
    return await service.project(lang, slug[:120])


@router.get("/certificates", response_model=s.CertificatesPage)
async def certificates(service: Service, q: Paging, lang: Lang = "en") -> s.CertificatesPage:
    return await service.certificates_page(lang, q)


@router.get("/certificates/filters", response_model=s.CertificateFilters)
async def certificate_filters(service: Service, lang: Lang = "en") -> s.CertificateFilters:
    return await service.certificate_filters(lang)


@router.get("/testimonials", response_model=s.TestimonialsPage)
async def testimonials(service: Service, q: Paging, lang: Lang = "en") -> s.TestimonialsPage:
    return await service.testimonials_page(lang, q)


@router.get("/testimonials/filters", response_model=s.DateBounds)
async def testimonial_filters(service: Service) -> s.DateBounds:
    return await service.testimonial_filters()
