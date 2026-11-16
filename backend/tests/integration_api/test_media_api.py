"""Uploading files from the admin panel, and serving them back."""

import io
from urllib.parse import unquote

import pytest
from PIL import Image

from app.core.files import content_disposition
from tests.integration_api.conftest import make_client

UPLOAD = "/api/v1/admin/media"


def png(size=(40, 30)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (20, 90, 200)).save(buffer, format="PNG")
    return buffer.getvalue()


def jpeg_with_gps() -> bytes:
    image = Image.new("RGB", (60, 40), (200, 50, 50))
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # Make
    exif[0x8825] = {1: "N", 2: (38.0, 33.0, 0.0)}  # GPS info
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


PDF = b"%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n"
MP4 = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41" + b"\x00" * 200


async def upload(client, purpose, name, data, content_type="application/octet-stream", **extra):
    files = {"file": (name, data, content_type)}
    if "poster" in extra:
        files["poster"] = ("poster.jpg", extra.pop("poster"), "image/jpeg")
    return await client.post(UPLOAD, data={"purpose": purpose, **extra}, files=files)


async def test_upload_requires_admin(client):
    response = await upload(client, "project_image", "a.png", png())
    assert response.status_code == 401


async def test_upload_image_returns_its_url_and_size(auth_client, storage_dir):
    response = await upload(auth_client, "project_image", "shot.png", png((40, 30)), "image/png")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["content_type"] == "image/png"
    assert (body["width"], body["height"]) == (40, 30)
    assert body["url"].startswith("http://testserver/media/project_image/")
    assert body["url"].endswith(".png")
    assert "shot" not in body["url"]  # names are random, not the uploader's
    assert len(list(storage_dir.rglob("*.png"))) == 1


async def test_type_is_decided_by_content_not_by_name(auth_client):
    response = await upload(auth_client, "project_image", "evil.png", b"<script>alert(1)</script>", "image/png")
    assert response.status_code == 415
    response = await upload(auth_client, "resume", "cv.pdf", png(), "application/pdf")
    assert response.status_code == 415


async def test_size_limits_per_use(auth_client):
    too_big = png() + b"\x00" * (2 * 1024 * 1024)
    response = await upload(auth_client, "certificate_image", "c.png", too_big, "image/png")
    assert response.status_code == 413


async def test_photo_location_metadata_is_removed(auth_client, storage_dir):
    response = await upload(auth_client, "testimonial_image", "me.jpg", jpeg_with_gps(), "image/jpeg")
    assert response.status_code == 201, response.text
    saved = next(storage_dir.rglob("*.jpg"))
    with Image.open(saved) as image:
        assert not image.getexif()


async def test_svg_logo_is_sanitized(auth_client, storage_dir):
    svg = (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" onload="alert(1)">'
        b'<script>x</script><rect width="4" height="4"/></svg>'
    )
    response = await upload(auth_client, "logo", "logo.svg", svg, "image/svg+xml")
    assert response.status_code == 201, response.text
    saved = next(storage_dir.rglob("*.svg")).read_text()
    assert "script" not in saved and "onload" not in saved and "<rect" in saved


async def test_video_with_poster(auth_client):
    response = await upload(
        auth_client, "project_video", "demo.mp4", MP4, "video/mp4", poster=png(), width="1280", height="720"
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["content_type"] == "video/mp4"
    assert (body["width"], body["height"]) == (1280, 720)
    assert body["poster_url"].startswith("http://testserver/media/poster/")


async def test_unknown_purpose_is_refused(auth_client):
    assert (await upload(auth_client, "anything", "a.png", png(), "image/png")).status_code == 422


async def test_files_are_served_with_safe_headers(app, auth_client):
    body = (await upload(auth_client, "resume", "My CV (2026).pdf", PDF, "application/pdf")).json()
    path = body["url"].removeprefix("http://testserver")
    async with make_client(app) as visitor:  # public: no session needed
        response = await visitor.get(path)
    assert response.status_code == 200
    assert response.content == PDF
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in response.headers["content-security-policy"]
    assert response.headers["content-disposition"].startswith("attachment")
    assert "immutable" in response.headers["cache-control"]


@pytest.mark.parametrize("name", ["CV - Ru - Sharifov Ismoil.pdf", "Резюме — Шарифов Исмоил.pdf"])
async def test_a_downloaded_resume_keeps_its_uploaded_name(app, auth_client, name):
    body = (await upload(auth_client, "resume", name, PDF, "application/pdf")).json()
    assert body["original_name"] == name
    async with make_client(app) as visitor:
        response = await visitor.get(body["url"].removeprefix("http://testserver"))
    header = response.headers["content-disposition"]
    assert header == content_disposition(name)
    assert unquote(header.split("filename*=UTF-8''")[1]) == name


async def test_images_open_in_the_browser_instead_of_downloading(app, auth_client):
    body = (await upload(auth_client, "project_image", "My photo.png", png(), "image/png")).json()
    assert body["original_name"] == "My photo.png"
    async with make_client(app) as visitor:
        response = await visitor.get(body["url"].removeprefix("http://testserver"))
    assert "content-disposition" not in response.headers


async def test_unknown_files_are_404(client):
    assert (await client.get("/media/project_image/does-not-exist.png")).status_code == 404
    assert (await client.get("/media/../.env")).status_code == 404


async def test_unlinked_upload_can_be_deleted(auth_client, storage_dir):
    media_id = (await upload(auth_client, "project_image", "a.png", png(), "image/png")).json()["id"]
    assert (await auth_client.delete(f"{UPLOAD}/{media_id}")).status_code == 204
    assert not list(storage_dir.rglob("*.png"))
    assert (await auth_client.delete(f"{UPLOAD}/{media_id}")).status_code == 404
