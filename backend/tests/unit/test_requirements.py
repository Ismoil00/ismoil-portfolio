"""requirements.lock pins every package, and pip accepts it as a constraints file (`pip install -c`)."""

import re
import tomllib
from pathlib import Path

from app.core.config import BASE_DIR

LISTS = [BASE_DIR / "requirements.txt", BASE_DIR / "requirements-dev.txt"]
LOCK = BASE_DIR / "requirements.lock"

# pip only accepts plain `name==version` lines in a constraints file: no extras, URLs or editable installs.
PINNED = re.compile(r"^(?P<name>[A-Za-z0-9][A-Za-z0-9._-]*)==[^\s;\[\]]+$")
NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*")


def _normalize(name: str) -> str:
    """Package names are compared the way pip compares them: case and `-_.` don't matter."""
    return re.sub(r"[-_.]+", "-", name).lower()


def _lines(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8-sig")
    return [line.strip() for line in text.splitlines() if line.strip() and not line.lstrip().startswith("#")]


def listed_names(path: Path) -> set[str]:
    """Packages named in a requirements file, without extras such as `[standard]`; `-r` includes are skipped."""
    names = set()
    for line in _lines(path):
        if line.startswith("-"):
            continue
        match = NAME.match(line)
        assert match, f"{path.name}: cannot read the package name in {line!r}"
        names.add(_normalize(match.group()))
    return names


def bad_lock_lines(path: Path) -> list[str]:
    return [line for line in _lines(path) if not PINNED.match(line)]


def pinned_names(path: Path) -> set[str]:
    return {_normalize(match.group("name")) for line in _lines(path) if (match := PINNED.match(line))}


def test_lock_is_a_valid_constraints_file():
    assert bad_lock_lines(LOCK) == []


def test_every_listed_package_is_pinned_in_the_lock():
    pinned = pinned_names(LOCK)
    for path in LISTS:
        missing = listed_names(path) - pinned
        assert not missing, f"{path.name} lists {sorted(missing)}, missing from requirements.lock (see README)"


PYPROJECT = BASE_DIR / "pyproject.toml"
DEPENDENCY = re.compile(r"^(?P<name>[A-Za-z0-9][A-Za-z0-9._-]*)(\[[a-z0-9,]+\])?==(?P<version>[^\s;]+)$")


def test_pyproject_pins_the_app_packages_like_the_lock():
    """Vercel installs the backend from pyproject.toml, everything else from requirements.txt + the lock:
    both must name the same packages at the same versions."""
    dependencies = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))["project"]["dependencies"]
    locked = {_normalize(m.group("name")): line.split("==", 1)[1] for line in _lines(LOCK) if (m := PINNED.match(line))}
    names = set()
    for dependency in dependencies:
        match = DEPENDENCY.match(dependency)
        assert match, f"pyproject.toml: pin {dependency!r} as name==version"
        name = _normalize(match.group("name"))
        assert locked.get(name) == match.group("version"), f"{dependency} differs from requirements.lock"
        names.add(name)
    assert names == listed_names(LISTS[0]), "pyproject.toml and requirements.txt list different packages"
