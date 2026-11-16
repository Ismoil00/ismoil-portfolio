"""Signing in to the admin panel: one admin user, opaque sessions, CSRF tokens, login throttling."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from email_validator import EmailNotValidError, validate_email

from app.core.config import Settings
from app.core.errors import FieldErrors, Forbidden, TooManyRequests, Unauthorized
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    hash_token,
    new_token,
    password_needs_rehash,
    same_hash,
    verify_password,
)
from app.core.throttle import retry_after
from app.models import AdminSession, AdminUser

MIN_PASSWORD_LENGTH = 12
# Writing last_seen_at on every request isn't needed; once a minute keeps the idle timer accurate enough.
TOUCH_INTERVAL = timedelta(minutes=1)


def utcnow() -> datetime:
    return datetime.now(UTC)


class AuthRepositoryProtocol(Protocol):
    async def get_user_by_email(self, email: str) -> AdminUser | None: ...
    async def add_user(self, user: AdminUser) -> None: ...
    async def add_session(self, session: AdminSession) -> None: ...
    async def get_session(self, token_hash: str) -> AdminSession | None: ...
    async def delete_session(self, session: AdminSession) -> None: ...
    async def delete_user_sessions(self, user_id) -> None: ...
    async def delete_other_sessions(self, user_id, keep_id) -> None: ...
    async def add_attempt(self, ip_hash: str, succeeded: bool, at: datetime) -> None: ...
    async def failures_since(self, ip_hash: str, since: datetime) -> list[datetime]: ...
    async def failures_since_any(self, since: datetime) -> list[datetime]: ...
    async def commit(self) -> None: ...


@dataclass(frozen=True)
class LoginResult:
    session_token: str
    csrf_token: str
    user: AdminUser


def normalize_email(email: str) -> str:
    return email.strip().lower()


class AuthService:
    def __init__(self, repo: AuthRepositoryProtocol, settings: Settings, *, clock: Callable[[], datetime] = utcnow):
        self.repo = repo
        self.settings = settings
        self.clock = clock

    async def create_admin(self, email: str, password: str) -> AdminUser:
        """Creates the admin user, or resets the password (and signs out every session) if it exists."""
        email = normalize_email(email)
        errors: list[tuple[tuple[str, ...], str]] = []
        try:
            validate_email(email, check_deliverability=False)
        except EmailNotValidError:
            errors.append((("email",), "Enter a valid email address"))
        if len(password.strip()) < MIN_PASSWORD_LENGTH:
            errors.append((("password",), f"Use at least {MIN_PASSWORD_LENGTH} characters"))
        if errors:
            raise FieldErrors(errors)

        user = await self.repo.get_user_by_email(email)
        if user is None:
            user = AdminUser(email=email, password_hash=hash_password(password))
            await self.repo.add_user(user)
        else:
            user.password_hash = hash_password(password)
            await self.repo.delete_user_sessions(user.id)
        await self.repo.commit()
        return user

    async def _check_throttle(self, ip_hash: str, now: datetime) -> None:
        """Wrong passwords (sign-in or password change) are limited per visitor and for everyone together:
        forwarded IPs can be faked, the total can't."""
        window = timedelta(minutes=self.settings.login_window_minutes)
        wait = retry_after(
            await self.repo.failures_since(ip_hash, now - window), self.settings.login_max_failures, window, now
        ) or retry_after(
            await self.repo.failures_since_any(now - window), self.settings.login_max_failures_global, window, now
        )
        if wait is not None:
            raise TooManyRequests("Too many failed attempts. Try again later.", retry_after=wait)

    async def login(self, email: str, password: str, *, ip_hash: str, user_agent: str) -> LoginResult:
        now = self.clock()
        await self._check_throttle(ip_hash, now)

        user = await self.repo.get_user_by_email(normalize_email(email))
        password_ok = verify_password(user.password_hash if user else DUMMY_PASSWORD_HASH, password)
        succeeded = user is not None and password_ok
        await self.repo.add_attempt(ip_hash, succeeded, now)
        if not succeeded:
            await self.repo.commit()
            raise Unauthorized("Wrong email or password")
        assert user is not None

        session_token, csrf_token = new_token(), new_token()
        await self.repo.add_session(
            AdminSession(
                user_id=user.id,
                token_hash=hash_token(session_token),
                csrf_hash=hash_token(csrf_token),
                created_at=now,
                last_seen_at=now,
                expires_at=now + timedelta(days=self.settings.session_max_days),
                ip_hash=ip_hash,
                user_agent=user_agent[:255],
            )
        )
        user.last_login_at = now
        if password_needs_rehash(user.password_hash):
            user.password_hash = hash_password(password)
        await self.repo.commit()
        return LoginResult(session_token=session_token, csrf_token=csrf_token, user=user)

    async def authenticate(self, session_token: str | None) -> AdminSession:
        if not session_token:
            raise Unauthorized("Sign in to continue")
        session = await self.repo.get_session(hash_token(session_token))
        if session is None:
            raise Unauthorized("Sign in to continue")

        now = self.clock()
        idle_limit = session.last_seen_at + timedelta(hours=self.settings.session_idle_hours)
        if now >= session.expires_at or now >= idle_limit:
            await self.repo.delete_session(session)
            await self.repo.commit()
            raise Unauthorized("Your session has expired. Sign in again.")

        if now - session.last_seen_at >= TOUCH_INTERVAL:
            session.last_seen_at = now
            await self.repo.commit()
        return session

    async def change_password(self, session: AdminSession, current: str, new: str, *, ip_hash: str) -> None:
        """A new password for the signed-in admin. The current one is checked first (and wrong guesses count
        towards the sign-in limits); every other browser is signed out, this one stays signed in."""
        now = self.clock()
        await self._check_throttle(ip_hash, now)
        user = session.user
        errors: list[tuple[tuple[str, ...], str]] = []
        if len(new.strip()) < MIN_PASSWORD_LENGTH:
            errors.append((("new_password",), f"Use at least {MIN_PASSWORD_LENGTH} characters"))
        elif new == current:
            errors.append((("new_password",), "Pick a password different from the current one"))
        if not verify_password(user.password_hash, current):
            await self.repo.add_attempt(ip_hash, False, now)
            await self.repo.commit()
            raise FieldErrors([(("current_password",), "This isn't your current password"), *errors])
        if errors:
            raise FieldErrors(errors)

        user.password_hash = hash_password(new)
        await self.repo.delete_other_sessions(user.id, session.id)
        await self.repo.commit()

    def check_csrf(self, session: AdminSession, csrf_token: str | None) -> None:
        if not csrf_token or not same_hash(csrf_token, session.csrf_hash):
            raise Forbidden("Invalid or missing CSRF token", code="csrf_failed")

    async def logout(self, session_token: str | None) -> None:
        if not session_token:
            return
        session = await self.repo.get_session(hash_token(session_token))
        if session is not None:
            await self.repo.delete_session(session)
            await self.repo.commit()
