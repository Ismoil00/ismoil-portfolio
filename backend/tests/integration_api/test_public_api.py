"""Read-only endpoints of the public site: one language per request, computed values, nothing private."""

import pytest

from tests.integration_api import factories as f
from tests.integration_api.test_seed import SEED, run_seed

P = "/api/v1/public"


@pytest.fixture
async def seeded(db_session, settings, storage_dir):
    await run_seed(db_session, settings)


async def test_profile_in_each_language(client, seeded):
    en = (await client.get(f"{P}/profile", params={"lang": "en"})).json()
    ru = (await client.get(f"{P}/profile", params={"lang": "ru"})).json()
    assert en["firstName"] == "Ismoil" and ru["firstName"] == "Исмоил"
    assert en["fullName"] == "Ismoil Sharifov"
    assert en["role"] == "Full-stack software engineer"
    assert en["availability"] == "seeking"
    assert en["resumeUrl"].endswith(".pdf")
    assert en["about"]["title"] == "Engineer who owns the whole feature"
    assert len(en["about"]["paragraphs"]) == 3  # the second paragraph field holds two
    assert en["about"]["city"] == "Dushanbe" and ru["about"]["city"] == "Душанбе"
    assert en["about"]["countryCode"] == "TJ" and en["about"]["utcOffset"] == "GMT+5"
    assert en["about"]["openToRemote"] and en["about"]["openToRelocation"]
    assert [c["id"] for c in en["contacts"]] == ["email", "telegram", "whatsapp", "linkedin"]
    assert en["email"] == "sharipovismoil01@gmail.com"
    assert [link["label"] for link in en["otherLinks"]] == ["GitHub", "LeetCode", "Roadmap.sh"]
    assert en["otherLinks"][0]["icon"].startswith("<svg")


async def test_profile_stats_are_counted_from_content(client, seeded):
    stats = (await client.get(f"{P}/profile", params={"lang": "en"})).json()["stats"]
    assert stats["roles"] == 3
    assert stats["projects"] == 3
    assert stats["certificates"] == 1
    assert stats["technologies"] == 43  # only the ones shown on the Tech stack section
    # 2023-02 … 2026-06 without overlaps counted twice = 41 months.
    assert stats["experienceMonths"] == 41


async def test_unknown_language_is_refused(client, seeded):
    assert (await client.get(f"{P}/profile", params={"lang": "de"})).status_code == 422


async def test_profile_without_content_is_unavailable(client):
    response = await client.get(f"{P}/profile", params={"lang": "en"})
    assert response.status_code == 503


async def test_skills(client, seeded):
    skills = (await client.get(f"{P}/skills", params={"lang": "ru"})).json()
    instruments = {i["key"]: i["name"]["ru"] for i in SEED["instruments"]}
    fields = {f["key"]: f["name"]["ru"] for f in SEED["development_fields"]}
    assert [c["title"] for c in skills["categories"]][:2] == [instruments["languages"], fields["databases"]]
    assert all(c["icon"].startswith("<svg") for c in skills["categories"])
    assert len(skills["items"]) == 43
    python = next(i for i in skills["items"] if i["name"] == "Python")
    assert python["color"] == "#3776AB" and python["url"].startswith("https://")
    category_ids = {c["id"] for c in skills["categories"]}
    assert python["categories"] and set(python["categories"]) <= category_ids


async def test_experience_list_filters_and_summary(client, seeded):
    page = (await client.get(f"{P}/experience", params={"lang": "en", "offset": 0, "limit": 2})).json()
    assert page["total"] == 3 and len(page["items"]) == 2
    first = page["items"][0]
    assert first["role"] == "Full-stack developer" and first["company"]["name"] == "Smartpay"
    assert first["description"].startswith("<ul><li>")
    assert first["stack"][0]["name"] == "FastAPI" and first["stack"][0]["icon"].startswith("<svg")
    assert first["projects"] == [{"id": "gov-platform", "title": "Government services platform"}]

    vatan = (await client.get(f"{P}/experience", params={"lang": "en", "company": "Vatan ICT"})).json()
    assert vatan["total"] == 2
    filters = (await client.get(f"{P}/experience/filters", params={"lang": "en"})).json()
    assert filters["companies"] == ["Smartpay", "Vatan ICT"]
    assert {f["title"] for f in filters["fields"]} >= {"Backend", "Frontend"}
    by_field = (await client.get(f"{P}/experience", params={"lang": "en", "field": filters["fields"][0]["id"]})).json()
    assert by_field["total"] >= 1
    in_2023 = (await client.get(f"{P}/experience", params={"lang": "en", "from": "2023-01", "to": "2023-12"})).json()
    assert in_2023["total"] == 1

    summary = (await client.get(f"{P}/experience/summary")).json()
    assert summary == {"roles": 3, "months": 41}


