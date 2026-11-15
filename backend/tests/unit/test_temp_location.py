"""Temp files and pytest's sandboxes stay inside the project folder, even when only unit tests run."""

import tempfile
from pathlib import Path

from app.core.config import get_settings


def _inside(path: str | Path, folder: Path) -> bool:
    return Path(path).resolve().is_relative_to(folder.resolve())


def test_python_temp_folder_is_inside_the_project():
    assert _inside(tempfile.gettempdir(), get_settings().temp_dir)


def test_pytest_sandboxes_are_inside_the_project(tmp_path):
    assert _inside(tmp_path, get_settings().temp_dir)
