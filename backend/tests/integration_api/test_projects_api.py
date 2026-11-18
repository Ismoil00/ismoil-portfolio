"""Projects: slug, client, traffic, private ⇔ no links, gallery limits and cover (an image or a video),
rich-text description, cleanup of files."""

import pytest

from tests.integration_api import factories as f

URL = "/api/v1/admin/projects"
DESCRIPTION = "<p>Exports <strong>colors</strong> and fonts.</p><ul><li>Second point</li></ul>"


async def payload(client, **overrides) -> dict:
    web = overrides.pop("type", None) or await f.product_type(client)
    tech = overrides.pop("tech", None) or await f.tech(client)
    return {
        "title": f.i18n("Design tokens plugin"),
        "description": f.i18n(DESCRIPTION),
        "start": "2021-10",
        "end": "2021-12",
        "client_kind": "self",
        "company_id": None,
        "traffic": "under100",
        "live_url": "https://example.com/demo",
        "repo_url": None,
        "is_private": False,
        "type_ids": [web["id"]],
        "tech_ids": [tech["id"]],
        "media_ids": [],
        "cover_id": None,
        **overrides,
    }


async def test_create_read_update_delete(auth_client):
    body = await payload(auth_client)
    created = await auth_client.post(URL, json=body)
    assert created.status_code == 201, created.text
    project = created.json()
    assert project["slug"] == "design-tokens-plugin"
    assert project["description"]["en"] == DESCRIPTION
    assert project["type_ids"] == body["type_ids"] and project["tech_ids"] == body["tech_ids"]
    assert (await auth_client.get(f"{URL}/{project['id']}")).json() == project

    body["title"] = f.i18n("Tokens plugin")
    updated = (await auth_client.put(f"{URL}/{project['id']}", json=body)).json()
    assert updated["title"]["en"] == "Tokens plugin"
    assert updated["slug"] == "design-tokens-plugin"  # the URL doesn't change by itself

    assert (await auth_client.delete(f"{URL}/{project['id']}")).status_code == 204
    assert (await auth_client.get(f"{URL}/{project['id']}")).status_code == 404


async def test_slugs_are_unique_and_editable(auth_client):
    web = await f.product_type(auth_client)
    tech = await f.tech(auth_client)
    first = (await auth_client.post(URL, json=await payload(auth_client, type=web, tech=tech))).json()
    second = (await auth_client.post(URL, json=await payload(auth_client, type=web, tech=tech))).json()
    assert second["slug"] == "design-tokens-plugin-2"
    taken = await auth_client.post(URL, json=await payload(auth_client, type=web, tech=tech, slug=first["slug"]))
    assert taken.status_code == 422
    assert taken.json()["detail"][0]["loc"] == ["body", "slug"]
    bad = await auth_client.post(URL, json=await payload(auth_client, type=web, tech=tech, slug="Not A Slug!"))
    assert ["body", "slug"] in [e["loc"] for e in bad.json()["detail"]]


