"""Public: visit statistics reported by the public site's server (page views, résumé downloads)."""

from fastapi import APIRouter, status

from app.api.deps import IpHashDep, SessionDep, SettingsDep
from app.schemas.analytics import VisitEventIn
from app.services.analytics import AnalyticsService

router = APIRouter(tags=["public"])


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
async def record_event(event: VisitEventIn, session: SessionDep, settings: SettingsDep, ip_hash: IpHashDep) -> None:
    await AnalyticsService(session, max_per_hour=settings.analytics_max_per_hour).record(event, ip_hash=ip_hash)
