"""The public site's AI assistant through the API: on and off, the streamed answer, visitor limits by
cookie, address and network, what's kept (counters always, the question only with analytics consent),
and the facts the model is given. Groq is replaced by tests/unit/fakes.py: FakeChatModel."""

import json
import uuid

import pytest
from sqlalchemy import select

from app.main import create_app
from app.models import ChatQuestion, ChatUsage, ContactMessage
from app.repositories.public import PublicRepository
from app.repositories.settings import SettingsRepository
from app.repositories.storage import create_storage
from app.services.chat_prompt import build_facts
from app.services.public import PublicService
from app.services.settings import PanelSettingsService
from tests.integration_api.conftest import _TestDatabase, make_client
from tests.integration_api.test_seed import run_seed
from tests.unit.fakes import FakeChatModel

CHAT = "/api/v1/public/chat"
PROFILE = "/api/v1/public/profile"
ANALYTICS = "/api/v1/admin/analytics"


def question(text="What has Ismoil built?", **extra) -> dict:
    return {"messages": [{"role": "user", "content": text}], "locale": "en", **extra}


def lines(response) -> list[dict]:
    return [json.loads(line) for line in response.text.splitlines() if line]


@pytest.fixture
async def seeded(db_session, settings, storage_dir):
    await run_seed(db_session, settings)


@pytest.fixture
async def assistant(app, db_session, seeded) -> FakeChatModel:
    """The assistant switched on, with a fake model in place of Groq."""
    model = FakeChatModel()
    app.state.chat_model = model
    service = PanelSettingsService(SettingsRepository(db_session), claude_ready=False, assistant_ready=True)
    await service.set_assistant(True)
    return model


# --- on and off -----------------------------------------------------------------------------------


async def test_without_a_groq_key_the_assistant_is_off(client, seeded):
    response = await client.post(CHAT, json=question())
    assert response.status_code == 503
    assert response.json()["code"] == "chat_off"
    assert (await client.get(PROFILE)).json()["chat"] is False


async def test_with_a_key_it_still_waits_for_the_admins_switch(app, client, seeded):
    app.state.chat_model = FakeChatModel()
    assert (await client.post(CHAT, json=question())).json()["code"] == "chat_off"
    assert (await client.get(PROFILE)).json()["chat"] is False


async def test_the_profile_tells_the_site_to_show_the_assistant(client, assistant):
    assert (await client.get(PROFILE)).json()["chat"] is True


# --- the answer -----------------------------------------------------------------------------------


async def test_the_answer_streams_as_lines_and_only_counters_are_kept(client, assistant, db_session):
    response = await client.post(CHAT, json=question(page="/en/projects"))
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/x-ndjson")
    assert response.headers["cache-control"] == "no-store"
    got = lines(response)
    assert "".join(line["text"] for line in got if line["type"] == "text") == assistant.answer
    assert got[-1] == {"type": "done"}

    usage = (await db_session.scalars(select(ChatUsage))).all()
    assert len(usage) == 1
    assert usage[0].model == "openai/gpt-oss-120b" and usage[0].tokens == assistant.tokens
    assert len(usage[0].ip_hash) == len(usage[0].net_hash) == 64 and usage[0].session_hash is None
    assert (await db_session.scalars(select(ChatQuestion))).all() == []  # no consent, no text


async def test_the_model_gets_the_rules_and_the_sites_facts(client, assistant):
    await client.post(CHAT, json=question("Где он живёт?", locale="ru"))
    _, messages, max_tokens = assistant.calls[0]
    system = messages[0]["content"]
    assert "Ismoil Sharifov" in system and "/projects/" in system and "Dushanbe" in system
    assert messages[-1] == {"role": "user", "content": "(Site language: Russian.)\nГде он живёт?"}
    assert max_tokens == 400


@pytest.mark.parametrize(
    "body",
    [
        question("x" * 501),
        question(""),
        {"messages": [], "locale": "en"},
        {"messages": [{"role": "assistant", "content": "Hi"}], "locale": "en"},
        question(locale="de"),
        question(page="https://evil.example"),
        question(extra_field=True),
    ],
)
async def test_bad_questions_are_refused_before_anything_is_asked(client, assistant, body):
    assert (await client.post(CHAT, json=body)).status_code == 422
    assert assistant.calls == []


async def test_a_long_conversation_has_to_start_over(client, assistant):
    history = [{"role": r, "content": "text"} for _ in range(12) for r in ("user", "assistant")]
    response = await client.post(
        CHAT, json={"messages": [*history, {"role": "user", "content": "And?"}], "locale": "en"}
    )
    assert response.status_code == 400 and response.json()["code"] == "chat_turns"


# --- limits ----------------------------------------------------------------------------------------


async def chat_app(settings, db_session, **overrides):
    """An app with other settings, a fake model in place of Groq and the assistant switched on."""
    app = create_app(settings.model_copy(update=overrides), database=_TestDatabase(db_session))
    app.state.chat_model = FakeChatModel()
    await PanelSettingsService(SettingsRepository(db_session), claude_ready=False, assistant_ready=True).set_assistant(
        True
    )
    return app


async def test_a_visitor_is_limited_and_told_when_to_come_back(settings, db_session, storage_dir, seeded):
    # Room for every model's per-minute share: this is about one visitor's own limit.
    app = await chat_app(settings, db_session, chat_model_tokens_per_minute=1_000_000)
    async with make_client(app, ip="203.0.113.7") as visitor:
        for _ in range(6):
            assert (await visitor.post(CHAT, json=question())).status_code == 200
        limited = await visitor.post(CHAT, json=question())
    assert limited.status_code == 429
    assert limited.json()["code"] == "chat_limit"
    assert 0 < int(limited.headers["retry-after"]) <= 600
    async with make_client(app, ip="198.51.100.200") as other:  # someone else, elsewhere
        assert (await other.post(CHAT, json=question())).status_code == 200


