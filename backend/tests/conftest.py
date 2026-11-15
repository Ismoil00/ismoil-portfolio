"""Settings shared by unit and integration (API) tests."""

import tempfile

import pytest

from app.core.config import BASE_DIR, Settings, get_settings

ADMIN_ORIGIN = "http://admin.test"


def pytest_configure(config: pytest.Config) -> None:
    """Keep temp files and pytest's tmp_path sandboxes inside the project, whichever tests run.

    The app does the same when it starts, but unit tests never start it.
    """
    temp_dir = get_settings().temp_dir
    temp_dir.mkdir(parents=True, exist_ok=True)
    tempfile.tempdir = str(temp_dir)


@pytest.fixture(scope="session")
def settings() -> Settings:
    """Test settings: the test database, cookies over plain http, small abuse limits."""
    return get_settings().model_copy(
        update={
            "env": "test",
            "cookie_secure": False,
            "admin_origins": [ADMIN_ORIGIN],
            "cors_origins": ["http://public.test", ADMIN_ORIGIN],
            "trusted_proxies": ["127.0.0.1"],
            "login_max_failures": 3,
            "login_max_failures_global": 6,
            "login_window_minutes": 15,
            "contact_max_per_hour": 3,
            "contact_max_per_hour_global": 5,
            "storage_backend": "local",
            "local_storage_dir": BASE_DIR / ".tmp" / "test-storage",
            "media_base_url": "http://testserver/media",
            "anthropic_api_key": None,
        }
    )
