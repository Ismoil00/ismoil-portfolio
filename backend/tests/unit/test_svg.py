"""SVG icons and logos are cleaned with an allow-list before they are stored."""

import pytest

from app.core.svg import InvalidSvg, sanitize_svg

ICON = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke-width="0">'
    '<path d="M12 2L2 22h20z"/><circle cx="12" cy="12" r="3"/></svg>'
)


def test_keeps_a_clean_icon():
    clean = sanitize_svg(ICON)
    assert clean.startswith("<svg")
    assert 'viewBox="0 0 24 24"' in clean
    assert '<path d="M12 2L2 22h20z"' in clean
    assert "<circle" in clean


@pytest.mark.parametrize(
    "payload",
    [
        '<svg viewBox="0 0 1 1" onload="alert(1)"><path d="M0 0"/></svg>',
        '<svg viewBox="0 0 1 1"><script>alert(1)</script><path d="M0 0"/></svg>',
        '<svg viewBox="0 0 1 1"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">x</body>'
        '</foreignObject><path d="M0 0"/></svg>',
        '<svg viewBox="0 0 1 1" xmlns:xlink="http://www.w3.org/1999/xlink">'
        '<use xlink:href="https://evil.example/x.svg#a"/><path d="M0 0"/></svg>',
        '<svg viewBox="0 0 1 1"><a href="javascript:alert(1)"><path d="M0 0"/></a></svg>',
        '<svg viewBox="0 0 1 1"><path d="M0 0" style="fill:url(https://evil.example)"/></svg>',
        '<svg viewBox="0 0 1 1"><path d="M0 0" fill="url(https://evil.example/x)"/></svg>',
    ],
)
def test_removes_anything_active_or_external(payload):
    clean = sanitize_svg(payload).lower()
    for bad in ("script", "onload", "foreignobject", "<use", "javascript", "evil.example", "style=", "<a "):
        assert bad not in clean
    assert "<path" in clean


def test_keeps_internal_gradient_references_for_logos():
    logo = (
        '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/>'
        '</linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>'
    )
    clean = sanitize_svg(logo)
    assert 'fill="url(#g)"' in clean
    assert "<linearGradient" in clean


@pytest.mark.parametrize(
    "payload",
    [
        "",
        "not xml at all",
        "<html><body>x</body></html>",
        '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "xxxxxxxx">]><svg viewBox="0 0 1 1">&x;</svg>',
        '<svg viewBox="0 0 1 1"></svg>',  # nothing to draw
        "<svg>" + '<path d="M0 0"/>' * 20000 + "</svg>",  # too big
    ],
)
def test_rejects_invalid_or_dangerous_documents(payload):
    with pytest.raises(InvalidSvg):
        sanitize_svg(payload)


def test_adds_a_viewbox_from_width_and_height_and_drops_fixed_size():
    clean = sanitize_svg('<svg width="32" height="16"><path d="M0 0h32v16z"/></svg>')
    assert 'viewBox="0 0 32 16"' in clean
    assert "width=" not in clean and "height=" not in clean.split(">")[0]
