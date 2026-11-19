"""Client address helpers.

Locally the Next.js servers sit in front of the backend and pass the visitor's IP in X-Forwarded-For.
On Vercel every request is a fresh connection from Vercel, which writes the caller's IP into x-real-ip
itself; the public site's server, which calls the backend for each visitor, names the visitor in
X-Visitor-IP together with the shared INTERNAL_API_TOKEN.
"""

import hashlib
import hmac
import ipaddress

from fastapi import Request


def _ip(value: str | None) -> str | None:
    try:
        return str(ipaddress.ip_address((value or "").split(",")[0].strip()))
    except ValueError:
        return None


def client_ip(
    request: Request,
    trusted_proxies: list[str],
    *,
    ip_header: str | None = None,
    internal_token: str | None = None,
) -> str:
    """The visitor's IP, from the most trustworthy source available:

    1. X-Visitor-IP, when the request carries the internal token (the public site's server);
    2. the hosting platform's own header (`ip_header`, e.g. x-real-ip on Vercel);
    3. X-Forwarded-For, only when the direct peer is a trusted proxy, taking the right-most address that
       isn't a trusted proxy (the left ones can be forged);
    4. the direct peer.
    """
    headers = request.headers
    if internal_token and hmac.compare_digest(headers.get("x-internal-token", "").encode(), internal_token.encode()):
        if visitor := _ip(headers.get("x-visitor-ip")):
            return visitor
    if ip_header and (platform := _ip(headers.get(ip_header))):
        return platform

    peer = request.client.host if request.client else "unknown"
    if peer not in trusted_proxies:
        return peer
    forwarded = headers.get("x-forwarded-for", "")
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
