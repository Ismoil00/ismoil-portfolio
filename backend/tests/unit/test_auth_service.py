"""Business rules of signing in (AuthService), with an in-memory repository."""

import pytest

from app.core.errors import FieldErrors, Forbidden, TooManyRequests, Unauthorized
from app.core.security import hash_token
from app.services.auth import AuthService
from tests.unit.fakes import FakeAuthRepository, FakeClock

EMAIL = "me@example.com"
PASSWORD = "a-long-and-secret-passphrase"
IP = "ip-hash-1"


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def repo() -> FakeAuthRepository:
    return FakeAuthRepository()


@pytest.fixture
async def service(repo, settings, clock) -> AuthService:
    service = AuthService(repo, settings, clock=clock)
    await service.create_admin(EMAIL, PASSWORD)
    return service


async def login(service: AuthService, password: str = PASSWORD, ip: str = IP, email: str = EMAIL):
    return await service.login(email, password, ip_hash=ip, user_agent="pytest")


# --- creating the admin -------------------------------------------------------------------------


async def test_create_admin_normalizes_email_and_hashes_password(repo, settings, clock):
    service = AuthService(repo, settings, clock=clock)
    user = await service.create_admin("  Me@Example.COM ", PASSWORD)
    assert user.email == "me@example.com"
    assert user.password_hash.startswith("$argon2id$")
    assert PASSWORD not in user.password_hash


@pytest.mark.parametrize("password", ["short", "x" * 11, " " * 20])
async def test_create_admin_rejects_weak_passwords(repo, settings, clock, password):
    with pytest.raises(FieldErrors):
        await AuthService(repo, settings, clock=clock).create_admin(EMAIL, password)


async def test_create_admin_again_resets_password_and_signs_out_everywhere(service, repo):
    await login(service)
    assert repo.sessions
    await service.create_admin(EMAIL, "another-long-passphrase")
    assert not repo.sessions
    with pytest.raises(Unauthorized):
        await login(service)
    assert (await login(service, "another-long-passphrase")).session_token


# --- logging in -----------------------------------------------------------------------------------


async def test_login_returns_random_tokens_and_stores_only_their_hashes(service, repo):
    result = await login(service)
    assert result.user.email == EMAIL
    assert result.session_token and result.csrf_token
    stored = repo.sessions[hash_token(result.session_token)]
    assert stored.csrf_hash == hash_token(result.csrf_token)
    assert result.session_token not in repo.sessions  # raw token is never stored
    assert repo.attempts[-1][1] is True


async def test_login_is_case_insensitive_for_email(service):
    assert (await login(service, email="ME@example.com")).user.email == EMAIL


@pytest.mark.parametrize(("email", "password"), [(EMAIL, "wrong-password"), ("nobody@example.com", PASSWORD)])
async def test_login_failures_share_one_generic_error(service, repo, email, password):
    with pytest.raises(Unauthorized) as error:
        await login(service, password=password, email=email)
    assert error.value.message == "Wrong email or password"
    assert repo.attempts[-1] == (IP, False, repo.attempts[-1][2])


async def test_login_is_throttled_per_ip_after_too_many_failures(service, settings):
    for _ in range(settings.login_max_failures):
        with pytest.raises(Unauthorized):
            await login(service, "wrong-password")
    # Even the right password is refused while the IP is blocked…
    with pytest.raises(TooManyRequests) as error:
        await login(service)
    assert 0 < error.value.retry_after <= settings.login_window_minutes * 60
    # …but another IP can still sign in.
    assert (await login(service, ip="ip-hash-2")).session_token


async def test_failures_from_many_ips_hit_a_site_wide_limit(service, settings):
    """Faked or rotating IPs can't get around the throttle: failures are also counted in total."""
    for n in range(settings.login_max_failures_global):
        with pytest.raises(Unauthorized):
            await login(service, "wrong-password", ip=f"ip-{n}")
    with pytest.raises(TooManyRequests):
        await login(service, ip="fresh-ip")


async def test_old_failures_stop_counting_after_the_window(service, settings, clock):
    for _ in range(settings.login_max_failures):
        with pytest.raises(Unauthorized):
            await login(service, "wrong-password")
    clock.advance(minutes=settings.login_window_minutes + 1)
    assert (await login(service)).session_token


async def test_login_records_last_login_time(service, clock):
    result = await login(service)
    assert result.user.last_login_at == clock.now


# --- using a session ------------------------------------------------------------------------------


async def test_authenticate_accepts_a_fresh_session(service):
    result = await login(service)
    session = await service.authenticate(result.session_token)
    assert session.user.email == EMAIL


@pytest.mark.parametrize("token", [None, "", "made-up-token"])
async def test_authenticate_rejects_missing_or_unknown_tokens(service, token):
    with pytest.raises(Unauthorized):
        await service.authenticate(token)


async def test_session_expires_after_idle_time_and_is_deleted(service, repo, settings, clock):
    result = await login(service)
    clock.advance(hours=settings.session_idle_hours, minutes=1)
    with pytest.raises(Unauthorized):
        await service.authenticate(result.session_token)
    assert not repo.sessions


async def test_activity_keeps_the_session_alive_until_the_absolute_limit(service, settings, clock):
    result = await login(service)
    step = settings.session_idle_hours - 1
    elapsed = 0
    while elapsed + step < settings.session_max_days * 24:
        clock.advance(hours=step)
        elapsed += step
        await service.authenticate(result.session_token)  # still valid: activity slides the idle timer
    clock.advance(hours=step)
    with pytest.raises(Unauthorized):
        await service.authenticate(result.session_token)


async def test_csrf_token_must_match_the_session(service):
    result = await login(service)
    session = await service.authenticate(result.session_token)
    service.check_csrf(session, result.csrf_token)
    for bad in (None, "", "forged"):
        with pytest.raises(Forbidden):
            service.check_csrf(session, bad)


async def test_logout_ends_the_session(service):
    result = await login(service)
    await service.logout(result.session_token)
    with pytest.raises(Unauthorized):
        await service.authenticate(result.session_token)


async def test_logging_in_again_does_not_reuse_tokens(service):
    first = await login(service)
    second = await login(service)
    assert first.session_token != second.session_token
    assert first.csrf_token != second.csrf_token
