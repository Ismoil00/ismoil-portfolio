"""File storage drivers: local disk (development), S3-compatible servers (MinIO, RustFS, R2, AWS…) and Vercel Blob."""

import io
from datetime import UTC, datetime, timedelta

import aioboto3
import pytest
from moto.server import ThreadedMotoServer

from app.core.config import Settings
from app.core.files import content_disposition
from app.repositories.storage import (
    BlobStorage,
    InvalidKey,
    LocalStorage,
    S3Storage,
    blob_file_name,
    create_storage,
)
from tests.blob_fake import BASE_URL, FakeBlobClient


@pytest.fixture
def local(tmp_path) -> LocalStorage:
    return LocalStorage(tmp_path / "files", "http://cdn.test/media")


async def test_local_save_url_and_delete(local, tmp_path):
    await local.save("project_image/abc.png", io.BytesIO(b"png-bytes"), "image/png")
    assert (tmp_path / "files" / "project_image" / "abc.png").read_bytes() == b"png-bytes"
    assert local.url("project_image/abc.png") == "http://cdn.test/media/project_image/abc.png"
    assert await local.exists("project_image/abc.png")
    await local.delete("project_image/abc.png")
    assert not await local.exists("project_image/abc.png")
    await local.delete("project_image/abc.png")  # deleting twice is fine


@pytest.mark.parametrize("key", ["../outside.txt", "a/../../b", "/abs/path", "C:/windows", "a\\b", ""])
async def test_local_refuses_keys_that_leave_the_folder(local, key):
    with pytest.raises(InvalidKey):
        await local.save(key, io.BytesIO(b"x"), "text/plain")


@pytest.fixture(scope="module")
def s3_server():
    server = ThreadedMotoServer(ip_address="127.0.0.1", port=0)
    server.start()
    host, port = server.get_host_and_port()
    yield f"http://{host}:{port}"
    server.stop()


@pytest.fixture
async def s3(s3_server) -> S3Storage:
    storage = S3Storage(
        endpoint_url=s3_server,
        bucket="portfolio-test",
        access_key="testing",
        secret_key="testing",
        region="us-east-1",
        public_base_url="https://media.example.com",
    )
    await storage.ensure_bucket()
    return storage


async def test_s3_save_url_and_delete(s3, s3_server):
    await s3.save("logo/x.svg", io.BytesIO(b"<svg/>"), "image/svg+xml")
    assert await s3.exists("logo/x.svg")
    assert s3.url("logo/x.svg") == "https://media.example.com/logo/x.svg"

    session = aioboto3.Session(aws_access_key_id="testing", aws_secret_access_key="testing", region_name="us-east-1")
    async with session.client("s3", endpoint_url=s3_server) as client:
        head = await client.head_object(Bucket="portfolio-test", Key="logo/x.svg")
        assert head["ContentType"] == "image/svg+xml"

    await s3.delete("logo/x.svg")
    assert not await s3.exists("logo/x.svg")


async def test_s3_downloads_keep_the_uploaded_name(s3, s3_server):
    """With S3 the storage server serves files itself, so the download name is stored with the file."""
    await s3.save(
        "resume/abc.pdf", io.BytesIO(b"%PDF-1.7"), "application/pdf", download_name="CV - Ru - Sharifov Ismoil.pdf"
    )
    await s3.save("project_image/abc.png", io.BytesIO(b"png"), "image/png")

    session = aioboto3.Session(aws_access_key_id="testing", aws_secret_access_key="testing", region_name="us-east-1")
    async with session.client("s3", endpoint_url=s3_server) as client:
        pdf = await client.head_object(Bucket="portfolio-test", Key="resume/abc.pdf")
        image = await client.head_object(Bucket="portfolio-test", Key="project_image/abc.png")
    assert pdf["ContentDisposition"] == content_disposition("CV - Ru - Sharifov Ismoil.pdf")
    assert "ContentDisposition" not in image


def test_local_and_s3_take_uploads_through_the_backend():
    assert LocalStorage.direct_uploads is False
    assert S3Storage.direct_uploads is False


@pytest.fixture
def fake() -> FakeBlobClient:
    return FakeBlobClient()


@pytest.fixture
def blob(fake) -> BlobStorage:
    return BlobStorage(BASE_URL + "/", client=fake)


async def test_blob_save_url_and_delete(blob, fake):
    await blob.save("project_image/abc.png", io.BytesIO(b"png-bytes"), "image/png")
    stored = fake.files["project_image/abc.png"]
    assert (stored.body, stored.content_type, stored.access) == (b"png-bytes", "image/png", "public")
    assert stored.cache_control_max_age == 365 * 24 * 3600  # names are never reused, so caching is safe
    assert blob.url("project_image/abc.png") == f"{BASE_URL}/project_image/abc.png"
    assert await blob.exists("project_image/abc.png")

    await blob.delete("project_image/abc.png")
    assert not await blob.exists("project_image/abc.png")
    await blob.delete("project_image/abc.png")  # deleting twice is fine


