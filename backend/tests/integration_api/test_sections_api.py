"""Hero, About, Contacts, Other links and the Tech stack page."""

import pytest

from tests.integration_api.test_media_api import PDF, upload
from tests.integration_api.test_selectors_api import ICON, create, i18n

API = "/api/v1/admin"


def names(en: str, ru: str, tg: str) -> dict:
    return {"en": en, "ru": ru, "tg": tg}


async def upload_resume(client) -> dict:
    response = await upload(client, "resume", "cv.pdf", PDF, "application/pdf")
    assert response.status_code == 201, response.text
    return response.json()


async def hero_payload(client, **overrides) -> dict:
    resume = await upload_resume(client)
    return {
        "first_name": names("Ismoil", "Исмоил", "Исмоил"),
        "last_name": names("Sharifov", "Шарифов", "Шарифов"),
        "role": i18n("Full-stack software engineer"),
        "description": i18n("I design and ship **software**."),
        "resume_id": resume["id"],
        "availability": "seeking",
        **overrides,
    }


# --- hero ---------------------------------------------------------------------------------------


async def test_hero_is_empty_until_saved(auth_client):
    response = await auth_client.get(f"{API}/hero")
    assert response.status_code == 200
    assert response.json() is None


async def test_save_and_read_hero(auth_client):
    payload = await hero_payload(auth_client)
    response = await auth_client.put(f"{API}/hero", json=payload)
    assert response.status_code == 200, response.text
    hero = response.json()
    assert hero["first_name"]["ru"] == "Исмоил"
    assert hero["resume"]["id"] == payload["resume_id"]
    assert hero["availability"] == "seeking"
    assert (await auth_client.get(f"{API}/hero")).json() == hero


@pytest.mark.parametrize(
    ("override", "loc"),
    [
        ({"first_name": names("Ismoil Sharifov", "Исмоил", "Исмоил")}, ["body", "first_name", "en"]),
        ({"last_name": names("Sharifov", "", "Шарифов")}, ["body", "last_name", "ru"]),
        ({"role": i18n("x" * 501)}, ["body", "role", "en"]),
        ({"description": i18n("x" * 1001)}, ["body", "description", "en"]),
        ({"availability": "maybe"}, ["body", "availability"]),
        ({"resume_id": None}, ["body", "resume_id"]),
    ],
)
async def test_hero_validation(auth_client, override, loc):
    payload = await hero_payload(auth_client, **override)
    response = await auth_client.put(f"{API}/hero", json=payload)
    assert response.status_code == 422
    assert loc in [e["loc"] for e in response.json()["detail"]]


async def test_hero_description_is_optional(auth_client):
    payload = await hero_payload(auth_client, description=None)
    assert (await auth_client.put(f"{API}/hero", json=payload)).json()["description"] is None


async def test_resume_must_be_a_resume_upload(auth_client):
    from tests.integration_api.test_media_api import png

    image = (await upload(auth_client, "project_image", "a.png", png(), "image/png")).json()
    payload = await hero_payload(auth_client, resume_id=image["id"])
    response = await auth_client.put(f"{API}/hero", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "resume_id"]


async def test_new_resume_replaces_and_deletes_the_old_file(auth_client, storage_dir):
    await auth_client.put(f"{API}/hero", json=await hero_payload(auth_client))
    await auth_client.put(f"{API}/hero", json=await hero_payload(auth_client))
    assert len(list(storage_dir.rglob("*.pdf"))) == 1


# --- about --------------------------------------------------------------------------------------

ABOUT = {
    "title": i18n("Engineer who owns the whole feature"),
    "paragraph_1": i18n("First paragraph.\n\nWith two parts."),
    "paragraph_2": None,
    "city": names("Dushanbe", "Душанбе", "Душанбе"),
    "country_code": "TJ",
    "timezone": "Asia/Dushanbe",
    "open_to_remote": True,
    "open_to_relocation": False,
}


async def test_save_and_read_about(auth_client):
    assert (await auth_client.get(f"{API}/about")).json() is None
    response = await auth_client.put(f"{API}/about", json=ABOUT)
    assert response.status_code == 200, response.text
    about = response.json()
    assert about["paragraph_1"]["en"] == "First paragraph.\n\nWith two parts."
    assert about["utc_offset"] == "GMT+5"
    assert (await auth_client.get(f"{API}/about")).json() == about


@pytest.mark.parametrize(
    ("override", "loc"),
    [
        ({"country_code": "XX"}, ["body", "country_code"]),
        ({"timezone": "Mars/Olympus"}, ["body", "timezone"]),
        ({"title": i18n("x" * 201)}, ["body", "title", "en"]),
        ({"paragraph_1": None}, ["body", "paragraph_1"]),
        ({"open_to_remote": None}, ["body", "open_to_remote"]),
    ],
)
async def test_about_validation(auth_client, override, loc):
    response = await auth_client.put(f"{API}/about", json={**ABOUT, **override})
    assert response.status_code == 422
    assert loc in [e["loc"] for e in response.json()["detail"]]


# --- contacts -----------------------------------------------------------------------------------


