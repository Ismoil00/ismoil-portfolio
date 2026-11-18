"""Password hashing (Argon2id) and random tokens."""

import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()  # Argon2id with the library's current recommended cost


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(stored_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def password_needs_rehash(stored_hash: str) -> bool:
    return _hasher.check_needs_rehash(stored_hash)


# Checked when the username is unknown, so a wrong username takes as long as a wrong password.
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def new_token() -> str:
    """256 random bits, URL-safe."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Tokens are stored as SHA-256: a leaked database can't be used to sign in."""
    return hashlib.sha256(token.encode()).hexdigest()


def same_hash(token: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), stored_hash)
