"""Every admin route: a signed-in session is required, plus CSRF token and allowed Origin on writes."""

from fastapi import APIRouter, Depends

from app.api.admin import analytics, content, media, sections, selectors, settings, translate
from app.api.auth_deps import current_admin

admin_router = APIRouter(prefix="/admin", dependencies=[Depends(current_admin)])
admin_router.include_router(media.router)
admin_router.include_router(selectors.router)
admin_router.include_router(sections.router)
admin_router.include_router(content.router)
admin_router.include_router(translate.router)
admin_router.include_router(settings.router)
admin_router.include_router(analytics.router)
