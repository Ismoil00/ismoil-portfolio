"""Admin: the Settings page — which translator helps with Russian and Tajik, the public site's AI
assistant switch, and changing the username and the password."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.api.auth_deps import AdminDep, AuthServiceDep
from app.api.deps import IpHashDep, SessionDep
from app.repositories.settings import SettingsRepository
from app.schemas.settings import PanelSettingsIn, PanelSettingsOut, PasswordChangeIn, UsernameChangeIn
from app.services.settings import PanelSettingsService

router = APIRouter(prefix="/settings", tags=["admin: settings"])


def get_settings_service(session: SessionDep, request: Request) -> PanelSettingsService:
    return PanelSettingsService(
        SettingsRepository(session),
        claude_ready=getattr(request.app.state, "translator", None) is not None,
        assistant_ready=getattr(request.app.state, "chat_model", None) is not None,
    )


Service = Annotated[PanelSettingsService, Depends(get_settings_service)]


async def _out(service: PanelSettingsService) -> PanelSettingsOut:
    return PanelSettingsOut(
        translator=await service.translator(),
        claude_ready=service.claude_ready,
        assistant_enabled=await service.assistant_enabled(),
        assistant_ready=service.assistant_ready,
    )


@router.get("", response_model=PanelSettingsOut)
async def read_settings(service: Service) -> PanelSettingsOut:
    return await _out(service)


@router.put("", response_model=PanelSettingsOut)
async def update_settings(data: PanelSettingsIn, service: Service) -> PanelSettingsOut:
    if data.translator is not None:
        await service.set_translator(data.translator)
    if data.assistant_enabled is not None:
        await service.set_assistant(data.assistant_enabled)
    return await _out(service)


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(data: PasswordChangeIn, admin: AdminDep, auth: AuthServiceDep, ip_hash: IpHashDep) -> None:
    await auth.change_password(admin, data.current_password, data.new_password, ip_hash=ip_hash)


@router.put("/username", status_code=status.HTTP_204_NO_CONTENT)
async def change_username(data: UsernameChangeIn, admin: AdminDep, auth: AuthServiceDep, ip_hash: IpHashDep) -> None:
    await auth.change_username(admin, data.current_password, data.new_username, ip_hash=ip_hash)
