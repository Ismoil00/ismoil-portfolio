"""Project descriptions used to be plain text (a blank line = new paragraph, **text** = emphasis).
The migration that made them rich text turns the stored ones into the same HTML the editor writes."""

import importlib.util

from app.core.config import BASE_DIR
from app.core.text import sanitize_rich_html

[MIGRATION] = (BASE_DIR / "alembic" / "versions").glob("*_project_descriptions_become_rich_text.py")


def _convert():
    spec = importlib.util.spec_from_file_location("project_rich_text_migration", MIGRATION)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.plain_to_html


def test_paragraphs_and_emphasis_become_html():
    text = "Seven **production** modules.\n\nWorked with the client:\nrequirements, specs."
    assert _convert()(text) == (
        "<p>Seven <strong>production</strong> modules.</p><p>Worked with the client:<br>requirements, specs.</p>"
    )


def test_markup_characters_are_escaped_and_the_result_survives_cleaning():
    html = _convert()("Use <script> & 'quotes' — **R&D**")
    assert html == "<p>Use &lt;script&gt; &amp; 'quotes' — <strong>R&amp;D</strong></p>"
    assert sanitize_rich_html(html) == html


def test_empty_text_stays_empty():
    assert _convert()("") == ""
    assert _convert()("  \n\n ") == ""
