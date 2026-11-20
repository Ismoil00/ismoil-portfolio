"""Admin: the site's visit statistics for the Analytics page."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import SessionDep, SettingsDep
from app.schemas.analytics import AnalyticsOut
from app.services.analytics import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["admin: analytics"])


@router.get("", response_model=AnalyticsOut)
async def read_analytics(
    session: SessionDep, settings: SettingsDep, days: Annotated[int, Query(ge=1, le=365)] = 30
) -> AnalyticsOut:
    return await AnalyticsService(session, max_per_hour=settings.analytics_max_per_hour).report(days)
