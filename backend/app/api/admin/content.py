"""Admin: experience, projects, testimonials and certificates — list, read, create, update, delete."""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import MediaServiceDep, SessionDep, media_out
from app.core.roles import role_label
from app.core.text import date_to_month
from app.models import Certificate, Company, Experience, Institute, Project, Testimonial
from app.repositories.content import ContentRepository
from app.schemas.content import (
    CertificateIn,
    CertificateOut,
    CompanyRef,
    ExperienceIn,
    ExperienceOut,
    InstituteRef,
    NamedRef,
    ProjectIn,
    ProjectOut,
    TechRef,
    TestimonialIn,
    TestimonialOut,
)
from app.services.content import CertificateService, ExperienceService, ProjectService, TestimonialService
from app.services.media import MediaService

router = APIRouter(tags=["admin: content"])


def company_ref(company: Company, media: MediaService) -> CompanyRef:
    return CompanyRef(
        id=company.id, name=company.name, website_url=company.website_url, logo_url=media.url(company.logo)
    )


def institute_ref(institute: Institute, media: MediaService) -> InstituteRef:
    return InstituteRef(
        id=institute.id, name=institute.name, website_url=institute.website_url, logo_url=media.url(institute.logo)
    )


def experience_out(item: Experience, media: MediaService) -> ExperienceOut:
    return ExperienceOut(
        id=item.id,
        title=item.title,
        company=company_ref(item.company, media),
        start=date_to_month(item.start_month),
        end=date_to_month(item.end_month) if item.end_month else None,
        is_current=item.is_current,
        description=item.description,
        tech_ids=[t.id for t in item.techs],
        field_ids=[f.id for f in item.fields],
        project_ids=[p.id for p in item.projects],
        testimonial_ids=[t.id for t in item.testimonials],
        updated_at=item.updated_at,
    )


def project_out(item: Project, media: MediaService) -> ProjectOut:
    return ProjectOut(
        id=item.id,
        slug=item.slug,
        title=item.title,
        description=item.description,
        start=date_to_month(item.start_month),
        end=date_to_month(item.end_month),
        client_kind=item.client_kind,
        company=company_ref(item.company, media) if item.company else None,
        traffic=item.traffic,
        live_url=item.live_url,
        repo_url=item.repo_url,
        is_private=item.is_private,
        type_ids=[t.id for t in item.types],
        tech_ids=[t.id for t in item.techs],
        media=[media_out(m, media) for m in item.media],
        cover_id=item.cover_id,
        updated_at=item.updated_at,
    )


def testimonial_out(item: Testimonial, media: MediaService) -> TestimonialOut:
    return TestimonialOut(
        id=item.id,
        author_name=item.author_name,
        author_role=item.author_role,
        company=company_ref(item.company, media),
        field=NamedRef(id=item.field.id, name=item.field.name) if item.field else None,
        tech_stack=TechRef(id=item.tech_stack.id, name=item.tech_stack.name) if item.tech_stack else None,
        role=role_label((item.field or item.tech_stack).name),
        given_on=item.given_on,
        quote=item.quote,
        media=media_out(item.media, media) if item.media else None,
        verify_url=item.verify_url,
        project_ids=[p.id for p in item.projects],
        updated_at=item.updated_at,
    )


def certificate_out(item: Certificate, media: MediaService) -> CertificateOut:
    return CertificateOut(
        id=item.id,
        title=item.title,
        institute=institute_ref(item.institute, media),
        start=date_to_month(item.start_month),
        end=date_to_month(item.end_month),
        verify_url=item.verify_url,
        field_ids=[f.id for f in item.fields],
        images=[media_out(m, media) for m in item.images],
        updated_at=item.updated_at,
    )


def _register(
    path: str,
    model: type,
    service_cls: type,
    body: type,
    out: type,
    build: Callable,
) -> None:
    def service_dep(session: SessionDep, media: MediaServiceDep):
        return service_cls(ContentRepository(session, model), media)

    Service = Annotated[service_cls, Depends(service_dep)]

    @router.get(f"/{path}", response_model=list[out], name=f"list {path}")
    async def list_items(service: Service, media: MediaServiceDep):
        return [build(item, media) for item in await service.all()]

    @router.get(f"/{path}/{{item_id}}", response_model=out, name=f"get {path}")
    async def get_item(item_id: uuid.UUID, service: Service, media: MediaServiceDep):
        return build(await service.get(item_id), media)

    @router.post(f"/{path}", response_model=out, status_code=status.HTTP_201_CREATED, name=f"create {path}")
    async def create_item(data: body, service: Service, media: MediaServiceDep):  # type: ignore[valid-type]
        return build(await service.save(data), media)

    @router.put(f"/{path}/{{item_id}}", response_model=out, name=f"update {path}")
    async def update_item(item_id: uuid.UUID, data: body, service: Service, media: MediaServiceDep):  # type: ignore[valid-type]
        return build(await service.save(data, item_id), media)

    @router.delete(f"/{path}/{{item_id}}", status_code=status.HTTP_204_NO_CONTENT, name=f"delete {path}")
    async def delete_item(item_id: uuid.UUID, service: Service) -> None:
        await service.delete(item_id)


_register("experiences", Experience, ExperienceService, ExperienceIn, ExperienceOut, experience_out)
_register("projects", Project, ProjectService, ProjectIn, ProjectOut, project_out)
_register("testimonials", Testimonial, TestimonialService, TestimonialIn, TestimonialOut, testimonial_out)
_register("certificates", Certificate, CertificateService, CertificateIn, CertificateOut, certificate_out)
