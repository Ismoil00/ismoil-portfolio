"""Admin panel settings: which translator helps with Russian and Tajik, and changing the username
and the password."""

import pytest

from app.repositories.auth import AuthRepository
from app.services.auth import AuthService
from tests.integration_api.conftest import ADMIN_PASSWORD, ADMIN_USERNAME, make_client

SETTINGS = "/api/v1/admin/settings"
PASSWORD = "/api/v1/admin/settings/password"
USERNAME = "/api/v1/admin/settings/username"
LOGIN = "/api/v1/auth/login"
NEW_PASSWORD = "another-long-passphrase-2026"
NEW_USERNAME = "site-owner"


class _ReadyTranslator:
    """Stands in for the Claude translator: the app only checks that one exists."""

    async def translate(self, text, fmt):
        return {"ru": text, "tg": text}


def _locs(response) -> dict[tuple, str]:
    return {tuple(e["loc"]): e["msg"] for e in response.json()["detail"]}


# --- translator -------------------------------------------------------------------------------------


async def test_settings_need_a_signed_in_admin(client):
    assert (await client.get(SETTINGS)).status_code == 401
    assert (await client.put(SETTINGS, json={"translator": "manual"})).status_code == 401


async def test_manual_is_the_default_and_claude_is_off_without_a_key(auth_client):
    response = await auth_client.get(SETTINGS)
    assert response.status_code == 200
    assert response.json() == {"translator": "manual", "claude_ready": False}


@pytest.mark.parametrize("translator", ["google_web", "manual"])
async def test_a_free_translator_is_saved(auth_client, translator):
    saved = await auth_client.put(SETTINGS, json={"translator": translator})
    assert saved.status_code == 200
    assert saved.json()["translator"] == translator
    assert (await auth_client.get(SETTINGS)).json()["translator"] == translator


async def test_claude_needs_an_api_key_first(auth_client):
    response = await auth_client.put(SETTINGS, json={"translator": "claude"})
    assert response.status_code == 422
    assert "ANTHROPIC_API_KEY" in _locs(response)[("body", "translator")]
    assert (await auth_client.get(SETTINGS)).json()["translator"] == "manual"


async def test_claude_can_be_chosen_once_a_key_is_set(app, auth_client):
    app.state.translator = _ReadyTranslator()
    assert (await auth_client.get(SETTINGS)).json()["claude_ready"] is True
    saved = await auth_client.put(SETTINGS, json={"translator": "claude"})
    assert saved.status_code == 200
    assert saved.json() == {"translator": "claude", "claude_ready": True}


async def test_an_unknown_translator_is_refused(auth_client):
    assert (await auth_client.put(SETTINGS, json={"translator": "deepl"})).status_code == 422


async def test_changing_settings_needs_the_csrf_token(auth_client):
    response = await auth_client.put(SETTINGS, json={"translator": "manual"}, headers={"X-CSRF-Token": "wrong"})
    assert response.status_code == 403


# --- password ---------------------------------------------------------------------------------------


async def _sign_in(app, password: str, username: str = ADMIN_USERNAME):
    client = make_client(app)
    response = await client.post(LOGIN, json={"username": username, "password": password})
    return client, response


async def test_the_password_changes_and_only_the_new_one_signs_in(app, auth_client):
    response = await auth_client.put(PASSWORD, json={"current_password": ADMIN_PASSWORD, "new_password": NEW_PASSWORD})
    assert response.status_code == 204

    old_client, old = await _sign_in(app, ADMIN_PASSWORD)
    new_client, new = await _sign_in(app, NEW_PASSWORD)
    await old_client.aclose()
    await new_client.aclose()
    assert old.status_code == 401
    assert new.status_code == 200


