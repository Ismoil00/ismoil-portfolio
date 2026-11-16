"""Admin: the Settings page — which translator helps with Russian and Tajik, and changing the password."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.api.auth_deps import AdminDep, AuthServiceDep
from app.api.deps import IpHashDep, SessionDep
from app.repositories.settings import SettingsRepository
from app.schemas.settings import PanelSettingsIn, PanelSettingsOut, PasswordChangeIn
from app.services.settings import PanelSettingsService

router = APIRouter(prefix="/settings", tags=["admin: settings"])


def get_settings_service(session: SessionDep, request: Request) -> PanelSettingsService:
    claude_ready = getattr(request.app.state, "translator", None) is not None
    return PanelSettingsService(SettingsRepository(session), claude_ready=claude_ready)


Service = Annotated[PanelSettingsService, Depends(get_settings_service)]


@router.get("", response_model=PanelSettingsOut)
async def read_settings(service: Service) -> PanelSettingsOut:
    return PanelSettingsOut(translator=await service.translator(), claude_ready=service.claude_ready)


@router.put("", response_model=PanelSettingsOut)
async def update_settings(data: PanelSettingsIn, service: Service) -> PanelSettingsOut:
    translator = await service.set_translator(data.translator)
    return PanelSettingsOut(translator=translator, claude_ready=service.claude_ready)


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(data: PasswordChangeIn, admin: AdminDep, auth: AuthServiceDep, ip_hash: IpHashDep) -> None:
    await auth.change_password(admin, data.current_password, data.new_password, ip_hash=ip_hash)
