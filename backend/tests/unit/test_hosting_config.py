"""What Vercel reads to build and run the backend, and the defaults that change when it runs there."""

import importlib
import json
import tomllib
from pathlib import Path

from fastapi import FastAPI

from app.core.config import BASE_DIR, Settings

PYPROJECT = tomllib.loads((BASE_DIR / "pyproject.toml").read_text(encoding="utf-8"))
VERCEL_JSON = json.loads((BASE_DIR / "vercel.json").read_text(encoding="utf-8"))
ENTRYPOINT = PYPROJECT["tool"]["vercel"]["entrypoint"]
ENTRY_FILE = ENTRYPOINT.split(":")[0].replace(".", "/") + ".py"


def test_vercel_finds_the_fastapi_app():
    module, name = ENTRYPOINT.split(":")
    assert isinstance(getattr(importlib.import_module(module), name), FastAPI)


def test_python_version_is_pinned():
    assert (BASE_DIR / ".python-version").read_text(encoding="utf-8").strip() == "3.13"
    assert PYPROJECT["project"]["requires-python"] == ">=3.13"


def test_function_settings_are_keyed_by_the_entrypoint_file():
    assert set(VERCEL_JSON["functions"]) == {ENTRY_FILE}
    excluded = VERCEL_JSON["functions"][ENTRY_FILE]["excludeFiles"]
    for folder in ("tests/**", "tests_architecture/**", "storage/**", ".venv/**", ".tmp/**"):
        assert folder in excluded


def test_deploys_come_from_the_pipeline_only():
    assert VERCEL_JSON["git"] == {"deploymentEnabled": False}


def test_the_daily_cleanup_is_scheduled_once_a_day():
    [cron] = VERCEL_JSON["crons"]
    assert cron["path"] == "/api/v1/internal/cleanup"
    minute, hour, *rest = cron["schedule"].split()
    assert minute.isdigit() and hour.isdigit() and rest == ["*", "*", "*"]  # Vercel Hobby: at most once a day


def test_on_vercel_temp_files_go_to_tmp_and_the_ip_comes_from_vercel(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    hosted = Settings(_env_file=None, secret_key="x")
    assert hosted.temp_dir == Path("/tmp/portfolio")  # the only writable folder on Vercel  # noqa: S108
    assert hosted.client_ip_header == "x-real-ip"


def test_locally_temp_files_stay_in_the_project(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    local = Settings(_env_file=None, secret_key="x")
    assert local.temp_dir == BASE_DIR / ".tmp"
    assert local.client_ip_header is None
