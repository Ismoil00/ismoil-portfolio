"""backend/seed/content.json must hold no two items with one name in a selector list: the seed is
loaded straight into the database, without the Selectors page's name check. (Two "Game development"
fields once came from it, and then neither could be saved under its own name.)"""

import json
from collections import Counter

import pytest

from app.core.config import BASE_DIR

SEED = json.loads((BASE_DIR / "seed" / "content.json").read_text(encoding="utf-8"))
LISTS = [
    "development_fields",
    "instruments",
    "tech_stacks",
    "product_types",
    "link_platforms",
    "companies",
    "institutes",
]


@pytest.mark.parametrize("kind", LISTS)
def test_no_two_items_share_a_name(kind):
    names = [
        (item["name"] if isinstance(item["name"], str) else item["name"]["en"]).strip().lower() for item in SEED[kind]
    ]
    assert [name for name, n in Counter(names).items() if n > 1] == []


@pytest.mark.parametrize("kind", LISTS)
def test_no_two_items_share_a_key(kind):
    keys = [item["key"] for item in SEED[kind]]
    assert [key for key, n in Counter(keys).items() if n > 1] == []
