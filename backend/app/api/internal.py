"""Routes for the hosting platform, not for people: the daily cleanup that Vercel Cron calls.

Vercel sends `Authorization: Bearer <CRON_SECRET>` (the project's CRON_SECRET environment variable).
Without a CRON_SECRET the route doesn't exist (404); with a wrong or missing header it answers 401.
"""

import hmac

from fastapi import APIRouter, Request

from app.api.deps import SessionDep, SettingsDep, StorageDep
from app.core.errors import NotFound, Unauthorized
from app.services import maintenance

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)


@router.get("/cleanup")
async def daily_cleanup(request: Request, settings: SettingsDep, session: SessionDep, storage: StorageDep) -> dict:
    if settings.cron_secret is None:
        raise NotFound("Not found")
    expected = f"Bearer {settings.cron_secret.get_secret_value()}"
    if not hmac.compare_digest(request.headers.get("authorization", "").encode(), expected.encode()):
        raise Unauthorized("Wrong or missing cron secret")
    return {"removed_uploads": await maintenance.cleanup(session, storage)}