async def test_a_burst_from_many_visitors_waits_for_the_next_minute(app, assistant):
    """Each model takes only as many whole prompts a minute as Groq's free limit allows."""
    codes = []
    for i in range(8):
        async with make_client(app, ip=f"10.{i}.0.1") as visitor:
            response = await visitor.post(CHAT, json=question())
            codes.append(response.status_code if response.status_code == 200 else response.json()["code"])
    assert codes[0] == 200 and codes[-1] == "chat_busy"


async def test_the_chat_cookie_follows_a_visitor_who_changes_address(settings, db_session, storage_dir, seeded):
    app = await chat_app(settings, db_session, chat_model_tokens_per_minute=1_000_000)
    cookie = str(uuid.uuid4())
    for i in range(6):  # a different network each time
        async with make_client(app, ip=f"10.{i}.0.1") as visitor:
            assert (await visitor.post(CHAT, json=question(session_id=cookie))).status_code == 200
    async with make_client(app, ip="10.99.0.1") as visitor:
        refused = await visitor.post(CHAT, json=question(session_id=cookie))
    assert refused.status_code == 429 and refused.json()["code"] == "chat_limit"


async def test_hopping_between_addresses_of_one_network_is_limited(settings, db_session, storage_dir, seeded):
    from app.main import create_app
    from tests.integration_api.conftest import _TestDatabase

    app = create_app(
        settings.model_copy(update={"chat_max_per_network_per_day": 3}), database=_TestDatabase(db_session)
    )
    app.state.chat_model = FakeChatModel()
    await PanelSettingsService(SettingsRepository(db_session), claude_ready=False, assistant_ready=True).set_assistant(
        True
    )
    for i in range(3):
        async with make_client(app, ip=f"203.0.113.{10 + i}") as visitor:
            assert (await visitor.post(CHAT, json=question())).status_code == 200
    async with make_client(app, ip="203.0.113.99") as visitor:
        assert (await visitor.post(CHAT, json=question())).status_code == 429
    async with make_client(app, ip="203.0.114.1") as visitor:  # the next /24 is another network
        assert (await visitor.post(CHAT, json=question())).status_code == 200


# --- "Top questions" --------------------------------------------------------------------------------


async def test_questions_are_kept_only_with_consent_masked_and_counted(app, assistant, auth_client):
    asked = [
        ("What has Ismoil built?", True),
        ("what has ismoil   built", True),
        ("Mail me at anna@example.com", True),
        ("Private question", False),
    ]
    for i, (text, consent) in enumerate(asked):
        async with make_client(app, ip=f"10.{i}.0.1") as visitor:
            response = await visitor.post(CHAT, json=question(text, save_question=consent))
            assert response.status_code == 200, response.text

    report = (await auth_client.get(ANALYTICS, params={"days": 7})).json()
    assert report["questions"] == [
        {"name": "What has Ismoil built?", "count": 2},
        {"name": "Mail me at [email]", "count": 1},
    ]


# --- the facts --------------------------------------------------------------------------------------


async def test_the_facts_hold_the_public_content_only_and_never_change_between_builds(db_session, settings, seeded):
    db_session.add(ContactMessage(name="Jane", contact="jane@corp.com", message="PRIVATE-NOTE-42", ip_hash="x" * 64))
    await db_session.flush()
    service = PublicService(PublicRepository(db_session), create_storage(settings))
    facts = await build_facts(service)
    assert facts == await build_facts(service)  # byte-identical, so Groq can cache it
    for expected in ("Name: Ismoil Sharifov", "## Projects", "page: /projects/", "## Work experience", "/#contact"):
        assert expected in facts
    assert "<p>" not in facts and "<li>" not in facts
    assert "PRIVATE-NOTE-42" not in facts and "jane@corp.com" not in facts  # messages are private
    assert len(facts) < 24_000  # compact: well under Groq's per-minute token limit


# --- the free quota, on the admin's Analytics page ----------------------------------------------------


async def test_the_admin_sees_how_much_of_each_models_free_quota_is_used(client, assistant, auth_client, settings):
    before = (await auth_client.get(ANALYTICS, params={"days": 7})).json()["assistant"]
    assert before["ready"] is True and before["enabled"] is True
    assert [m["model"] for m in before["models"]] == settings.chat_models
    assert all(m["requests_day"] == 0 and m["tokens_day"] == 0 for m in before["models"])

    await client.post(CHAT, json=question())
    first = (await auth_client.get(ANALYTICS, params={"days": 7})).json()["assistant"]["models"][0]
    assert first["requests_day"] == 1
    assert first["tokens_day"] == first["tokens_hour"] == first["tokens_minute"] == assistant.tokens
    assert first["requests_day_limit"] == settings.chat_model_requests_per_day
    assert first["tokens_day_limit"] == settings.chat_model_tokens_per_day
    assert first["tokens_hour_limit"] == settings.chat_model_tokens_per_day // settings.chat_hour_share
    assert first["tokens_minute_limit"] == settings.chat_model_tokens_per_minute


async def test_without_a_key_the_quota_shows_as_not_set_up(auth_client):
    usage = (await auth_client.get(ANALYTICS, params={"days": 7})).json()["assistant"]
    assert usage["ready"] is False and usage["enabled"] is False
