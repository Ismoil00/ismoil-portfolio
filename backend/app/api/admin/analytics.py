"""Admin: the site's visit statistics for the Analytics page, and the AI assistant's use of Groq's free
quota."""

from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.api.deps import SessionDep, SettingsDep
from app.repositories.chat import ChatRepository
from app.repositories.settings import SettingsRepository
from app.schemas.analytics import AnalyticsOut
from app.services.analytics import AnalyticsService
from app.services.chat import usage_report
from app.services.settings import PanelSettingsService

router = APIRouter(prefix="/analytics", tags=["admin: analytics"])


@router.get("", response_model=AnalyticsOut)
async def read_analytics(
    session: SessionDep, settings: SettingsDep, request: Request, days: Annotated[int, Query(ge=1, le=365)] = 30
) -> AnalyticsOut:
    report = await AnalyticsService(session, max_per_hour=settings.analytics_max_per_hour).report(days)
    report.assistant = await usage_report(
        ChatRepository(session),
        settings,
        ready=getattr(request.app.state, "chat_model", None) is not None,
        enabled=await PanelSettingsService(SettingsRepository(session), claude_ready=False).assistant_enabled(),
    )
    return report
