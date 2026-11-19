"""Which database the app connects to: the DB_* fields locally, or a hosted URL (Neon) in production."""

import ssl

import pytest
from pydantic import ValidationError

from app.core.config import Settings

# The shape Neon (through the Vercel integration) puts in DATABASE_URL and DATABASE_URL_UNPOOLED.
POOLED = (
    "postgresql://neondb_owner:s3cret@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/neondb"
    "?sslmode=require&channel_binding=require"
)
DIRECT = POOLED.replace("-pooler", "")


def make(**values) -> Settings:
    """Settings from these values only (no backend/.env, no environment)."""
    return Settings(_env_file=None, secret_key="test-secret", **values)


def test_without_a_database_url_the_db_fields_are_used():
    settings = make(db_host="db.local", db_port=5433, db_user="portfolio", db_password="pw", db_name="portfolio")
    url = settings.database_url()
    assert (url.drivername, url.host, url.port, url.username, url.database) == (
        "postgresql+asyncpg",
        "db.local",
        5433,
        "portfolio",
        "portfolio",
    )
    assert settings.connect_args() == {"server_settings": {"search_path": "work"}}
    assert not settings.db_behind_pooler()


def test_a_pooled_hosted_url_is_converted_for_asyncpg():
    settings = make(hosted_db_url=POOLED)
    url = settings.database_url()
    assert url.drivername == "postgresql+asyncpg"
    assert url.host == "ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech"
    assert (url.username, url.password, url.database) == ("neondb_owner", "s3cret", "neondb")
    # sslmode and channel_binding are libpq options asyncpg doesn't accept; SSL goes in connect_args instead.
    assert dict(url.query) == {"prepared_statement_cache_size": "0"}
    assert settings.db_behind_pooler()

    args = settings.connect_args()
    assert isinstance(args["ssl"], ssl.SSLContext)
    assert args["ssl"].verify_mode == ssl.CERT_REQUIRED
    assert args["statement_cache_size"] == 0
    assert "server_settings" not in args  # PgBouncer can't take it; the role's default search_path is used
    name = args["prepared_statement_name_func"]
    assert name() != name()  # unique names: pooled connections are shared between clients


def test_the_direct_url_is_used_for_migrations_and_scripts():
    settings = make(hosted_db_url=POOLED, hosted_db_url_direct=DIRECT)
    assert "-pooler" in settings.database_url().host  # the app goes through the pooler
    direct = settings.database_url(direct=True)
    assert direct.host == "ep-cool-darkness-123456.us-east-2.aws.neon.tech"
    assert dict(direct.query) == {}
    args = settings.connect_args(direct=True)
    assert args["server_settings"] == {"search_path": "work"}
    assert "statement_cache_size" not in args
    assert isinstance(args["ssl"], ssl.SSLContext)


def test_scripts_fall_back_to_the_pooled_url_without_a_direct_one():
    settings = make(hosted_db_url=POOLED)
    assert settings.database_url(direct=True).host == settings.database_url().host


def test_tests_never_touch_the_hosted_database():
    settings = make(hosted_db_url=POOLED, db_host="localhost", test_db_name="portfolio_test")
    url = settings.database_url(test=True)
    assert (url.host, url.database) == ("localhost", "portfolio_test")
    assert settings.connect_args(test=True) == {"server_settings": {"search_path": "work"}}


def test_a_url_without_sslmode_connects_without_forcing_ssl():
    settings = make(hosted_db_url="postgres://app:pw@db.internal:5432/portfolio")
    url = settings.database_url()
    assert (url.drivername, url.host, url.port, url.database) == (
        "postgresql+asyncpg",
        "db.internal",
        5432,
        "portfolio",
    )
    assert settings.connect_args() == {"server_settings": {"search_path": "work"}}


@pytest.mark.parametrize("bad", ["mysql://u:p@host/db", "not a url", "postgresql://u:p@host"])
def test_other_urls_are_refused(bad):
    with pytest.raises(ValidationError):
        make(hosted_db_url=bad)


def test_the_role_search_path_statement_quotes_names():
    settings = make(db_schema="work")
    assert (
        settings.role_search_path_sql("neondb")
        == 'ALTER ROLE CURRENT_USER IN DATABASE "neondb" SET search_path TO "work", public'
    )
    assert 'IN DATABASE "we""ird"' in settings.role_search_path_sql('we"ird')


def test_empty_secrets_mean_not_set():
    """An empty `CRON_SECRET=` line must not turn the cleanup route on with an empty password."""
    settings = make(cron_secret="", internal_api_token="  ", blob_read_write_token="")
    assert (settings.cron_secret, settings.internal_api_token, settings.blob_read_write_token) == (None, None, None)
    assert make(hosted_db_url="").hosted_db_url is None
