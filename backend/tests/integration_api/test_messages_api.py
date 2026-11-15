"""The public contact form (the only write the public site makes) and the admin messages table."""

import pytest

from tests.integration_api.conftest import make_client

CONTACT = "/api/v1/public/contact"
MESSAGES = "/api/v1/admin/messages"
VALID = {"name": "Jane Doe", "contact": "jane@company.com", "message": "Hello! Are you open to a role?"}


async def test_message_is_saved_and_listed_for_the_admin(app, auth_client):
    async with make_client(app, ip="203.0.113.5") as visitor:
        response = await visitor.post(CONTACT, json=VALID)
    assert response.status_code == 201, response.text

    page = (await auth_client.get(MESSAGES)).json()
    assert page["total"] == 1
    item = page["items"][0]
    assert {k: item[k] for k in ("name", "contact", "message")} == VALID
    assert item["created_at"]
    assert "ip_hash" not in item


async def test_whatsapp_numbers_are_accepted(client):
    response = await client.post(CONTACT, json={**VALID, "contact": "+992 209 53 80 80"})
    assert response.status_code == 201


@pytest.mark.parametrize(
    ("override", "loc"),
    [
        ({"name": ""}, ["body", "name"]),
        ({"name": "x" * 101}, ["body", "name"]),
        ({"contact": "not a contact"}, ["body", "contact"]),
        ({"message": "   "}, ["body", "message"]),
        ({"message": "x" * 2001}, ["body", "message"]),
    ],
)
async def test_contact_form_validation(client, override, loc):
    response = await client.post(CONTACT, json={**VALID, **override})
    assert response.status_code == 422
    assert loc in [e["loc"] for e in response.json()["detail"]]


async def test_html_is_stored_as_plain_text(auth_client, client):
    await client.post(CONTACT, json={**VALID, "message": "<script>alert(1)</script> hi"})
    item = (await auth_client.get(MESSAGES)).json()["items"][0]
    assert item["message"] == "<script>alert(1)</script> hi"  # kept as text; React escapes it when shown


async def test_bots_filling_the_hidden_field_are_ignored(auth_client, client):
    response = await client.post(CONTACT, json={**VALID, "website": "https://spam.example"})
    assert response.status_code == 201  # looks accepted…
    assert (await auth_client.get(MESSAGES)).json()["total"] == 0  # …but nothing is saved


async def test_contact_form_is_rate_limited_per_visitor(app, settings):
    async with make_client(app, ip="203.0.113.77") as visitor:
        for _ in range(settings.contact_max_per_hour):
            assert (await visitor.post(CONTACT, json=VALID)).status_code == 201
        response = await visitor.post(CONTACT, json=VALID)
        assert response.status_code == 429
        assert int(response.headers["retry-after"]) > 0
    async with make_client(app, ip="203.0.113.78") as other:
        assert (await other.post(CONTACT, json=VALID)).status_code == 201


async def test_messages_are_private_and_can_be_deleted(client, auth_client):
    await client.post(CONTACT, json=VALID)
    assert (await client.get(MESSAGES)).status_code == 401

    item = (await auth_client.get(MESSAGES)).json()["items"][0]
    assert (await auth_client.delete(f"{MESSAGES}/{item['id']}")).status_code == 204
    assert (await auth_client.get(MESSAGES)).json()["total"] == 0
    assert (await auth_client.delete(f"{MESSAGES}/{item['id']}")).status_code == 404


async def test_messages_are_newest_first_and_paged(client, auth_client):
    for n in range(3):
        await client.post(CONTACT, json={**VALID, "name": f"Person {n}"})
    page = (await auth_client.get(MESSAGES, params={"offset": 0, "limit": 2})).json()
    assert page["total"] == 3
    assert [m["name"] for m in page["items"]] == ["Person 2", "Person 1"]


async def test_contact_form_has_a_site_wide_limit(app, settings):
    """Messages from many (possibly faked) addresses still hit an overall hourly cap."""
    for n in range(settings.contact_max_per_hour_global):
        async with make_client(app, ip=f"198.51.100.{n + 1}") as visitor:
            assert (await visitor.post(CONTACT, json=VALID)).status_code == 201
    async with make_client(app, ip="198.51.100.250") as late:
        assert (await late.post(CONTACT, json=VALID)).status_code == 429
