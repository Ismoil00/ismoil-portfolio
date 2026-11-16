"""The architecture site's database data is generated from the models and must match them.

When a model changes, run:  .venv/Scripts/python scripts/export_architecture_db.py
"""

import importlib.util
import json

from app.core.config import BASE_DIR
from app.db.base import Base

SCRIPT = BASE_DIR / "scripts" / "export_architecture_db.py"


def _exporter():
    spec = importlib.util.spec_from_file_location("export_architecture_db", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_generated_file_matches_the_models():
    exporter = _exporter()
    assert exporter.OUTPUT.exists(), "Run scripts/export_architecture_db.py to create the architecture data"
    current = exporter.OUTPUT.read_text(encoding="utf-8")
    assert current == exporter.render(), "The models changed: run scripts/export_architecture_db.py"


def test_every_table_column_and_foreign_key_is_exported():
    data = _exporter().schema()
    tables = {t["name"]: t for t in data["tables"]}
    assert set(tables) == set(Base.metadata.tables)
    for name, table in Base.metadata.tables.items():
        assert [c["name"] for c in tables[name]["columns"]] == [c.name for c in table.columns]
        exported = {(fk["columns"][0], fk["table"], fk["onDelete"]) for fk in tables[name]["foreignKeys"]}
        expected = {(fk.parent.name, fk.column.table.name, fk.ondelete or "NO ACTION") for fk in table.foreign_keys}
        assert exported == expected, name


def test_output_is_plain_javascript_data():
    text = _exporter().render()
    prefix = "window.ARCH.dbSchema = "
    body = text[text.index(prefix) + len(prefix) :].rstrip().rstrip(";")
    assert json.loads(body)["tables"]
