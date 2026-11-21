"""Application settings, read from environment variables and backend/.env."""

import os
import ssl
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Literal

import certifi
from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

BASE_DIR = Path(__file__).resolve().parents[2]

# Vercel sets VERCEL=1 in every build and function. There the project folder is read-only (only /tmp is
# writable), and Vercel itself writes the caller's address into x-real-ip.
_SSL_MODES = {"require", "verify-ca", "verify-full"}


def _default_temp_dir() -> Path:
    return Path("/tmp/portfolio") if os.environ.get("VERCEL") else BASE_DIR / ".tmp"  # noqa: S108


def _default_ip_header() -> str | None:
    return "x-real-ip" if os.environ.get("VERCEL") else None


def _parse_hosted_url(raw: str) -> URL:
    """A libpq-style URL (`postgresql://user:pass@host/db?sslmode=require`) as SQLAlchemy reads it."""
    try:
        url = make_url(raw)
    except ArgumentError as error:
        raise ValueError("DATABASE_URL must look like postgresql://user:password@host/database") from error
    if url.drivername not in {"postgres", "postgresql", "postgresql+asyncpg"} or not url.host or not url.database:
        raise ValueError("DATABASE_URL must look like postgresql://user:password@host/database")
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Literal["development", "production", "test"] = "development"

    # Database: the DB_* fields locally; in production a hosted URL instead (Neon, through the Vercel
    # integration, sets DATABASE_URL to its pooled address and DATABASE_URL_UNPOOLED to the direct one).
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "portfolio"
    db_password: SecretStr = SecretStr("")
    db_name: str = "portfolio"
    test_db_name: str = "portfolio_test"
    hosted_db_url: SecretStr | None = Field(None, validation_alias=AliasChoices("DATABASE_URL", "hosted_db_url"))
    hosted_db_url_direct: SecretStr | None = Field(
        None, validation_alias=AliasChoices("DATABASE_URL_UNPOOLED", "hosted_db_url_direct")
    )
    # Every table lives in this schema (set as the connection's search_path).
    db_schema: str = "work"
    # Log every SQL statement (development only).
    db_echo: bool = False

    # Secrets & origins
    secret_key: SecretStr
    cors_origins: list[str] = []
    admin_origins: list[str] = ["http://localhost:3001"]
    trusted_proxies: list[str] = ["127.0.0.1", "::1"]
    # A header the hosting platform fills with the caller's IP and never lets clients set (Vercel: x-real-ip).
    client_ip_header: str | None = Field(default_factory=_default_ip_header)
    # Shared with the public site's server: requests carrying it may name the visitor's IP (X-Visitor-IP).
    internal_api_token: SecretStr | None = None
    # Vercel Cron sends it as `Authorization: Bearer …` to the daily cleanup; without it the route is off.
    cron_secret: SecretStr | None = None

    # Session cookies
    cookie_secure: bool = True
    session_idle_hours: int = 12
    session_max_days: int = 7

    # Abuse limits
    login_max_failures: int = 5  # per IP
    login_max_failures_global: int = 20  # all IPs together (forwarded IPs can be faked)
    login_window_minutes: int = 15
    contact_max_per_hour: int = 5  # per IP
    contact_max_per_hour_global: int = 30  # all visitors together
    analytics_max_per_hour: int = 120  # visit events kept per IP (more are quietly dropped)

    # File storage
    storage_backend: Literal["local", "s3", "blob"] = "local"
    local_storage_dir: Path = BASE_DIR / "storage"
    # Where browsers load files from: the backend's /media (local) or the bucket's public URL (s3). With
    # blob it's worked out from the store's token unless set to an https:// address (storage.py).
    media_base_url: str = "http://localhost:8000/media"
    s3_endpoint_url: str | None = None
    s3_bucket: str = "portfolio"
    s3_access_key: SecretStr | None = None
    s3_secret_key: SecretStr | None = None
    s3_region: str = "us-east-1"
    # Vercel Blob: the store's read-write token (on Vercel it's added by connecting the store to the project).
    blob_read_write_token: SecretStr | None = None

    # Translation (Claude API)
    anthropic_api_key: SecretStr | None = None
    translation_model: str = "claude-opus-5-5"

    # The public site's AI assistant (Groq's free tier: at its limits it refuses, it never bills).
    # Without GROQ_API_KEY the assistant is off; the admin's Settings page switches it on and off.
    groq_api_key: SecretStr | None = None
    chat_models: list[str] = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]  # tried in order
    # Our share of each model's free quota (Groq's own: 200k tokens and 1,000 requests a day, 8k tokens a
    # minute), kept a little below so its limit is never hit mid-answer. Cached prompt tokens don't count.
    chat_model_tokens_per_day: int = 180_000
    chat_model_requests_per_day: int = 900
    chat_model_tokens_per_minute: int = 7_000
    chat_hour_share: int = 6  # one hour may use at most 1/6 of a day's tokens, so a burst can't empty the day
    # Per visitor: counted per chat cookie and per IP (a question is refused when either is over), and per
    # network (IPv4 /24, IPv6 /64) so hopping between addresses of one network doesn't help.
    chat_max_per_10_minutes: int = 6
    chat_max_per_day: int = 20
    chat_max_per_network_per_day: int = 40
    chat_max_turns: int = 12  # questions in one conversation, then "New chat"
    chat_answer_max_tokens: int = 400

    # Requests
    max_body_bytes: int = 110 * 1024 * 1024
    temp_dir: Path = Field(default_factory=_default_temp_dir)

    @field_validator("db_schema")
    @classmethod
    def _plain_identifier(cls, value: str) -> str:
        if not value or not value.replace("_", "a").isalnum() or not value.isascii() or value[0].isdigit():
            raise ValueError("DB_SCHEMA must be a plain name (letters, digits, underscores)")
        return value.lower()

    @field_validator("internal_api_token", "cron_secret", "blob_read_write_token", "groq_api_key")
    @classmethod
    def _empty_is_unset(cls, value: SecretStr | None) -> SecretStr | None:
        """`CRON_SECRET=` (an empty line in .env) means "not set", never "the secret is empty"."""
        return value if value is not None and value.get_secret_value().strip() else None

    @field_validator("hosted_db_url", "hosted_db_url_direct")
    @classmethod
    def _postgres_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and value.get_secret_value():
            _parse_hosted_url(value.get_secret_value())
            return value
        return None

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def session_cookie(self) -> str:
        # The __Host- prefix makes browsers refuse the cookie unless it's Secure, host-only and Path=/.
        return "__Host-session" if self.cookie_secure else "session"

    @property
    def csrf_cookie(self) -> str:
        return "__Host-csrf" if self.cookie_secure else "csrf"

    def _hosted(self, *, test: bool, direct: bool) -> URL | None:
        """The hosted database URL to use, or None for the DB_* fields. Tests never use a hosted database."""
        if test:
            return None
        raw = (self.hosted_db_url_direct if direct else None) or self.hosted_db_url
        return _parse_hosted_url(raw.get_secret_value()) if raw else None

    def db_behind_pooler(self, *, direct: bool = False) -> bool:
        """True when connections go through PgBouncer (Neon's `-pooler` host): it does the pooling, and it
        can't keep session settings such as search_path."""
        hosted = self._hosted(test=False, direct=direct)
        return hosted is not None and "-pooler." in (hosted.host or "")

    def connect_args(self, *, test: bool = False, direct: bool = False) -> dict:
        """asyncpg options for the chosen database."""
        hosted = self._hosted(test=test, direct=direct)
        args: dict = {}
        if hosted is not None and hosted.query.get("sslmode") in _SSL_MODES:
            args["ssl"] = ssl.create_default_context(cafile=certifi.where())
        if hosted is not None and self.db_behind_pooler(direct=direct):
            # One server connection serves many clients: no cached or reused statement names. Unqualified
            # table names resolve through the role's search_path, set by migrations (alembic/env.py).
            args["statement_cache_size"] = 0
            args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid.uuid4().hex}__"
        else:
            args["server_settings"] = {"search_path": self.db_schema}  # unqualified names resolve to DB_SCHEMA
        return args

    def database_url(self, *, test: bool = False, direct: bool = False) -> URL:
        """The app uses the pooled address; migrations and scripts pass direct=True (Neon recommends the
        direct one for schema changes)."""
        hosted = self._hosted(test=test, direct=direct)
        if hosted is not None:
            # sslmode / channel_binding are libpq options asyncpg doesn't take (SSL is in connect_args).
            query = {"prepared_statement_cache_size": "0"} if self.db_behind_pooler(direct=direct) else {}
            return hosted.set(drivername="postgresql+asyncpg", query=query)
        return URL.create(
            "postgresql+asyncpg",
            username=self.db_user,
            password=self.db_password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.test_db_name if test else self.db_name,
        )

    def role_search_path_sql(self, database: str) -> str:
        """Makes DB_SCHEMA the default schema of the current role in `database` (needed behind PgBouncer)."""
        quoted = database.replace('"', '""')
        return f'ALTER ROLE CURRENT_USER IN DATABASE "{quoted}" SET search_path TO "{self.db_schema}", public'


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # secret_key comes from the environment
