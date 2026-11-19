"""Password hashing, tokens and client-IP detection."""

from types import SimpleNamespace

from app.core.net import client_ip, hash_ip
from app.core.security import hash_password, hash_token, new_token, verify_password


def test_password_hash_is_argon2id_and_salted():
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")
    assert first.startswith("$argon2id$")
    assert first != second  # random salt


def test_verify_password():
    stored = hash_password("correct horse battery staple")
    assert verify_password(stored, "correct horse battery staple")
    assert not verify_password(stored, "wrong password")
    assert not verify_password("not-a-hash", "anything")


def test_tokens_are_random_and_hashes_are_stable():
    token = new_token()
    assert len(token) >= 43  # 32 random bytes, url-safe base64
    assert token != new_token()
    assert hash_token(token) == hash_token(token)
    assert len(hash_token(token)) == 64
    assert hash_token(token) != token


def _request(peer: str, forwarded: str | None = None, **extra: str):
    headers = {"x-forwarded-for": forwarded} if forwarded else {}
    headers.update({name.replace("_", "-"): value for name, value in extra.items()})
    return SimpleNamespace(client=SimpleNamespace(host=peer), headers=headers)


def test_client_ip_comes_from_the_platform_header_when_configured():
    """On Vercel the peer address means nothing; Vercel writes the caller's IP into x-real-ip itself."""
    request = _request("10.0.0.1", "6.6.6.6", x_real_ip="198.51.100.7")
    assert client_ip(request, ["127.0.0.1"], ip_header="x-real-ip") == "198.51.100.7"
    assert client_ip(_request("10.0.0.1", x_real_ip="not-an-ip"), [], ip_header="x-real-ip") == "10.0.0.1"


def test_the_site_server_passes_the_visitor_ip_with_the_internal_token():
    request = _request("10.0.0.1", x_internal_token="site-token", x_visitor_ip="203.0.113.5", x_real_ip="34.1.1.1")
    assert client_ip(request, [], ip_header="x-real-ip", internal_token="site-token") == "203.0.113.5"


def test_a_visitor_ip_without_the_right_token_is_ignored():
    forged = _request("10.0.0.1", x_internal_token="guess", x_visitor_ip="203.0.113.5", x_real_ip="34.1.1.1")
    assert client_ip(forged, [], ip_header="x-real-ip", internal_token="site-token") == "34.1.1.1"
    no_token_set = _request("10.0.0.1", x_internal_token="", x_visitor_ip="203.0.113.5")
    assert client_ip(no_token_set, [], internal_token=None) == "10.0.0.1"
    bad_ip = _request("10.0.0.1", x_internal_token="site-token", x_visitor_ip="nope", x_real_ip="34.1.1.1")
    assert client_ip(bad_ip, [], ip_header="x-real-ip", internal_token="site-token") == "34.1.1.1"


def test_client_ip_ignores_forwarded_header_from_untrusted_peer():
    assert client_ip(_request("203.0.113.9", "1.1.1.1"), ["127.0.0.1"]) == "203.0.113.9"


def test_client_ip_takes_rightmost_untrusted_address_behind_proxy():
    request = _request("127.0.0.1", "6.6.6.6, 198.51.100.7, 127.0.0.1")
    assert client_ip(request, ["127.0.0.1"]) == "198.51.100.7"


def test_client_ip_falls_back_to_peer_on_garbage():
    assert client_ip(_request("127.0.0.1", "not-an-ip"), ["127.0.0.1"]) == "127.0.0.1"
    assert client_ip(_request("127.0.0.1"), ["127.0.0.1"]) == "127.0.0.1"


def test_ip_hash_is_keyed():
    assert hash_ip("1.2.3.4", "a") == hash_ip("1.2.3.4", "a")
    assert hash_ip("1.2.3.4", "a") != hash_ip("1.2.3.4", "b")
    assert "1.2.3.4" not in hash_ip("1.2.3.4", "a")
