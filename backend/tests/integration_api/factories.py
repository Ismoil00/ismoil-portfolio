"""Helpers that create what content tests need (selector items, uploads) through the API."""

import io

from PIL import Image

from tests.integration_api.test_selectors_api import ICON

API = "/api/v1/admin"


def i18n(en: str) -> dict[str, str]:
    return {"en": en, "ru": f"{en} (ru)", "tg": f"{en} (tg)"}


def rich(en: str) -> dict[str, str]:
    return {lang: f"<p>{en} ({lang})</p>" for lang in ("en", "ru", "tg")}


async def post(client, path: str, body: dict) -> dict:
    response = await client.post(f"{API}{path}", json=body)
    assert response.status_code == 201, response.text
    return response.json()


async def company(client, name: str = "Smartpay") -> dict:
    return await post(client, "/selectors/companies", {"name": name, "website_url": "https://example.com"})


async def tech(client, name: str = "Python") -> dict:
    return await post(client, "/selectors/tech-stacks", {"name": name, "icon_svg": ICON, "color": "#3776AB"})


async def field(client, name: str = "Backend") -> dict:
    return await post(client, "/selectors/development-fields", {"name": i18n(name)})


async def product_type(client, name: str = "Web") -> dict:
    return await post(client, "/selectors/product-types", {"name": i18n(name), "icon_svg": ICON})


async def position(client, name: str = "Full-stack developer") -> dict:
    return await post(client, "/selectors/positions", {"name": i18n(name)})


async def institute(client, name: str = "Tajik Technical University") -> dict:
    return await post(client, "/selectors/institutes", {"name": i18n(name)})


def image_bytes(size=(64, 40), fmt: str = "PNG") -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (40, 90, 200)).save(buffer, format=fmt)
    return buffer.getvalue()


MP4 = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41" + b"\x00" * 200


async def upload(client, purpose: str, *, video: bool = False) -> dict:
    if video:
        files = {
            "file": ("clip.mp4", MP4, "video/mp4"),
            "poster": ("poster.jpg", image_bytes(fmt="JPEG"), "image/jpeg"),
        }
        data = {"purpose": purpose, "width": "1280", "height": "720"}
    else:
        files = {"file": ("shot.png", image_bytes(), "image/png")}
        data = {"purpose": purpose}
    response = await client.post(f"{API}/media", data=data, files=files)
    assert response.status_code == 201, response.text
    return response.json()
