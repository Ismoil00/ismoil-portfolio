"""Selectors page: the reusable lists (development fields, instruments, tech stacks, companies,
institutes, product types, link platforms)."""

import pytest

from tests.integration_api.test_media_api import png

BASE = "/api/v1/admin/selectors"
ICON = '<svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>'


def i18n(en: str, ru: str | None = None, tg: str | None = None) -> dict[str, str]:
    return {"en": en, "ru": ru or f"{en} (ru)", "tg": tg or f"{en} (tg)"}


SAMPLES = {
    "development-fields": ({"name": i18n("Backend"), "icon_svg": ICON}, {"name": i18n("Back-end")}),
    "instruments": ({"name": i18n("Tools"), "icon_svg": None}, {"name": i18n("Dev tools"), "icon_svg": ICON}),
    "tech-stacks": (
        {"name": "Python", "icon_svg": ICON, "color": "#3776ab", "docs_url": "https://docs.python.org/3/"},
        {"name": "Python 3", "icon_svg": ICON, "color": "#3776AB", "docs_url": None},
    ),
    "companies": ({"name": "Smartpay", "website_url": "https://smartpay.example"}, {"name": "Smartpay LLC"}),
    "institutes": ({"name": i18n("Tajik Technical University")}, {"name": i18n("TTU")}),
    "product-types": ({"name": i18n("Web"), "icon_svg": ICON}, {"name": i18n("Website"), "icon_svg": ICON}),
    "link-platforms": ({"name": "GitHub", "icon_svg": ICON, "color": "#181717"}, {"name": "GitHub", "color": None}),
}


