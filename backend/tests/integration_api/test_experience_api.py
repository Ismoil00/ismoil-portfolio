"""Experience entries: dates and the single "present" job, references, rich-text description."""

import pytest

from tests.integration_api import factories as f

URL = "/api/v1/admin/experiences"


async def payload(client, **overrides) -> dict:
    company = overrides.pop("company", None) or await f.company(client)
    tech = overrides.pop("tech", None) or await f.tech(client)
    return {
        "title": f.i18n("Full-stack developer"),
        "company_id": company["id"],
        "start": "2024-03",
        "end": "2025-08",
        "is_current": False,
        "description": f.rich("Built things"),
        "tech_ids": [tech["id"]],
        **overrides,
    }


async def test_create_read_update_delete(auth_client):
    body = await payload(auth_client)
    field = await f.field(auth_client)
    body["field_ids"] = [field["id"]]
    created = await auth_client.post(URL, json=body)
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["company"]["name"] == "Smartpay"
    assert (item["start"], item["end"], item["is_current"]) == ("2024-03", "2025-08", False)
    assert item["tech_ids"] == body["tech_ids"]
    assert item["field_ids"] == [field["id"]]
    assert item["project_ids"] == [] and item["testimonial_ids"] == []

    assert (await auth_client.get(f"{URL}/{item['id']}")).json() == item
    assert [e["id"] for e in (await auth_client.get(URL)).json()] == [item["id"]]

    body["title"] = f.i18n("Lead developer")
    updated = await auth_client.put(f"{URL}/{item['id']}", json=body)
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"]["en"] == "Lead developer"

    assert (await auth_client.delete(f"{URL}/{item['id']}")).status_code == 204
    assert (await auth_client.get(f"{URL}/{item['id']}")).status_code == 404


async def test_description_is_sanitized_rich_text(auth_client):
    body = await payload(auth_client)
    body["description"] = {
        lang: '<p onclick="x()"><strong>Led</strong> a team<script>alert(1)</script></p><ul><li>one</li></ul>'
        for lang in ("en", "ru", "tg")
    }
    item = (await auth_client.post(URL, json=body)).json()
    assert item["description"]["en"] == "<p><strong>Led</strong> a team</p><ul><li>one</li></ul>"


async def test_description_limit_counts_visible_text(auth_client):
    body = await payload(auth_client)
    body["description"] = {lang: "<p>" + "a" * 5001 + "</p>" for lang in ("en", "ru", "tg")}
    response = await auth_client.post(URL, json=body)
    assert response.status_code == 422
    assert ["body", "description", "en"] in [e["loc"] for e in response.json()["detail"]]


@pytest.mark.parametrize(
    ("override", "loc"),
    [
        ({"end": None}, ["body", "end"]),  # not present → end required
        ({"is_current": True}, ["body", "end"]),  # present → no end
        ({"start": "2025-09", "end": "2025-08"}, ["body", "end"]),  # end before start
        ({"start": "2999-01"}, ["body", "start"]),  # future
        ({"tech_ids": []}, ["body", "tech_ids"]),  # at least one technology
        ({"title": f.i18n("x" * 201)}, ["body", "title", "en"]),
    ],
)
async def test_validation(auth_client, override, loc):
    response = await auth_client.post(URL, json=await payload(auth_client, **override))
    assert response.status_code == 422
    assert loc in [e["loc"] for e in response.json()["detail"]], response.json()


async def test_only_one_job_can_be_present(auth_client):
    company = await f.company(auth_client)
    tech = await f.tech(auth_client)
    first = await auth_client.post(
        URL, json=await payload(auth_client, company=company, tech=tech, end=None, is_current=True)
    )
    assert first.status_code == 201, first.text
    second = await auth_client.post(
        URL, json=await payload(auth_client, company=company, tech=tech, end=None, is_current=True)
    )
    assert second.status_code == 422
    assert second.json()["detail"][0]["loc"] == ["body", "is_current"]
    # Updating the present job itself is fine.
    body = await payload(auth_client, company=company, tech=tech, end=None, is_current=True)
    assert (await auth_client.put(f"{URL}/{first.json()['id']}", json=body)).status_code == 200


async def test_unknown_references_are_refused(auth_client):
    unknown = "00000000-0000-4000-8000-000000000000"
    body = await payload(auth_client)
    body.update(company_id=unknown, project_ids=[unknown], testimonial_ids=[unknown], field_ids=[unknown])
    body["tech_ids"] = [*body["tech_ids"], unknown]
    locs = [e["loc"] for e in (await auth_client.post(URL, json=body)).json()["detail"]]
    for loc in (
        ["body", "company_id"],
        ["body", "tech_ids", 1],
        ["body", "project_ids", 0],
        ["body", "testimonial_ids", 0],
        ["body", "field_ids", 0],
    ):
        assert loc in locs


async def test_newest_first_with_the_present_job_on_top(auth_client):
    company = await f.company(auth_client)
    tech = await f.tech(auth_client)
    old = (
        await auth_client.post(
            URL, json=await payload(auth_client, company=company, tech=tech, start="2019-01", end="2020-01")
        )
    ).json()
    now = (
        await auth_client.post(
            URL, json=await payload(auth_client, company=company, tech=tech, start="2023-01", end=None, is_current=True)
        )
    ).json()
    mid = (
        await auth_client.post(
            URL, json=await payload(auth_client, company=company, tech=tech, start="2021-01", end="2022-12")
        )
    ).json()
    assert [e["id"] for e in (await auth_client.get(URL)).json()] == [now["id"], mid["id"], old["id"]]


async def test_references_block_deleting_selector_items(auth_client):
    body = await payload(auth_client)
    await auth_client.post(URL, json=body)
    response = await auth_client.delete(f"/api/v1/admin/selectors/companies/{body['company_id']}")
    assert response.status_code == 409
    assert response.json()["usage"] == {"experiences": 1}
