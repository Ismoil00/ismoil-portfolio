"""`python -m app.cli seed` loads the real content (backend/seed/content.json) into an empty database."""

import json

import pytest

from app.core.config import BASE_DIR
from app.repositories.media import MediaRepository
from app.repositories.storage import create_storage
from app.services.media import MediaService
from app.services.seed import SeedError, load_seed

SEED = json.loads((BASE_DIR / "seed" / "content.json").read_text(encoding="utf-8"))


async def run_seed(db_session, settings):
    media = MediaService(MediaRepository(db_session), create_storage(settings))
    await load_seed(db_session, media, SEED, repo_root=BASE_DIR.parent)


async def test_seed_loads_everything_and_the_admin_api_reads_it(db_session, settings, auth_client, storage_dir):
    await run_seed(db_session, settings)

    hero = (await auth_client.get("/api/v1/admin/hero")).json()
    assert hero["first_name"]["en"] == "Ismoil"
    assert hero["resume"]["content_type"] == "application/pdf"
    assert len(list(storage_dir.rglob("*.pdf"))) == 1

    about = (await auth_client.get("/api/v1/admin/about")).json()
    assert about["country_code"] == "TJ" and about["open_to_remote"] and about["open_to_relocation"]

    contacts = (await auth_client.get("/api/v1/admin/contacts")).json()
    assert contacts["links"]["whatsapp"]["url"] == "https://wa.me/992209538080"
    assert contacts["linkedin"].startswith("https://www.linkedin.com/in/")

    showcase = (await auth_client.get("/api/v1/admin/tech-showcase")).json()
    assert len(showcase["tech_ids"]) == 43  # the two extra technologies aren't shown in the section
    assert len(showcase["filters"]) == 6

    experiences = (await auth_client.get("/api/v1/admin/experiences")).json()
    assert len(experiences) == 3
    assert all(e["description"]["en"].startswith("<ul><li>") for e in experiences)
    assert all(e["project_ids"] for e in experiences)

    projects = (await auth_client.get("/api/v1/admin/projects")).json()
    assert {p["slug"] for p in projects} == {"gov-platform", "bank-backend", "search-platform"}
    assert all(p["is_private"] and p["traffic"] is None for p in projects)  # traffic is never invented

    certificates = (await auth_client.get("/api/v1/admin/certificates")).json()
    assert len(certificates) == 1 and certificates[0]["verify_url"] is None and certificates[0]["images"] == []

    links = (await auth_client.get("/api/v1/admin/other-links")).json()
    assert [link["platform"]["name"] for link in links] == ["GitHub", "LeetCode", "Roadmap.sh"]

    # Icons went through the SVG sanitizer (no fixed size left on the root).
    techs = (await auth_client.get("/api/v1/admin/selectors/tech-stacks")).json()
    assert all('height="1em"' not in t["icon_svg"] for t in techs)


async def test_seed_refuses_a_database_with_content(db_session, settings, storage_dir):
    await run_seed(db_session, settings)
    with pytest.raises(SeedError):
        await run_seed(db_session, settings)
