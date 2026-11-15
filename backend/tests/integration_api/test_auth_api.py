"""Auth endpoints and the protections every request gets (cookies, CSRF, origin, headers, limits)."""

from tests.conftest import ADMIN_ORIGIN
from tests.integration_api.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, make_client

LOGIN = "/api/v1/auth/login"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"


def _cookie_header(response, name: str) -> str:
    return next(h for h in response.headers.get_list("set-cookie") if h.startswith(f"{name}="))


async def test_health_has_security_headers(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert response.headers["cache-control"] == "no-store"


async def test_login_sets_httponly_strict_session_cookie_and_returns_csrf(client, admin_user, settings):
    response = await client.post(LOGIN, json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == ADMIN_EMAIL
    assert body["csrf_token"]

    session_cookie = _cookie_header(response, settings.session_cookie).lower()
    assert "httponly" in session_cookie
    assert "samesite=strict" in session_cookie
    assert "path=/" in session_cookie
    csrf_cookie = _cookie_header(response, settings.csrf_cookie).lower()
    assert "httponly" not in csrf_cookie  # the admin panel reads it to send the header


async def test_me_requires_a_session(client, auth_client):
    assert (await client.get(ME)).status_code == 401
    response = await auth_client.get(ME)
    assert response.status_code == 200
    assert response.json()["email"] == ADMIN_EMAIL


async def test_wrong_credentials_get_one_generic_message(client, admin_user):
    for payload in (
        {"email": ADMIN_EMAIL, "password": "wrong-password"},
        {"email": "nobody@example.com", "password": ADMIN_PASSWORD},
    ):
        response = await client.post(LOGIN, json=payload)
        assert response.status_code == 401
        assert response.json()["detail"] == "Wrong email or password"


async def test_login_is_throttled_with_retry_after(client, admin_user, settings):
    for _ in range(settings.login_max_failures):
        assert (await client.post(LOGIN, json={"email": ADMIN_EMAIL, "password": "nope-nope-nope"})).status_code == 401
    response = await client.post(LOGIN, json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


async def test_login_validates_input(client):
    assert (await client.post(LOGIN, json={"email": "not-an-email", "password": "x"})).status_code == 422
    assert (await client.post(LOGIN, json={"email": ADMIN_EMAIL})).status_code == 422
    extra = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "is_admin": True}
    assert (await client.post(LOGIN, json=extra)).status_code == 422  # unknown fields are refused


async def test_writes_need_the_csrf_header(auth_client):
    token = auth_client.headers.pop("X-CSRF-Token")
    response = await auth_client.post(LOGOUT)
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_failed"
    response = await auth_client.post(LOGOUT, headers={"X-CSRF-Token": "forged"})
    assert response.status_code == 403
    assert (await auth_client.post(LOGOUT, headers={"X-CSRF-Token": token})).status_code == 204


async def test_writes_from_another_origin_are_refused(auth_client):
    response = await auth_client.post(LOGOUT, headers={"Origin": "https://evil.example"})
    assert response.status_code == 403
    assert response.json()["code"] == "bad_origin"
    assert (await auth_client.get(ME)).status_code == 200  # still signed in


async def test_logout_ends_the_session_and_clears_cookies(auth_client, settings):
    response = await auth_client.post(LOGOUT)
    assert response.status_code == 204
    cleared = _cookie_header(response, settings.session_cookie).lower()
    assert "max-age=0" in cleared or "expires=" in cleared
    assert (await auth_client.get(ME)).status_code == 401


async def test_a_stolen_cookie_value_from_logout_no_longer_works(app, auth_client, settings):
    session_value = auth_client.cookies.get(settings.session_cookie)
    await auth_client.post(LOGOUT)
    async with make_client(app) as other:
        other.cookies.set(settings.session_cookie, session_value)
        assert (await other.get(ME)).status_code == 401


async def test_oversized_bodies_are_rejected(app, settings):
    small = settings.model_copy(update={"max_body_bytes": 100})
    from app.main import create_app

    async with make_client(create_app(small, database=app.state.db)) as c:
        response = await c.post(LOGIN, content=b"x" * 500, headers={"Content-Type": "application/json"})
        assert response.status_code == 413


async def test_cors_allows_only_listed_origins(client):
    allowed = await client.options(LOGIN, headers={"Origin": ADMIN_ORIGIN, "Access-Control-Request-Method": "POST"})
    assert allowed.headers.get("access-control-allow-origin") == ADMIN_ORIGIN
    denied = await client.options(
        LOGIN, headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}
    )
    assert "access-control-allow-origin" not in denied.headers
