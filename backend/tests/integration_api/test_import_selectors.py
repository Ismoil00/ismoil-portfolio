"""`python -m app.cli import-selectors` adds the development fields and technologies from
backend/seed/content.json that a filled database doesn't have yet. It matches by name, never
changes or deletes what is there, and running it again adds nothing."""

import json

from app.core.config import BASE_DIR
from app.services.seed import add_missing_selectors
from tests.integration_api import factories as f

SEED = json.loads((BASE_DIR / "seed" / "content.json").read_text(encoding="utf-8"))
FIELDS = "/api/v1/admin/selectors/development-fields"
TECHS = "/api/v1/admin/selectors/tech-stacks"
INSTRUMENTS = "/api/v1/admin/selectors/instruments"


async def names(client, url: str) -> list[str]:
    return [
        item["name"] if isinstance(item["name"], str) else item["name"]["en"] for item in (await client.get(url)).json()
    ]


def unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    return [v for v in values if not (v.lower() in seen or seen.add(v.lower()))]


async def test_adds_every_field_and_technology_of_the_seed_once(db_session, auth_client):
    added = await add_missing_selectors(db_session, SEED)
    # The seed itself lists "Game development" twice; it is added once.
    assert added.fields == unique([field["name"]["en"] for field in SEED["development_fields"]])
    assert len(added.fields) == len(SEED["development_fields"]) - 1
    assert added.techs == [tech["name"] for tech in SEED["tech_stacks"]]

    again = await add_missing_selectors(db_session, SEED)
    assert again.fields == [] and again.techs == []
    assert len(await names(auth_client, TECHS)) == len(SEED["tech_stacks"])


async def test_existing_items_are_kept_as_they_are_and_new_ones_go_after_them(db_session, auth_client):
    mine = await f.post(
        auth_client, "/selectors/tech-stacks", {"name": "kotlin", "icon_svg": f.ICON, "color": "#123456"}
    )
    elixir = await f.tech(auth_client, "Elixir")  # not in the seed: stays
    await f.post(auth_client, "/selectors/development-fields", {"name": f.i18n("machine learning")})

    added = await add_missing_selectors(db_session, SEED)
    assert "Kotlin" not in added.techs and "Machine learning" not in added.fields  # same name, any letter case

    techs = (await auth_client.get(TECHS)).json()
    assert [t["name"] for t in techs[:2]] == ["kotlin", "Elixir"]
    assert techs[0]["color"] == "#123456" and techs[0]["id"] == mine["id"]
    assert any(t["id"] == elixir["id"] for t in techs)
    assert (await names(auth_client, FIELDS)).count("machine learning") == 1
    assert "Machine learning" not in await names(auth_client, FIELDS)


async def test_new_technologies_get_their_fields_and_instruments(db_session, auth_client):
    for name in ("Languages & frameworks", "Tools"):  # instruments are linked, never added
        await f.post(auth_client, "/selectors/instruments", {"name": f.i18n(name)})
    await add_missing_selectors(db_session, SEED)
    fields = {item["name"]["en"]: item["id"] for item in (await auth_client.get(FIELDS)).json()}
    instruments = {item["name"]["en"]: item["id"] for item in (await auth_client.get(INSTRUMENTS)).json()}
    techs = {t["name"]: t for t in (await auth_client.get(TECHS)).json()}

    assert techs["Swift"]["field_ids"] == [fields["Mobile"]]
    assert techs["Swift"]["instrument_ids"] == [instruments["Languages & frameworks"]]
    assert techs["Kubernetes"]["instrument_ids"] == [instruments["Tools"]]
    # Only the Tech stack page's own choices are shown there; imported ones wait in the list.
    showcase = (await auth_client.get("/api/v1/admin/tech-showcase")).json()
    assert techs["Swift"]["id"] not in showcase["tech_ids"]


async def test_links_to_a_field_the_database_lacks_are_skipped(db_session, auth_client):
    data = {
        "development_fields": [],
        "instruments": SEED["instruments"],
        "tech_stacks": [next(t for t in SEED["tech_stacks"] if t["name"] == "Swift")],
    }
    added = await add_missing_selectors(db_session, data)
    assert added.techs == ["Swift"]
    swift = next(t for t in (await auth_client.get(TECHS)).json() if t["name"] == "Swift")
    assert swift["field_ids"] == [] and swift["instrument_ids"] == []