async def test_blob_downloads_keep_the_uploaded_name(blob, fake):
    """Blob names a download after the file's path, so the résumé is stored under its uploaded name."""
    name = "CV - Ru - Sharifov Ismoil.pdf"
    await blob.save("resume/abc.pdf", io.BytesIO(b"%PDF-1.7"), "application/pdf", download_name=name)
    assert list(fake.files) == ["resume/abc/CV - Ru - Sharifov Ismoil.pdf"]
    url = blob.url("resume/abc.pdf", download_name=name)
    assert url == f"{BASE_URL}/resume/abc/CV%20-%20Ru%20-%20Sharifov%20Ismoil.pdf?download=1"
    assert await blob.exists("resume/abc.pdf", download_name=name)

    await blob.delete("resume/abc.pdf", download_name=name)
    assert fake.files == {}


@pytest.mark.parametrize(
    ("name", "stored"),
    [
        ("Резюме Исмоил.pdf", "Резюме Исмоил.pdf"),
        ("a#b?c%d.pdf", "a_b_c_d.pdf"),
        ("..", "file"),
        ("  .pdf", "file.pdf"),
    ],
)
def test_blob_file_names_avoid_characters_that_break_urls(name, stored):
    assert blob_file_name(name) == stored


async def test_blob_refuses_keys_the_app_never_makes(blob):
    with pytest.raises(InvalidKey):
        await blob.save("../outside.txt", io.BytesIO(b"x"), "text/plain")


async def test_a_staged_upload_can_be_read_and_moved_into_place(blob, fake):
    staged = fake.stage("incoming/resume/" + "a" * 32, b"%PDF-1.7 rest of the file", "application/pdf")
    assert blob.is_staged(staged)
    assert not blob.is_staged("resume/abc.pdf")
    assert await blob.staged_size(staged) == len(b"%PDF-1.7 rest of the file")
    assert await blob.read_staged(staged, limit=8) == b"%PDF-1.7"
    assert await blob.read_staged(staged) == b"%PDF-1.7 rest of the file"

    await blob.adopt_staged(staged, "resume/abc.pdf", "application/pdf", download_name="CV.pdf")
    assert staged not in fake.files
    moved = fake.files["resume/abc/CV.pdf"]
    assert (moved.body, moved.content_type) == (b"%PDF-1.7 rest of the file", "application/pdf")
    assert moved.cache_control_max_age == 365 * 24 * 3600


async def test_a_missing_staged_upload_has_no_size(blob):
    assert await blob.staged_size("incoming/resume/" + "b" * 32) is None


async def test_only_old_staged_uploads_are_stale(blob, fake):
    now = datetime.now(UTC)
    old = fake.stage("incoming/project_video/" + "c" * 32, b"x", uploaded_at=now - timedelta(days=2))
    fake.stage("incoming/project_video/" + "d" * 32, b"x", uploaded_at=now)
    fake.files["project_image/kept.png"] = fake.files[old]  # not staged: never listed
    assert await blob.stale_staged(now - timedelta(days=1)) == [old]


def _blob_settings(**values):
    return Settings(_env_file=None, secret_key="x", storage_backend="blob", **values)


def test_the_blob_address_comes_from_the_token(monkeypatch):
    """Blob serves a public store at https://<store id, lower case>.public.blob.vercel-storage.com."""
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    monkeypatch.delenv("BLOB_STORE_ID", raising=False)
    storage = create_storage(_blob_settings(blob_read_write_token="vercel_blob_rw_AbC123xyz_s3cretPart"))
    assert storage.public_base_url == "https://abc123xyz.public.blob.vercel-storage.com"


def test_the_blob_address_comes_from_the_store_id_without_a_token(monkeypatch):
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    monkeypatch.setenv("BLOB_STORE_ID", "store_QwErTy")
    assert create_storage(_blob_settings()).public_base_url == "https://qwerty.public.blob.vercel-storage.com"


def test_an_explicit_blob_address_wins(monkeypatch):
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    settings = _blob_settings(media_base_url="https://media.example.com", blob_read_write_token="vercel_blob_rw_A1_b")
    assert create_storage(settings).public_base_url == "https://media.example.com"


def test_blob_without_a_token_or_store_is_refused(monkeypatch):
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    monkeypatch.delenv("BLOB_STORE_ID", raising=False)
    with pytest.raises(ValueError, match="BLOB_READ_WRITE_TOKEN"):
        create_storage(_blob_settings())
