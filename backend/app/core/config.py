"""Application settings, read from environment variables and backend/.env."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Literal["development", "production", "test"] = "development"

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "portfolio"
    db_password: SecretStr = SecretStr("")
    db_name: str = "portfolio"
    test_db_name: str = "portfolio_test"
    # Every table lives in this schema (set as the connection's search_path).
    db_schema: str = "work"
    # Log every SQL statement (development only).
    db_echo: bool = False

    # Secrets & origins
    secret_key: SecretStr
    cors_origins: list[str] = []
    admin_origins: list[str] = ["http://localhost:3001"]
    trusted_proxies: list[str] = ["127.0.0.1", "::1"]

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

    # File storage
    storage_backend: Literal["local", "s3"] = "local"
    local_storage_dir: Path = BASE_DIR / "storage"
    media_base_url: str = "http://localhost:8000/media"
    s3_endpoint_url: str | None = None
    s3_bucket: str = "portfolio"
    s3_access_key: SecretStr | None = None
    s3_secret_key: SecretStr | None = None
    s3_region: str = "us-east-1"

    # Translation (Claude API)
    anthropic_api_key: SecretStr | None = None
    translation_model: str = "claude-opus-5-5"

    # Requests
    max_body_bytes: int = 110 * 1024 * 1024
    temp_dir: Path = BASE_DIR / ".tmp"

    @field_validator("db_schema")
    @classmethod
    def _plain_identifier(cls, value: str) -> str:
        if not value or not value.replace("_", "a").isalnum() or not value.isascii() or value[0].isdigit():
            raise ValueError("DB_SCHEMA must be a plain name (letters, digits, underscores)")
        return value.lower()

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

    def connect_args(self) -> dict:
        """asyncpg options: unqualified table names resolve to DB_SCHEMA."""
        return {"server_settings": {"search_path": self.db_schema}}

    def database_url(self, *, test: bool = False) -> URL:
        return URL.create(
            "postgresql+asyncpg",
            username=self.db_user,
            password=self.db_password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.test_db_name if test else self.db_name,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # secret_key comes from the environment
