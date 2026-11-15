"""Testimonials and certificates."""

import pytest

from tests.integration_api import factories as f

TESTIMONIALS = "/api/v1/admin/testimonials"
CERTIFICATES = "/api/v1/admin/certificates"
PROJECTS = "/api/v1/admin/projects"
EXPERIENCES = "/api/v1/admin/experiences"


async def make_testimonial(client, **overrides) -> dict:
    company = overrides.pop("company", None) or await f.company(client, "Pixel Forge")
    position = overrides.pop("position", None) or await f.position(client)
    return {
        "author_name": f.i18n("Timur Saidov"),
        "author_role": f.i18n("Studio Director"),
        "company_id": company["id"],
        "position_id": position["id"],
        "given_on": "2020-01-15",
        "quote": f.i18n("He carried a huge part of it."),
        "media_id": None,
        "verify_url": "https://www.linkedin.com/in/someone",
        "project_ids": [],
        **overrides,
    }


async def test_testimonial_crud_with_media(auth_client, storage_dir):
    photo = await f.upload(auth_client, "testimonial_image")
    body = await make_testimonial(auth_client, media_id=photo["id"])
    created = await auth_client.post(TESTIMONIALS, json=body)
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["company"]["name"] == "Pixel Forge"
    assert item["position"]["name"]["en"] == "Full-stack developer"
    assert item["media"]["id"] == photo["id"]
    assert item["given_on"] == "2020-01-15"

    video = await f.upload(auth_client, "testimonial_video", video=True)
    body["media_id"] = video["id"]
    updated = (await auth_client.put(f"{TESTIMONIALS}/{item['id']}", json=body)).json()
    assert updated["media"]["poster_url"]
    assert not list(storage_dir.rglob("testimonial_image/*"))  # the replaced photo is gone

    assert (await auth_client.delete(f"{TESTIMONIALS}/{item['id']}")).status_code == 204
    assert not list(storage_dir.rglob("*.mp4"))


@pytest.mark.parametrize(
    ("override", "loc"),
    [
        ({"verify_url": None}, ["body", "verify_url"]),
        ({"given_on": "2999-01-01"}, ["body", "given_on"]),
        ({"author_name": f.i18n("x" * 101)}, ["body", "author_name", "en"]),
        ({"quote": f.i18n("x" * 1001)}, ["body", "quote", "en"]),
        ({"company_id": None}, ["body", "company_id"]),
        ({"position_id": None}, ["body", "position_id"]),
    ],
)
async def test_testimonial_validation(auth_client, override, loc):
    response = await auth_client.post(TESTIMONIALS, json=await make_testimonial(auth_client, **override))
    assert response.status_code == 422
    assert loc in [e["loc"] for e in response.json()["detail"]], response.json()


async def test_quote_is_optional_and_media_kind_is_checked(auth_client):
    company = await f.company(auth_client, "Quanta")
    position = await f.position(auth_client)
    ok = await auth_client.post(
        TESTIMONIALS, json=await make_testimonial(auth_client, company=company, position=position, quote=None)
    )
    assert ok.status_code == 201
    shot = await f.upload(auth_client, "project_image")
    wrong = await auth_client.post(
        TESTIMONIALS,
        json=await make_testimonial(auth_client, company=company, position=position, media_id=shot["id"]),
    )
    assert wrong.json()["detail"][0]["loc"] == ["body", "media_id"]


async def test_links_between_projects_testimonials_and_experience(auth_client):
    web = await f.product_type(auth_client)
    tech = await f.tech(auth_client)
    company = await f.company(auth_client, "Vatan")
    project_body = {
        "title": f.i18n("Search portal"), "description": f.i18n("About it."), "start": "2023-01", "end": "2024-01",
        "client_kind": "company", "company_id": company["id"], "traffic": "from10k", "live_url": None, "repo_url": None,
        "is_private": True, "type_ids": [web["id"]], "tech_ids": [tech["id"]], "media_ids": [], "cover_id": None,
    }  # fmt: skip
    project = (await auth_client.post(PROJECTS, json=project_body)).json()
    testimonial = (
        await auth_client.post(TESTIMONIALS, json=await make_testimonial(auth_client, project_ids=[project["id"]]))
    ).json()
    assert testimonial["project_ids"] == [project["id"]]

    experience_body = {
        "title": f.i18n("Developer"), "company_id": company["id"], "start": "2023-01", "end": "2024-01", "is_current": False,
        "description": f.rich("Work"), "tech_ids": [tech["id"]], "project_ids": [project["id"]], "testimonial_ids": [testimonial["id"]],
    }  # fmt: skip
    assert (await auth_client.post(EXPERIENCES, json=experience_body)).status_code == 201

    # Linked items can't be deleted until the links are removed.
    blocked = await auth_client.delete(f"{PROJECTS}/{project['id']}")
    assert blocked.status_code == 409
    assert blocked.json()["usage"] == {"experiences": 1, "testimonials": 1}
    assert (await auth_client.delete(f"{TESTIMONIALS}/{testimonial['id']}")).status_code == 409


async def certificate_payload(client, **overrides) -> dict:
    institute = overrides.pop("institute", None) or await f.institute(client)
    images = overrides.pop("images", None) or [await f.upload(client, "certificate_image")]
    return {
        "title": f.i18n("Bachelor's degree"),
        "institute_id": institute["id"],
        "start": "2016-09",
        "end": "2020-06",
        "verify_url": "https://example.com/verify/123",
        "field_ids": [],
        "image_ids": [i["id"] for i in images],
        **overrides,
    }


async def test_certificate_crud(auth_client, storage_dir):
    images = [await f.upload(auth_client, "certificate_image") for _ in range(2)]
    field = await f.field(auth_client, "Civil engineering")
    body = await certificate_payload(auth_client, images=images, field_ids=[field["id"]])
    created = await auth_client.post(CERTIFICATES, json=body)
    assert created.status_code == 201, created.text
    item = created.json()
    assert [i["id"] for i in item["images"]] == [i["id"] for i in images]
    assert item["institute"]["name"]["en"] == "Tajik Technical University"
    assert item["field_ids"] == [field["id"]]

    body["image_ids"] = [images[1]["id"]]
    await auth_client.put(f"{CERTIFICATES}/{item['id']}", json=body)
    assert len(list(storage_dir.rglob("certificate_image/*"))) == 1

    assert (await auth_client.delete(f"{CERTIFICATES}/{item['id']}")).status_code == 204
    assert not list(storage_dir.rglob("certificate_image/*"))


@pytest.mark.parametrize(
    ("override", "loc"),
    [
        ({"image_ids": []}, ["body", "image_ids"]),
        ({"end": None}, ["body", "end"]),
        ({"start": "2021-01", "end": "2020-06"}, ["body", "end"]),
        ({"verify_url": "not a link"}, ["body", "verify_url"]),
        ({"title": f.i18n("x" * 201)}, ["body", "title", "en"]),
    ],
)
async def test_certificate_validation(auth_client, override, loc):
    response = await auth_client.post(CERTIFICATES, json=await certificate_payload(auth_client, **override))
    assert response.status_code == 422
    assert loc in [e["loc"] for e in response.json()["detail"]], response.json()


async def test_at_most_five_certificate_images(auth_client):
    images = [await f.upload(auth_client, "certificate_image") for _ in range(6)]
    response = await auth_client.post(CERTIFICATES, json=await certificate_payload(auth_client, images=images))
    assert response.status_code == 422
    assert ["body", "image_ids"] in [e["loc"] for e in response.json()["detail"]]
