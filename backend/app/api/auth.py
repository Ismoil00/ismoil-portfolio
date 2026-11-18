"""Sign in / sign out of the admin panel."""

from fastapi import APIRouter, Request, Response, status

from app.api.auth_deps import AdminDep, AuthServiceDep, check_origin
from app.api.deps import IpHashDep, SettingsDep
from app.core.config import Settings
from app.schemas.auth import LoginIn, LoginOut, MeOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_cookies(response: Response, settings: Settings, session_token: str, csrf_token: str) -> None:
    max_age = settings.session_max_days * 24 * 3600
    common = {"max_age": max_age, "secure": settings.cookie_secure, "samesite": "strict", "path": "/"}
    response.set_cookie(settings.session_cookie, session_token, httponly=True, **common)
    # Readable by the admin panel's JavaScript, which echoes it in the X-CSRF-Token header.
    response.set_cookie(settings.csrf_cookie, csrf_token, httponly=False, **common)


def _clear_cookies(response: Response, settings: Settings) -> None:
    for name, httponly in ((settings.session_cookie, True), (settings.csrf_cookie, False)):
        response.delete_cookie(name, path="/", secure=settings.cookie_secure, httponly=httponly, samesite="strict")


@router.post("/login", response_model=LoginOut)
async def login(
    body: LoginIn,
    request: Request,
    response: Response,
    service: AuthServiceDep,
    settings: SettingsDep,
    ip_hash: IpHashDep,
) -> LoginOut:
    check_origin(request, settings.admin_origins)
    result = await service.login(
        body.username, body.password, ip_hash=ip_hash, user_agent=request.headers.get("user-agent", "")
    )
    _set_cookies(response, settings, result.session_token, result.csrf_token)
    return LoginOut(username=result.user.username, csrf_token=result.csrf_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request, response: Response, admin: AdminDep, service: AuthServiceDep, settings: SettingsDep
) -> Response:
    await service.logout(request.cookies.get(settings.session_cookie))
    response.status_code = status.HTTP_204_NO_CONTENT
    _clear_cookies(response, settings)
    return response


@router.get("/me", response_model=MeOut)
async def me(admin: AdminDep) -> MeOut:
    return MeOut(username=admin.user.username)
