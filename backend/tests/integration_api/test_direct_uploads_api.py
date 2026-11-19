"""Big files on Vercel: the admin panel uploads them straight to Vercel Blob (a request to the backend can't
exceed 4.5 MB there), then asks the backend to check the file and put it in place.

1. POST /admin/media/direct/authorize  — may this staged path be uploaded, and how big can it be?
2. (the browser uploads to Vercel Blob)
3. POST /admin/media/direct            — check the staged file and turn it into a media item
"""

import io
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from PIL import Image

from app.main import create_app
from app.repositories.media import MediaRepository
from app.repositories.storage import BlobStorage
from app.services.media import MediaService
from tests.blob_fake import BASE_URL, FakeBlobClient
from tests.integration_api.conftest import _TestDatabase
from tests.integration_api.test_media_api import MP4, PDF, jpeg_with_gps, png, upload

AUTHORIZE = "/api/v1/admin/media/direct/authorize"
ADOPT = "/api/v1/admin/media/direct"
MB = 1024 * 1024


@pytest.fixture
def fake() -> FakeBlobClient:
    return FakeBlobClient()


@pytest.fixture
def app(settings, db_session, storage_dir, fake):
    app = create_app(settings, database=_TestDatabase(db_session))
    app.state.storage = BlobStorage(BASE_URL, client=fake)
    return app


def staged_path(purpose: str) -> str:
    return f"incoming/{purpose}/{uuid.uuid4().hex}"


async def adopt(client, pathname: str, filename: str, **extra):
    files = {"poster": ("poster.jpg", extra.pop("poster"), "image/jpeg")} if "poster" in extra else None
    return await client.post(ADOPT, data={"pathname": pathname, "filename": filename, **extra}, files=files)


async def test_direct_uploads_need_a_signed_in_admin(client):
    assert (await client.post(AUTHORIZE, json={"pathname": staged_path("project_video")})).status_code == 401
    assert (await adopt(client, staged_path("project_video"), "demo.mp4")).status_code == 401


@pytest.mark.parametrize(
    ("purpose", "limit"),
    [("project_video", 100 * MB), ("testimonial_video", 100 * MB), ("project_image", 10 * MB), ("resume", 10 * MB)],
)
async def test_authorize_returns_the_size_limit(auth_client, purpose, limit):
    response = await auth_client.post(AUTHORIZE, json={"pathname": staged_path(purpose)})
    assert response.status_code == 200, response.text
    assert response.json() == {"maximum_size_in_bytes": limit}


@pytest.mark.parametrize(
    "pathname",
    [
        "project_video/abc.mp4",  # not a staging path
        f"incoming/logo/{uuid.uuid4().hex}",  # small files go through the backend
        f"incoming/anything/{uuid.uuid4().hex}",
        "incoming/project_video/../../etc",
        "incoming/project_video/NOT-HEX",
    ],
)
async def test_authorize_refuses_other_paths(auth_client, pathname):
    response = await auth_client.post(AUTHORIZE, json={"pathname": pathname})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "pathname"]


async def test_a_staged_video_becomes_a_media_item_with_its_poster(auth_client, fake):
    staged = fake.stage(staged_path("project_video"), MP4, "video/mp4")
    response = await adopt(auth_client, staged, "demo.mp4", poster=png(), width="1280", height="720")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["content_type"] == "video/mp4"
    assert (body["width"], body["height"]) == (1280, 720)
    assert body["url"].startswith(f"{BASE_URL}/project_video/") and body["url"].endswith(".mp4")
    assert body["poster_url"].startswith(f"{BASE_URL}/poster/")
    assert staged not in fake.files
    assert sorted(path.split("/")[0] for path in fake.files) == ["poster", "project_video"]


async def test_a_staged_photo_is_checked_and_its_location_removed(auth_client, fake):
    staged = fake.stage(staged_path("testimonial_image"), jpeg_with_gps(), "image/jpeg")
    response = await adopt(auth_client, staged, "me.jpg")
    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["width"], body["height"]) == (60, 40)
    [(path, stored)] = fake.files.items()
    assert path.startswith("testimonial_image/") and path.endswith(".jpg")
    with Image.open(io.BytesIO(stored.body)) as image:
        assert not image.getexif()


async def test_a_staged_resume_downloads_under_its_name(auth_client, fake):
    staged = fake.stage(staged_path("resume"), PDF, "application/pdf")
    response = await adopt(auth_client, staged, "CV - En.pdf")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["original_name"] == "CV - En.pdf"
    assert body["url"].endswith("/CV%20-%20En.pdf?download=1")
    [path] = fake.files
    assert path.startswith("resume/") and path.endswith("/CV - En.pdf")


async def test_a_staged_file_of_the_wrong_type_is_refused_and_removed(auth_client, fake):
    staged = fake.stage(staged_path("project_image"), b"<script>alert(1)</script>", "image/png")
    response = await adopt(auth_client, staged, "evil.png")
    assert response.status_code == 415
    assert fake.files == {}


async def test_a_staged_file_over_the_limit_is_refused_and_removed(auth_client, fake):
    staged = fake.stage(staged_path("project_image"), png() + b"\x00" * (10 * MB), "image/png")
    response = await adopt(auth_client, staged, "huge.png")
    assert response.status_code == 413
    assert fake.files == {}


async def test_an_unfinished_upload_is_reported(auth_client):
    response = await adopt(auth_client, staged_path("project_video"), "demo.mp4")
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "pathname"]


async def test_small_files_still_go_through_the_backend(auth_client, fake):
    response = await upload(auth_client, "certificate_image", "c.png", png(), "image/png")
    assert response.status_code == 201, response.text
    [path] = fake.files
    assert path.startswith("certificate_image/")
    assert response.json()["url"] == f"{BASE_URL}/{path}"


async def test_cleanup_removes_staged_uploads_older_than_a_day(app, db_session, fake):
    now = datetime.now(UTC)
    old = fake.stage(staged_path("project_video"), MP4, uploaded_at=now - timedelta(hours=25))
    fresh = fake.stage(staged_path("project_video"), MP4, uploaded_at=now)
    removed = await MediaService(MediaRepository(db_session), app.state.storage).cleanup()
    assert removed == 1
    assert old not in fake.files and fresh in fake.files