async def test_other_browsers_are_signed_out_this_one_stays(app, auth_client):
    async with make_client(app) as other:
        signed_in = await other.post(LOGIN, json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
        assert signed_in.status_code == 200
        assert (await other.get("/api/v1/auth/me")).status_code == 200

        changed = await auth_client.put(
            PASSWORD, json={"current_password": ADMIN_PASSWORD, "new_password": NEW_PASSWORD}
        )
        assert changed.status_code == 204
        assert (await other.get("/api/v1/auth/me")).status_code == 401
    assert (await auth_client.get("/api/v1/auth/me")).status_code == 200


async def test_a_wrong_current_password_is_refused(app, auth_client):
    response = await auth_client.put(
        PASSWORD, json={"current_password": "not-my-password", "new_password": NEW_PASSWORD}
    )
    assert response.status_code == 422
    assert ("body", "current_password") in _locs(response)
    client, still_old = await _sign_in(app, ADMIN_PASSWORD)
    await client.aclose()
    assert still_old.status_code == 200


@pytest.mark.parametrize(
    ("new_password", "message"),
    [("short-pass", "at least 12"), (ADMIN_PASSWORD, "different")],
)
async def test_new_password_rules(auth_client, new_password, message):
    response = await auth_client.put(PASSWORD, json={"current_password": ADMIN_PASSWORD, "new_password": new_password})
    assert response.status_code == 422
    assert message in _locs(response)[("body", "new_password")]


async def test_guessing_the_current_password_is_throttled(auth_client, settings):
    for _ in range(settings.login_max_failures):
        wrong = await auth_client.put(
            PASSWORD, json={"current_password": "a-wrong-guess", "new_password": NEW_PASSWORD}
        )
        assert wrong.status_code == 422
    blocked = await auth_client.put(PASSWORD, json={"current_password": ADMIN_PASSWORD, "new_password": NEW_PASSWORD})
    assert blocked.status_code == 429


async def test_changing_the_password_needs_a_session_and_the_csrf_token(client, auth_client):
    body = {"current_password": ADMIN_PASSWORD, "new_password": NEW_PASSWORD}
    assert (await client.put(PASSWORD, json=body)).status_code == 401
    assert (await auth_client.put(PASSWORD, json=body, headers={"X-CSRF-Token": "wrong"})).status_code == 403


# --- username ---------------------------------------------------------------------------------------


async def test_the_username_changes_and_only_the_new_one_signs_in(app, auth_client):
    response = await auth_client.put(USERNAME, json={"current_password": ADMIN_PASSWORD, "new_username": NEW_USERNAME})
    assert response.status_code == 204
    assert (await auth_client.get("/api/v1/auth/me")).json() == {"username": NEW_USERNAME}

    old_client, old = await _sign_in(app, ADMIN_PASSWORD)
    new_client, new = await _sign_in(app, ADMIN_PASSWORD, NEW_USERNAME)
    await old_client.aclose()
    await new_client.aclose()
    assert old.status_code == 401
    assert new.status_code == 200
    assert new.json()["username"] == NEW_USERNAME


async def test_a_new_username_signs_out_other_browsers_this_one_stays(app, auth_client):
    async with make_client(app) as other:
        signed_in = await other.post(LOGIN, json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
        assert signed_in.status_code == 200

        changed = await auth_client.put(
            USERNAME, json={"current_password": ADMIN_PASSWORD, "new_username": NEW_USERNAME}
        )
        assert changed.status_code == 204
        assert (await other.get("/api/v1/auth/me")).status_code == 401
    assert (await auth_client.get("/api/v1/auth/me")).status_code == 200


async def test_the_username_is_kept_in_lowercase(auth_client):
    response = await auth_client.put(
        USERNAME, json={"current_password": ADMIN_PASSWORD, "new_username": " Site.Owner_1 "}
    )
    assert response.status_code == 204
    assert (await auth_client.get("/api/v1/auth/me")).json() == {"username": "site.owner_1"}


async def test_a_wrong_current_password_keeps_the_username(app, auth_client):
    response = await auth_client.put(
        USERNAME, json={"current_password": "not-my-password", "new_username": NEW_USERNAME}
    )
    assert response.status_code == 422
    assert ("body", "current_password") in _locs(response)
    assert (await auth_client.get("/api/v1/auth/me")).json() == {"username": ADMIN_USERNAME}


@pytest.mark.parametrize(
    ("new_username", "message"),
    [
        ("ab", "3–32"),
        ("x" * 33, "3–32"),
        ("site owner", "3–32"),
        ("сайт", "3–32"),
        ("me@example.com", "3–32"),
        ("-owner", "start"),
        ("_owner", "start"),
        (ADMIN_USERNAME, "different"),
        (ADMIN_USERNAME.upper(), "different"),
    ],
)
async def test_new_username_rules(auth_client, new_username, message):
    response = await auth_client.put(USERNAME, json={"current_password": ADMIN_PASSWORD, "new_username": new_username})
    assert response.status_code == 422
    assert message in _locs(response)[("body", "new_username")]


async def test_a_username_another_admin_has_is_refused(auth_client, db_session, settings):
    await AuthService(AuthRepository(db_session), settings).create_admin(NEW_USERNAME, NEW_PASSWORD)
    response = await auth_client.put(
        USERNAME, json={"current_password": ADMIN_PASSWORD, "new_username": NEW_USERNAME.upper()}
    )
    assert response.status_code == 422
    assert "taken" in _locs(response)[("body", "new_username")]


async def test_guessing_the_password_on_the_username_form_is_throttled(auth_client, settings):
    for _ in range(settings.login_max_failures):
        wrong = await auth_client.put(
            USERNAME, json={"current_password": "a-wrong-guess", "new_username": NEW_USERNAME}
        )
        assert wrong.status_code == 422
    blocked = await auth_client.put(USERNAME, json={"current_password": ADMIN_PASSWORD, "new_username": NEW_USERNAME})
    assert blocked.status_code == 429


async def test_changing_the_username_needs_a_session_and_the_csrf_token(client, auth_client):
    body = {"current_password": ADMIN_PASSWORD, "new_username": NEW_USERNAME}
    assert (await client.put(USERNAME, json=body)).status_code == 401
    assert (await auth_client.put(USERNAME, json=body, headers={"X-CSRF-Token": "wrong"})).status_code == 403