async def test_contacts_need_at_least_two(auth_client):
    response = await auth_client.put(f"{API}/contacts", json={"email": "me@example.com"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body"]

    body = {"email": "me@example.com", "telegram": "@ismoil98", "whatsapp": None, "linkedin": None}
    response = await auth_client.put(f"{API}/contacts", json=body)
    assert response.status_code == 200, response.text
    contacts = response.json()
    assert contacts["telegram"] == "ismoil98"
    assert contacts["links"]["telegram"] == {"url": "https://t.me/ismoil98", "handle": "@ismoil98"}
    assert contacts["links"]["whatsapp"] is None


async def test_contacts_validation(auth_client):
    body = {"email": "not-an-email", "telegram": "x", "whatsapp": "12345", "linkedin": "https://example.com"}
    response = await auth_client.put(f"{API}/contacts", json=body)
    locs = [e["loc"] for e in response.json()["detail"]]
    for field in ("email", "telegram", "whatsapp", "linkedin"):
        assert ["body", field] in locs


# --- other links --------------------------------------------------------------------------------


async def test_other_links_crud_and_order(auth_client):
    github = await create(auth_client, "link-platforms", {"name": "GitHub", "icon_svg": ICON})
    leetcode = await create(auth_client, "link-platforms", {"name": "LeetCode"})

    first = (
        await auth_client.post(f"{API}/other-links", json={"platform_id": github["id"], "url": "https://github.com/me"})
    ).json()
    second = (
        await auth_client.post(
            f"{API}/other-links", json={"platform_id": leetcode["id"], "url": "https://leetcode.com/u/me"}
        )
    ).json()
    assert first["platform"]["name"] == "GitHub"

    listed = (await auth_client.get(f"{API}/other-links")).json()
    assert [link["id"] for link in listed] == [first["id"], second["id"]]

    assert (
        await auth_client.put(f"{API}/other-links/order", json={"ids": [second["id"], first["id"]]})
    ).status_code == 204
    assert [link["id"] for link in (await auth_client.get(f"{API}/other-links")).json()] == [second["id"], first["id"]]

    updated = await auth_client.put(
        f"{API}/other-links/{first['id']}", json={"platform_id": github["id"], "url": "https://github.com/other"}
    )
    assert updated.json()["url"] == "https://github.com/other"

    # The platform is now in use.
    assert (await auth_client.delete(f"/api/v1/admin/selectors/link-platforms/{github['id']}")).status_code == 409
    assert (await auth_client.delete(f"{API}/other-links/{first['id']}")).status_code == 204
    assert (await auth_client.delete(f"/api/v1/admin/selectors/link-platforms/{github['id']}")).status_code == 204


async def test_other_link_validation(auth_client):
    platform = await create(auth_client, "link-platforms", {"name": "Medium"})
    bad_url = await auth_client.post(
        f"{API}/other-links", json={"platform_id": platform["id"], "url": "javascript:alert(1)"}
    )
    assert bad_url.status_code == 422
    unknown = await auth_client.post(
        f"{API}/other-links", json={"platform_id": "00000000-0000-4000-8000-000000000000", "url": "https://x.example"}
    )
    assert unknown.status_code == 422
    assert unknown.json()["detail"][0]["loc"] == ["body", "platform_id"]


# --- tech stack page ----------------------------------------------------------------------------


async def test_tech_showcase(auth_client):
    backend = await create(auth_client, "development-fields", {"name": i18n("Backend")})
    tools = await create(auth_client, "instruments", {"name": i18n("Tools")})
    python = await create(auth_client, "tech-stacks", {"name": "Python", "icon_svg": ICON, "color": "#3776AB"})
    docker = await create(auth_client, "tech-stacks", {"name": "Docker", "icon_svg": ICON, "color": "#2496ED"})

    assert (await auth_client.get(f"{API}/tech-showcase")).json() == {"filters": [], "tech_ids": []}

    body = {
        "filters": [{"kind": "instrument", "id": tools["id"]}, {"kind": "field", "id": backend["id"]}],
        "tech_ids": [docker["id"], python["id"]],
    }
    response = await auth_client.put(f"{API}/tech-showcase", json=body)
    assert response.status_code == 200, response.text
    assert response.json() == body
    assert (await auth_client.get(f"{API}/tech-showcase")).json() == body

    # Shown items count as "in use".
    assert (await auth_client.delete(f"/api/v1/admin/selectors/tech-stacks/{python['id']}")).status_code == 409

    # Removing from the showcase frees them again.
    response = await auth_client.put(f"{API}/tech-showcase", json={"filters": [], "tech_ids": [docker["id"]]})
    assert response.json() == {"filters": [], "tech_ids": [docker["id"]]}
    assert (await auth_client.delete(f"/api/v1/admin/selectors/tech-stacks/{python['id']}")).status_code == 204


async def test_tech_showcase_needs_at_least_one_technology(auth_client):
    response = await auth_client.put(f"{API}/tech-showcase", json={"filters": [], "tech_ids": []})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "tech_ids"]


async def test_tech_showcase_rejects_unknown_ids(auth_client):
    unknown = "00000000-0000-4000-8000-000000000000"
    python = await create(auth_client, "tech-stacks", {"name": "Go", "icon_svg": ICON, "color": "#00ADD8"})
    response = await auth_client.put(
        f"{API}/tech-showcase",
        json={"filters": [{"kind": "field", "id": unknown}], "tech_ids": [python["id"], unknown]},
    )
    locs = [e["loc"] for e in response.json()["detail"]]
    assert ["body", "filters", 0] in locs
    assert ["body", "tech_ids", 1] in locs
