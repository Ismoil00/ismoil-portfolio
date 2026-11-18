"""Admins signed in with an email before; the migration that switched to usernames gives each one a
username made from the part of the email before "@", fitted to the username rules."""

import importlib.util

import pytest

from app.core.config import BASE_DIR
from app.services.auth import username_error

[MIGRATION] = (BASE_DIR / "alembic" / "versions").glob("*_admins_sign_in_with_a_username.py")


def _convert():
    spec = importlib.util.spec_from_file_location("admin_username_migration", MIGRATION)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.username_from_email


@pytest.mark.parametrize(
    ("email", "username"),
    [
        ("dev-admin@example.com", "dev-admin"),
        ("Site.Owner@Example.com", "site.owner"),
        ("first+portfolio@example.com", "first-portfolio"),
        ("__x__@example.com", "x__"),  # starts with a letter or digit
        ("ab@example.com", "admin"),  # too short
        ("x" * 40 + "@example.com", "x" * 32),
    ],
)
def test_the_part_before_the_at_sign_becomes_the_username(email, username):
    assert _convert()(email, set()) == username
    assert username_error(username) is None


def test_usernames_already_given_get_a_number():
    convert = _convert()
    taken = {"admin", "admin-2"}
    assert convert("admin@example.com", taken) == "admin-3"
    assert convert("y" * 32 + "@example.com", {"y" * 32}) == "y" * 30 + "-2"
