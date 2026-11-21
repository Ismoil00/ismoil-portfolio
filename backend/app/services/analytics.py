"""Visit statistics: storing what the public site reports, and totalling it for the admin panel."""

import re
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from sqlalchemy import Date, cast, delete, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ContactMessage
from app.models.analytics import VisitEvent
from app.repositories.chat import ChatRepository
from app.schemas.analytics import AnalyticsOut, CountOut, DayOut, TotalsOut, VisitEventIn

# Crawlers, link previews, monitoring and scripts: their visits aren't people's.
_BOT = re.compile(
    r"bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|curl|wget|python|httpx|"
    r"axios|node-fetch|go-http|java/|okhttp|monitor|uptime|scan",
    re.IGNORECASE,
)
TOP = 10
KEEP_EVENTS = timedelta(days=400)  # a year of history, plus a margin


def is_bot(user_agent: str) -> bool:
    return not user_agent.strip() or bool(_BOT.search(user_agent))


def referrer_host(referrer: str | None) -> str | None:
    """ "https://www.linkedin.com/feed/" → "linkedin.com"; anything that isn't a web address → None."""
    if not referrer:
        return None
    try:
        parts = urlsplit(referrer.strip())
    except ValueError:
        return None
    host = (parts.hostname or "").lower()
    if parts.scheme not in {"http", "https"} or "." not in host:
        return None
    return host.removeprefix("www.")[:255]


class AnalyticsService:
    def __init__(self, session: AsyncSession, *, max_per_hour: int, clock=lambda: datetime.now(UTC)) -> None:
        self.session = session
        self.max_per_hour = max_per_hour
        self.clock = clock

    async def record(self, event: VisitEventIn, *, ip_hash: str) -> None:
        """Keeps a visit. Bots, and one address's events beyond the hourly cap, are quietly dropped:
        the public site isn't told, so there's nothing to probe."""
        if is_bot(event.user_agent):
            return
        hour_ago = self.clock() - timedelta(hours=1)
        recent = await self.session.scalar(
            select(func.count())
            .select_from(VisitEvent)
            .where(VisitEvent.ip_hash == ip_hash, VisitEvent.created_at >= hour_ago)
        )
        if recent >= self.max_per_hour:
            return
        self.session.add(
            VisitEvent(
                kind=event.kind,
                path=event.path,
                locale=event.locale,
                device=event.device,
                country=event.country.upper() if event.country else None,
                referrer_host=referrer_host(event.referrer),
                visitor_id=event.visitor_id,
                ip_hash=ip_hash,
            )
        )
        await self.session.commit()

    async def _counts(self, column, since: datetime, *, empty: str) -> list[CountOut]:
        label = func.coalesce(column, empty)
        rows = await self.session.execute(
            select(label, func.count())
            .where(VisitEvent.kind == "page_view", VisitEvent.created_at >= since)
            .group_by(label)
            .order_by(func.count().desc(), label)
            .limit(TOP)
        )
        return [CountOut(name=name, count=count) for name, count in rows]

    async def report(self, days: int) -> AnalyticsOut:
        """Totals for the last `days` days (today included)."""
        today = self.clock().date()
        first = today - timedelta(days=days - 1)
        since = datetime.combine(first, datetime.min.time(), tzinfo=UTC)
        views = VisitEvent.kind == "page_view"
        recent = VisitEvent.created_at >= since

        page_views, visitors = (
            await self.session.execute(
                select(func.count(), func.count(distinct(VisitEvent.visitor_id))).where(views, recent)
            )
        ).one()
        downloads = await self.session.scalar(select(func.count()).where(VisitEvent.kind == "resume_download", recent))
        messages = await self.session.scalar(select(func.count()).where(ContactMessage.created_at >= since))

        day = cast(func.timezone("UTC", VisitEvent.created_at), Date)
        per_day = {
            d: (v, u)
            for d, v, u in await self.session.execute(
                select(day, func.count(), func.count(distinct(VisitEvent.visitor_id)))
                .where(views, recent)
                .group_by(day)
            )
        }
        daily = [
            DayOut(date=d, page_views=per_day.get(d, (0, 0))[0], visitors=per_day.get(d, (0, 0))[1])
            for d in (first + timedelta(days=i) for i in range(days))
        ]
        return AnalyticsOut(
            days=days,
            totals=TotalsOut(page_views=page_views, visitors=visitors, resume_downloads=downloads, messages=messages),
            daily=daily,
            pages=await self._counts(VisitEvent.path, since, empty="/"),
            referrers=await self._counts(VisitEvent.referrer_host, since, empty="direct"),
            countries=await self._counts(VisitEvent.country, since, empty="unknown"),
            locales=await self._counts(VisitEvent.locale, since, empty="?"),
            devices=await self._counts(VisitEvent.device, since, empty="?"),
            questions=[
                CountOut(name=question, count=count)
                for question, count in await ChatRepository(self.session).top_questions(since, TOP)
            ],
        )

    async def forget_old(self) -> None:
        """Part of the daily cleanup: events older than KEEP_EVENTS are deleted."""
        await self.session.execute(delete(VisitEvent).where(VisitEvent.created_at < self.clock() - KEEP_EVENTS))
