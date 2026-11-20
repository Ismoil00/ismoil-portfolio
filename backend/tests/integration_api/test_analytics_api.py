"""Visit statistics: the public site reports page views and résumé downloads, the admin panel reads totals.

Nothing personal is kept: no IP address, no name. A visitor id exists only when the visitor accepted
analytics cookies; without it a visit is still counted, just not as a "visitor".
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from tests.integration_api.conftest import make_client

EVENTS = "/api/v1/public/events"
STATS = "/api/v1/admin/analytics"
CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0 Safari/537.36"


def view(path="/en", **extra) -> dict:
    return {"kind": "page_view", "path": path, "locale": "en", "device": "desktop", "user_agent": CHROME, **extra}


async def test_a_page_view_is_counted(client, auth_client):
    visitor = str(uuid.uuid4())
    assert (
        await client.post(
            EVENTS, json=view(visitor_id=visitor, country="de", referrer="https://www.linkedin.com/feed/")
        )
    ).status_code == 204
    assert (await client.post(EVENTS, json=view("/en/projects", visitor_id=visitor))).status_code == 204
    assert (
        await client.post(EVENTS, json=view("/ru", locale="ru", device="mobile"))
    ).status_code == 204  # no consent: no id

    stats = (await auth_client.get(STATS, params={"days": 7})).json()
    assert stats["totals"] == {"page_views": 3, "visitors": 1, "resume_downloads": 0, "messages": 0}
    assert {"name": "/en", "count": 1} in stats["pages"]
    assert stats["referrers"] == [{"name": "direct", "count": 2}, {"name": "linkedin.com", "count": 1}]
    assert stats["countries"] == [{"name": "unknown", "count": 2}, {"name": "DE", "count": 1}]
    assert stats["locales"] == [{"name": "en", "count": 2}, {"name": "ru", "count": 1}]
    assert stats["devices"] == [{"name": "desktop", "count": 2}, {"name": "mobile", "count": 1}]
    assert len(stats["daily"]) == 7
    assert stats["daily"][-1]["page_views"] == 3 and stats["daily"][-1]["visitors"] == 1


async def test_resume_downloads_and_messages_are_totalled(client, auth_client):
    await client.post(EVENTS, json={**view(), "kind": "resume_download"})
    await client.post(
        "/api/v1/public/contact", json={"name": "Jane", "contact": "jane@x.com", "message": "Hello there!"}
    )
    totals = (await auth_client.get(STATS)).json()["totals"]
    assert (totals["resume_downloads"], totals["messages"], totals["page_views"]) == (1, 1, 0)


@pytest.mark.parametrize(
    "agent",
    [
        "Googlebot/2.1 (+http://www.google.com/bot.html)",
        "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/153.0 Safari/537.36",
        "facebookexternalhit/1.1",
        "curl/8.4.0",
        "",
    ],
)
async def test_bots_are_not_counted(client, auth_client, agent):
    assert (await client.post(EVENTS, json=view(user_agent=agent))).status_code == 204
    assert (await auth_client.get(STATS)).json()["totals"]["page_views"] == 0


@pytest.mark.parametrize(
    "change",
    [
        {"kind": "click"},
        {"path": "https://evil.example/x"},
        {"path": "/" + "a" * 400},
        {"locale": "de"},
        {"device": "fridge"},
        {"country": "Germany"},
        {"visitor_id": "not-a-uuid"},
    ],
)
async def test_wrong_events_are_refused(client, change):
    assert (await client.post(EVENTS, json=view(**change))).status_code == 422


async def test_the_query_string_and_own_site_are_left_out(client, auth_client, settings):
    await client.post(EVENTS, json=view("/en/projects?tech=python#top", referrer="not a url"))
    stats = (await auth_client.get(STATS)).json()
    assert stats["pages"] == [{"name": "/en/projects", "count": 1}]
    assert stats["referrers"] == [{"name": "direct", "count": 1}]


async def test_one_address_cant_flood_the_numbers(app, auth_client, settings):
    async with make_client(app, ip="203.0.113.99") as flooder:
        for _ in range(settings.analytics_max_per_hour + 5):
            assert (await flooder.post(EVENTS, json=view())).status_code == 204
    assert (await auth_client.get(STATS)).json()["totals"]["page_views"] == settings.analytics_max_per_hour


async def test_only_the_chosen_period_is_counted(client, auth_client, db_session):
    await client.post(EVENTS, json=view())
    await client.post(EVENTS, json=view("/en/old"))
    await db_session.execute(
        text("UPDATE visit_events SET created_at = :at WHERE path = '/en/old'"),
        {"at": datetime.now(UTC) - timedelta(days=40)},
    )
    assert (await auth_client.get(STATS, params={"days": 30})).json()["totals"]["page_views"] == 1
    assert (await auth_client.get(STATS, params={"days": 90})).json()["totals"]["page_views"] == 2


async def test_statistics_are_for_the_admin_only(client):
    assert (await client.get(STATS)).status_code == 401


@pytest.mark.parametrize("days", [0, 366, "x"])
async def test_the_period_is_checked(auth_client, days):
    assert (await auth_client.get(STATS, params={"days": days})).status_code == 422


async def test_the_daily_cleanup_forgets_events_older_than_about_a_year(client, auth_client, db_session, app):
    from app.services import maintenance

    await client.post(EVENTS, json=view("/en/old"))
    await client.post(EVENTS, json=view("/en/new"))
    await db_session.execute(
        text("UPDATE visit_events SET created_at = now() - interval '401 days' WHERE path = '/en/old'")
    )
    await maintenance.cleanup(db_session, app.state.storage)
    paths = (await db_session.execute(text("SELECT path FROM visit_events"))).scalars().all()
    assert paths == ["/en/new"]
