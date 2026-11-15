"""Client address helpers (behind the Next.js servers, the real IP is in X-Forwarded-For)."""

import hashlib
import hmac
import ipaddress

from fastapi import Request


def client_ip(request: Request, trusted_proxies: list[str]) -> str:
    """The visitor's IP. X-Forwarded-For is only believed when the direct peer is a trusted proxy,
    and then the right-most address that isn't a trusted proxy is taken (left ones can be forged)."""
    peer = request.client.host if request.client else "unknown"
    if peer not in trusted_proxies:
        return peer
    forwarded = request.headers.get("x-forwarded-for", "")
    for candidate in reversed([part.strip() for part in forwarded.split(",") if part.strip()]):
        if candidate in trusted_proxies:
            continue
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            break
    return peer


def hash_ip(ip: str, secret: str) -> str:
    """Keyed hash of an IP: enough to count requests per visitor without storing the address."""
    return hmac.new(secret.encode(), ip.encode(), hashlib.sha256).hexdigest()