async def test_client_kinds(auth_client):
    web = await f.product_type(auth_client)
    tech = await f.tech(auth_client)
    company = await f.company(auth_client)
    ok = await auth_client.post(
        URL, json=await payload(auth_client, type=web, tech=tech, client_kind="company", company_id=company["id"])
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["company"]["name"] == "Smartpay"
    missing = await auth_client.post(URL, json=await payload(auth_client, type=web, tech=tech, client_kind="company"))
    assert missing.json()["detail"][0]["loc"] == ["body", "company_id"]
    extra = await auth_client.post(
        URL, json=await payload(auth_client, type=web, tech=tech, client_kind="private", company_id=company["id"])
    )
    assert extra.json()["detail"][0]["loc"] == ["body", "company_id"]


async def test_private_projects_have_no_links_and_no_media(auth_client):
    web = await f.product_type(auth_client)
    tech = await f.tech(auth_client)
    private = await auth_client.post(
        URL, json=await payload(auth_client, type=web, tech=tech, live_url=None, is_private=True)
    )
    assert private.status_code == 201, private.text

    no_links_not_private = await auth_client.post(
        URL, json=await payload(auth_client, type=web, tech=tech, live_url=None)
    )
    assert no_links_not_private.json()["detail"][0]["loc"] == ["body", "is_private"]

    private_with_link = await auth_client.post(
        URL, json=await payload(auth_client, type=web, tech=tech, is_private=True)
    )
    assert ["body", "live_url"] in [e["loc"] for e in private_with_link.json()["detail"]]

    image = await f.upload(auth_client, "project_image")
    private_with_media = await auth_client.post(
        URL,
        json=await payload(auth_client, type=web, tech=tech, live_url=None, is_private=True, media_ids=[image["id"]]),
    )
    assert private_with_media.json()["detail"][0]["loc"] == ["body", "media_ids"]


async def test_gallery_order_cover_and_limits(auth_client):
    web = await f.product_type(auth_client)
    tech = await f.tech(auth_client)
    images = [await f.upload(auth_client, "project_image") for _ in range(3)]
    video = await f.upload(auth_client, "project_video", video=True)
    media_ids = [video["id"], images[2]["id"], images[0]["id"]]
    project = (
        await auth_client.post(
            URL, json=await payload(auth_client, type=web, tech=tech, media_ids=media_ids, cover_id=images[0]["id"])
        )
    ).json()
    assert [m["id"] for m in project["media"]] == media_ids
    assert project["media"][0]["poster_url"]
    assert project["cover_id"] == images[0]["id"]

    # A video can be the cover too (the site plays it right from the card).
    by_video = await auth_client.put(
        f"{URL}/{project['id']}",
        json=await payload(auth_client, type=web, tech=tech, media_ids=media_ids, cover_id=video["id"]),
    )
    assert by_video.status_code == 200, by_video.text
    assert by_video.json()["cover_id"] == video["id"]

    # The cover must be one of the gallery's files.
    bad_cover = await auth_client.post(
        URL, json=await payload(auth_client, type=web, tech=tech, media_ids=[images[1]["id"]], cover_id=images[0]["id"])
    )
    assert bad_cover.json()["detail"][0]["loc"] == ["body", "cover_id"]

    # Files can't be shared between projects.
    shared = await auth_client.post(
        URL, json=await payload(auth_client, type=web, tech=tech, media_ids=[images[2]["id"]])
    )
    assert shared.json()["detail"][0]["loc"] == ["body", "media_ids", 0]

    # At most 2 videos.
    videos = [await f.upload(auth_client, "project_video", video=True) for _ in range(3)]
    too_many = await auth_client.post(
        URL, json=await payload(auth_client, type=web, tech=tech, media_ids=[v["id"] for v in videos])
    )
    assert too_many.json()["detail"][0]["loc"] == ["body", "media_ids"]


async def test_at_most_ten_images(auth_client):
    web = await f.product_type(auth_client)
    tech = await f.tech(auth_client)
    images = [await f.upload(auth_client, "project_image") for _ in range(11)]
    response = await auth_client.post(
        URL, json=await payload(auth_client, type=web, tech=tech, media_ids=[i["id"] for i in images])
    )
    assert response.status_code == 422
    assert ["body", "media_ids"] in [e["loc"] for e in response.json()["detail"]]


async def test_removed_media_files_are_deleted(auth_client, storage_dir):
    web = await f.product_type(auth_client)
    tech = await f.tech(auth_client)
    first, second = [await f.upload(auth_client, "project_image") for _ in range(2)]
    body = await payload(auth_client, type=web, tech=tech, media_ids=[first["id"], second["id"]])
    project = (await auth_client.post(URL, json=body)).json()
    assert len(list(storage_dir.rglob("*.png"))) == 2

    body["media_ids"] = [second["id"]]
    await auth_client.put(f"{URL}/{project['id']}", json=body)
    assert len(list(storage_dir.rglob("*.png"))) == 1

    await auth_client.delete(f"{URL}/{project['id']}")
    assert not list(storage_dir.rglob("*.png"))


@pytest.mark.parametrize(
    ("override", "loc"),
    [
        ({"type_ids": []}, ["body", "type_ids"]),
        ({"tech_ids": []}, ["body", "tech_ids"]),
        ({"end": None}, ["body", "end"]),
        ({"start": "2022-01", "end": "2021-12"}, ["body", "end"]),
        ({"traffic": "lots"}, ["body", "traffic"]),
        ({"description": f.i18n("x" * 5001)}, ["body", "description", "en"]),
        ({"live_url": "javascript:alert(1)"}, ["body", "live_url"]),
    ],
)
async def test_validation(auth_client, override, loc):
    response = await auth_client.post(URL, json=await payload(auth_client, **override))
    assert response.status_code == 422
    assert loc in [e["loc"] for e in response.json()["detail"]], response.json()


async def test_description_is_rich_text_cleaned_like_experience(auth_client):
    html = (
        "<p>Built <em>fast</em>.<script>alert(1)</script></p>"
        '<ol><li><a href="https://example.com" onclick="x()">Demo</a></li></ol>'
    )
    project = (await auth_client.post(URL, json=await payload(auth_client, description=f.i18n(html)))).json()
    saved = project["description"]["en"]
    assert "<script" not in saved and "onclick" not in saved
    assert saved.startswith("<p>Built <em>fast</em>.")
    assert 'href="https://example.com"' in saved and 'target="_blank"' in saved

    # The 5000 limit counts the visible text, not the tags.
    same = lambda text: {"en": text, "ru": text, "tg": text}  # noqa: E731
    web, tech = await f.product_type(auth_client, "Tool"), await f.tech(auth_client, "Go")
    fits = await payload(
        auth_client, type=web, tech=tech, title=f.i18n("Long"), description=same(f"<p><b>{'x' * 5000}</b></p>")
    )
    assert (await auth_client.post(URL, json=fits)).status_code == 201
    too_long = await payload(
        auth_client, type=web, tech=tech, title=f.i18n("Longer"), description=same(f"<p>{'x' * 5001}</p>")
    )
    response = await auth_client.post(URL, json=too_long)
    assert ["body", "description", "en"] in [e["loc"] for e in response.json()["detail"]]
