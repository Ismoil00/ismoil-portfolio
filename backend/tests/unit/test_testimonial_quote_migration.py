"""Testimonial quotes used to be plain text (a blank line = new paragraph). The migration that made
them rich text turns the stored ones into the same HTML the editor writes."""

import importlib.util

from app.core.config import BASE_DIR
from app.core.text import sanitize_rich_html

[MIGRATION] = (BASE_DIR / "alembic" / "versions").glob("*_testimonial_quotes_become_rich_text.py")


def _module():
    spec = importlib.util.spec_from_file_location("testimonial_quote_migration", MIGRATION)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_paragraphs_become_html_and_survive_cleaning():
    html = _module().plain_to_html("He carried <a lot> & more.\n\nSecond line\nwrapped.")
    assert html == "<p>He carried &lt;a lot&gt; &amp; more.</p><p>Second line<br>wrapped.</p>"
    assert sanitize_rich_html(html) == html


def test_the_way_back_gives_the_plain_text():
    module = _module()
    text = "First.\n\nSecond\nline."
    assert module.html_to_plain(module.plain_to_html(text)) == text
