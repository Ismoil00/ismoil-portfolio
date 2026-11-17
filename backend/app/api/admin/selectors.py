"""Admin: the Selectors page — the same five routes for every kind of reusable list."""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import MediaServiceDep, SessionDep, media_out
from app.models import Company, Institute, TechStack
from app.repositories.selectors import SelectorRepository
from app.schemas import selectors as s
from app.schemas.common import InputModel, OutputModel
from app.services.media import MediaService
from app.services.selectors import SPECS, SelectorService

router = APIRouter(prefix="/selectors", tags=["admin: selectors"])


def _out_builder(kind: str, out: type[OutputModel]) -> Callable:
    def build(item: object, usage: dict[str, int], media: MediaService) -> OutputModel:
        data = {
            column: getattr(item, column)
            for column in out.model_fields
            if column not in {"usage", "logo", "field_ids", "instrument_ids"}
        }
        if isinstance(item, Company | Institute):
            data["logo"] = media_out(item.logo, media) if item.logo else None
        if isinstance(item, TechStack):
            data["field_ids"] = [f.id for f in item.fields]
            data["instrument_ids"] = [i.id for i in item.instruments]
        return out(**data, usage=usage)

    return build


def _register(kind: str, body: type[InputModel], out: type[OutputModel]) -> None:
    spec = SPECS[kind]
    build = _out_builder(kind, out)

    def service_dep(session: SessionDep, media: MediaServiceDep) -> SelectorService:
        return SelectorService(SelectorRepository(session, spec.model), spec, media)

    Service = Annotated[SelectorService, Depends(service_dep)]
    tag = spec.label

    @router.get(f"/{kind}", response_model=list[out], name=f"list {tag}")
    async def list_items(service: Service, media: MediaServiceDep) -> list[OutputModel]:
        return [build(item, usage, media) for item, usage in await service.all_items()]

    @router.post(f"/{kind}", response_model=out, status_code=status.HTTP_201_CREATED, name=f"create {tag}")
    async def create_item(data: body, service: Service, media: MediaServiceDep) -> OutputModel:  # type: ignore[valid-type]
        item = await service.create(data)
        return build(item, {}, media)

    @router.put(f"/{kind}/order", status_code=status.HTTP_204_NO_CONTENT, name=f"reorder {tag}")
    async def reorder_items(data: s.OrderIn, service: Service) -> None:
        await service.reorder(data.ids)

    @router.put(f"/{kind}/{{item_id}}", response_model=out, name=f"update {tag}")
    async def update_item(item_id: uuid.UUID, data: body, service: Service, media: MediaServiceDep) -> OutputModel:  # type: ignore[valid-type]
        item = await service.update(item_id, data)
        return build(item, await service.usage_of(item.id), media)

    @router.delete(f"/{kind}/{{item_id}}", status_code=status.HTTP_204_NO_CONTENT, name=f"delete {tag}")
    async def delete_item(item_id: uuid.UUID, service: Service) -> None:
        await service.delete(item_id)


_register("development-fields", s.DevelopmentFieldIn, s.DevelopmentFieldOut)
_register("instruments", s.InstrumentIn, s.InstrumentOut)
_register("tech-stacks", s.TechStackIn, s.TechStackOut)
_register("companies", s.CompanyIn, s.CompanyOut)
_register("institutes", s.InstituteIn, s.InstituteOut)
_register("product-types", s.ProductTypeIn, s.ProductTypeOut)
_register("link-platforms", s.LinkPlatformIn, s.LinkPlatformOut)
