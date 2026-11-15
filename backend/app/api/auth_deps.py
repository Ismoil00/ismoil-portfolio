"""The admin guard: a valid session cookie, plus CSRF token and allowed Origin on every write."""

from typing import Annotated

from fastapi import Depends, Request

from app.api.deps import SessionDep, SettingsDep
from app.core.errors import Forbidden
from app.models import AdminSession
from app.repositories.auth import AuthRepository
from app.services.auth import AuthService

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_auth_service(session: SessionDep, settings: SettingsDep) -> AuthService:
    return AuthService(AuthRepository(session), settings)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def check_origin(request: Request, allowed: list[str]) -> None:
    """Browsers send Origin on every write; a foreign one means a cross-site request."""
    origin = request.headers.get("origin")
    if origin is not None and origin not in allowed:
        raise Forbidden("Requests from this origin are not allowed", code="bad_origin")


async def current_admin(request: Request, service: AuthServiceDep, settings: SettingsDep) -> AdminSession:
    session = await service.authenticate(request.cookies.get(settings.session_cookie))
    if request.method not in SAFE_METHODS:
        check_origin(request, settings.admin_origins)
        service.check_csrf(session, request.headers.get("x-csrf-token"))
    return session


AdminDep = Annotated[AdminSession, Depends(current_admin)]