async def create(client, kind: str, payload: dict) -> dict:
    response = await client.post(f"{BASE}/{kind}", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("kind", SAMPLES)
async def test_create_list_update_delete(auth_client, kind):
    created_payload, updated_payload = SAMPLES[kind]
    item = await create(auth_client, kind, created_payload)
    assert item["id"]
    assert item["usage"] == {}

    listed = (await auth_client.get(f"{BASE}/{kind}")).json()
    assert [i["id"] for i in listed] == [item["id"]]

    response = await auth_client.put(f"{BASE}/{kind}/{item['id']}", json=updated_payload)
    assert response.status_code == 200, response.text
    assert response.json()["name"] == updated_payload["name"]

    assert (await auth_client.delete(f"{BASE}/{kind}/{item['id']}")).status_code == 204
    assert (await auth_client.get(f"{BASE}/{kind}")).json() == []
    assert (await auth_client.delete(f"{BASE}/{kind}/{item['id']}")).status_code == 404


async def test_selectors_require_a_session(client):
    assert (await client.get(f"{BASE}/companies")).status_code == 401


async def test_there_is_no_positions_list_any_more(auth_client):
    """Testimonials name a development field or a technology instead ("Python development")."""
    assert (await auth_client.get(f"{BASE}/positions")).status_code == 404


async def test_icons_are_sanitized_on_save(auth_client):
    dirty = '<svg viewBox="0 0 1 1" onload="alert(1)"><script>x</script><path d="M0 0h1v1z"/></svg>'
    item = await create(auth_client, "product-types", {"name": i18n("Game"), "icon_svg": dirty})
    assert "script" not in item["icon_svg"] and "onload" not in item["icon_svg"]
    assert "<path" in item["icon_svg"]


@pytest.mark.parametrize(
    ("kind", "payload", "loc"),
    [
        ("development-fields", {"name": {"en": "Dev", "ru": "", "tg": "Dev"}}, ["body", "name", "ru"]),
        ("product-types", {"name": i18n("Web"), "icon_svg": "<html/>"}, ["body", "icon_svg"]),
        ("product-types", {"name": i18n("Web")}, ["body", "icon_svg"]),
        ("tech-stacks", {"name": "Go", "icon_svg": ICON, "color": "blue"}, ["body", "color"]),
        ("companies", {"name": "X", "website_url": "javascript:alert(1)"}, ["body", "website_url"]),
        ("companies", {"name": "", "website_url": None}, ["body", "name"]),
        ("link-platforms", {"name": "x" * 101}, ["body", "name"]),
    ],
)
async def test_validation_errors_point_at_the_field(auth_client, kind, payload, loc):
    response = await auth_client.post(f"{BASE}/{kind}", json=payload)
    assert response.status_code == 422
    assert loc in [e["loc"] for e in response.json()["detail"]]


async def test_names_must_be_unique_ignoring_case(auth_client):
    await create(auth_client, "companies", {"name": "Vatan ICT"})
    response = await auth_client.post(f"{BASE}/companies", json={"name": "vatan ict"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "name"]

    await create(auth_client, "development-fields", {"name": i18n("Mobile development")})
    response = await auth_client.post(f"{BASE}/development-fields", json={"name": i18n("MOBILE DEVELOPMENT")})
    assert response.json()["detail"][0]["loc"] == ["body", "name", "en"]


async def test_tech_stack_categories_keep_their_order(auth_client):
    backend = await create(auth_client, "development-fields", {"name": i18n("Backend")})
    frontend = await create(auth_client, "development-fields", {"name": i18n("Frontend")})
    tools = await create(auth_client, "instruments", {"name": i18n("Languages")})
    tech = await create(
        auth_client,
        "tech-stacks",
        {
            "name": "TypeScript",
            "icon_svg": ICON,
            "color": "#3178C6",
            "field_ids": [frontend["id"], backend["id"]],
            "instrument_ids": [tools["id"]],
        },
    )
    assert tech["field_ids"] == [frontend["id"], backend["id"]]
    assert tech["instrument_ids"] == [tools["id"]]

    fields = {f["id"]: f for f in (await auth_client.get(f"{BASE}/development-fields")).json()}
    assert fields[backend["id"]]["usage"] == {"tech_stacks": 1}


async def test_unknown_or_repeated_references_are_refused(auth_client):
    payload = {
        "name": "Rust",
        "icon_svg": ICON,
        "color": "#000000",
        "field_ids": ["00000000-0000-4000-8000-000000000000"],
    }
    response = await auth_client.post(f"{BASE}/tech-stacks", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "field_ids", 0]

    field = await create(auth_client, "development-fields", {"name": i18n("Systems")})
    payload["field_ids"] = [field["id"], field["id"]]
    assert (await auth_client.post(f"{BASE}/tech-stacks", json=payload)).status_code == 422


async def test_items_in_use_cannot_be_deleted(auth_client):
    field = await create(auth_client, "development-fields", {"name": i18n("Databases")})
    await create(
        auth_client,
        "tech-stacks",
        {"name": "PostgreSQL", "icon_svg": ICON, "color": "#4169E1", "field_ids": [field["id"]]},
    )
    response = await auth_client.delete(f"{BASE}/development-fields/{field['id']}")
    assert response.status_code == 409
    assert response.json()["usage"] == {"tech_stacks": 1}


async def test_reorder(auth_client):
    kind = "development-fields"
    ids = [(await create(auth_client, kind, {"name": i18n(f"Field {n}")}))["id"] for n in range(3)]
    new_order = [ids[2], ids[0], ids[1]]
    response = await auth_client.put(f"{BASE}/{kind}/order", json={"ids": new_order})
    assert response.status_code == 204
    assert [p["id"] for p in (await auth_client.get(f"{BASE}/{kind}")).json()] == new_order
    # Every item must be listed exactly once.
    assert (await auth_client.put(f"{BASE}/{kind}/order", json={"ids": ids[:2]})).status_code == 422


async def test_company_logo_upload_link_and_replace(auth_client, storage_dir):
    async def upload_logo() -> dict:
        files = {"file": ("logo.png", png(), "image/png")}
        response = await auth_client.post("/api/v1/admin/media", data={"purpose": "logo"}, files=files)
        assert response.status_code == 201, response.text
        return response.json()

    first = await upload_logo()
    company = await create(auth_client, "companies", {"name": "Pamir", "logo_id": first["id"]})
    assert company["logo"]["url"] == first["url"]

    # The same file can't be the logo of two companies.
    response = await auth_client.post(f"{BASE}/companies", json={"name": "Other", "logo_id": first["id"]})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "logo_id"]

    # Replacing the logo deletes the old file.
    second = await upload_logo()
    response = await auth_client.put(
        f"{BASE}/companies/{company['id']}", json={"name": "Pamir", "logo_id": second["id"]}
    )
    assert response.json()["logo"]["id"] == second["id"]
    assert len(list(storage_dir.rglob("*.png"))) == 1

    # Removing it deletes that file too.
    response = await auth_client.put(f"{BASE}/companies/{company['id']}", json={"name": "Pamir", "logo_id": None})
    assert response.json()["logo"] is None
    assert not list(storage_dir.rglob("*.png"))


async def test_deleting_a_company_deletes_its_logo_file(auth_client, storage_dir):
    files = {"file": ("logo.png", png(), "image/png")}
    logo = (await auth_client.post("/api/v1/admin/media", data={"purpose": "logo"}, files=files)).json()
    company = await create(auth_client, "companies", {"name": "Helio", "logo_id": logo["id"]})
    assert (await auth_client.delete(f"{BASE}/companies/{company['id']}")).status_code == 204
    assert not list(storage_dir.rglob("*.png"))


async def test_wrong_kind_of_file_cannot_be_a_logo(auth_client):
    files = {"file": ("shot.png", png(), "image/png")}
    shot = (await auth_client.post("/api/v1/admin/media", data={"purpose": "project_image"}, files=files)).json()
    response = await auth_client.post(f"{BASE}/companies", json={"name": "Nope", "logo_id": shot["id"]})
    assert response.status_code == 422
