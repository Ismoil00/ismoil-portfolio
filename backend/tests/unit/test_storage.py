"""File storage drivers: local disk (development) and S3-compatible servers (MinIO, RustFS, R2, AWS…)."""

import io

import aioboto3
import pytest
from moto.server import ThreadedMotoServer

from app.repositories.storage import InvalidKey, LocalStorage, S3Storage


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