async def test_projects(client, seeded, auth_client):
    page = (await client.get(f"{P}/projects", params={"lang": "en", "offset": 0, "limit": 10})).json()
    assert page["total"] == 3
    card = page["items"][0]
    assert card["id"] == "gov-platform"  # newest first
    assert card["types"][0]["title"] == "Web" and card["types"][0]["icon"].startswith("<svg")
    assert len(card["stack"]) <= 3 and card["cover"] is None
    assert card["isPrivate"] is True

    project = (await client.get(f"{P}/projects/gov-platform", params={"lang": "ru"})).json()
    assert project["client"] == {"kind": "company", "name": "Smartpay", "url": None}
    assert project["traffic"] is None  # not set → hidden on the site
    assert project["description"][0]  # paragraphs
    assert (await client.get(f"{P}/projects/nope", params={"lang": "en"})).status_code == 404

    slugs = (await client.get(f"{P}/projects/slugs")).json()
    assert sorted(slugs) == ["bank-backend", "gov-platform", "search-platform"]
    filters = (await client.get(f"{P}/projects/filters", params={"lang": "en"})).json()
    assert filters["clients"] == ["Smartpay", "Vatan ICT"]
    assert [t["title"] for t in filters["types"]] == ["Web"]
    by_type = (await client.get(f"{P}/projects", params={"lang": "en", "type": filters["types"][0]["id"]})).json()
    assert by_type["total"] == 3


async def test_certificates_and_testimonials(client, seeded, auth_client):
    certs = (await client.get(f"{P}/certificates", params={"lang": "en"})).json()
    assert certs["total"] == 1
    cert = certs["items"][0]
    assert cert["issuer"]["name"] == "Tajik Technical University"
    assert cert["images"] == [] and cert["verifyUrl"] is None
    assert cert["fields"][0]["title"]

    # No testimonials yet: the section is hidden on the site.
    assert (await client.get(f"{P}/testimonials", params={"lang": "en"})).json() == {"items": [], "total": 0}

    company = await f.company(auth_client, "Quanta")
    position = await f.position(auth_client, "Mentor")
    projects = (await auth_client.get("/api/v1/admin/projects")).json()
    body = {
        "author_name": f.i18n("Daniel Brooks"), "author_role": f.i18n("CTO"), "company_id": company["id"],
        "position_id": position["id"], "given_on": "2025-04-10", "quote": None, "media_id": None,
        "verify_url": "https://www.linkedin.com/in/someone", "project_ids": [projects[0]["id"]],
    }  # fmt: skip
    assert (await auth_client.post("/api/v1/admin/testimonials", json=body)).status_code == 201
    page = (await client.get(f"{P}/testimonials", params={"lang": "ru"})).json()
    item = page["items"][0]
    assert item["author"] == "Daniel Brooks (ru)" and item["quote"] is None and item["media"] is None
    assert item["date"] == "2025-04-10" and item["myPosition"] == "Mentor (ru)"
    assert item["projects"][0]["href"].startswith("/projects/")
    filters = (await client.get(f"{P}/testimonials/filters")).json()
    assert filters == {"minDate": "2025-04", "maxDate": "2025-04"}


async def test_public_responses_hold_nothing_private(client, seeded):
    for path in ("profile", "skills", "experience", "projects", "certificates", "testimonials"):
        text = (await client.get(f"{P}/{path}", params={"lang": "en"})).text
        for secret in ("ip_hash", "password", "token", "storage_key", "admin"):
            assert secret not in text, (path, secret)


async def test_paging_is_bounded(client, seeded):
    assert (await client.get(f"{P}/projects", params={"lang": "en", "limit": 1000})).status_code == 422
    assert (await client.get(f"{P}/projects", params={"lang": "en", "offset": -1})).status_code == 422
    assert (await client.get(f"{P}/projects", params={"lang": "en", "from": "2024-13"})).status_code == 422
