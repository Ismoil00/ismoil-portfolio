"""The daily cleanup that Vercel Cron calls (GET with `Authorization: Bearer <CRON_SECRET>`): unlinked uploads
older than a day, old login attempts and expired sessions are removed — the same work as `app.cli cleanup`."""

import pytest
from pydantic import SecretStr
from sqlalchemy import text

from app.main import create_app
from tests.integration_api.conftest import _TestDatabase, make_client
from tests.integration_api.test_media_api import png, upload

CLEANUP = "/api/v1/internal/cleanup"
SECRET = "cron-secret-for-tests-0123456789"


@pytest.fixture
def app(settings, db_session, storage_dir):
    return create_app(
        settings.model_copy(update={"cron_secret": SecretStr(SECRET)}), database=_TestDatabase(db_session)
    )


async def test_cleanup_is_off_without_a_cron_secret(settings, db_session, storage_dir):
    async with make_client(create_app(settings, database=_TestDatabase(db_session))) as client:
        assert (await client.get(CLEANUP, headers={"Authorization": f"Bearer {SECRET}"})).status_code == 404


@pytest.mark.parametrize("header", [None, "Bearer wrong", SECRET, f"Basic {SECRET}"])
async def test_cleanup_needs_the_cron_secret(client, header):
    headers = {"Authorization": header} if header else {}
    assert (await client.get(CLEANUP, headers=headers)).status_code == 401


async def test_cleanup_removes_day_old_unlinked_uploads(client, auth_client, db_session, storage_dir):
    old = (await upload(auth_client, "project_image", "old.png", png(), "image/png")).json()
    fresh = (await upload(auth_client, "project_image", "fresh.png", png(), "image/png")).json()
    await db_session.execute(
        text("UPDATE media SET created_at = now() - interval '2 days' WHERE id = :id"), {"id": old["id"]}
    )

    response = await client.get(CLEANUP, headers={"Authorization": f"Bearer {SECRET}"})
    assert response.status_code == 200, response.text
    assert response.json() == {"removed_uploads": 1}
    assert [path.name for path in storage_dir.rglob("*.png")] == [fresh["url"].rsplit("/", 1)[1]]
