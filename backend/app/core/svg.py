"""Allow-list cleaning of SVG icons and logos.

An SVG is a document that can run scripts, load other files and embed HTML. Before one is stored it
is parsed safely (no DTDs or entities) and rebuilt from scratch with only drawing elements and
presentation attributes; anything else is dropped. The result can be shown inline or as a mask.
"""

import re
import xml.etree.ElementTree as ET

from defusedxml import DefusedXmlException
from defusedxml.ElementTree import fromstring

MAX_BYTES = 128 * 1024
MAX_ELEMENTS = 4000

SVG_NS = "http://www.w3.org/2000/svg"
DRAWABLE = {"path", "circle", "ellipse", "line", "polyline", "polygon", "rect"}
ALLOWED = DRAWABLE | {"svg", "g", "defs", "linearGradient", "radialGradient", "stop", "clipPath", "title"}
# Wrappers whose content is kept (the wrapper itself goes): links, conditional groups, symbols.
UNWRAP = {"a", "switch", "symbol"}
ATTRIBUTES = {
    "viewBox", "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
    "stroke-dasharray", "stroke-dashoffset", "fill-rule", "clip-rule", "clip-path", "cx", "cy", "r", "rx", "ry",
    "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points", "transform", "opacity", "fill-opacity",
    "stroke-opacity", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "fx", "fy",
    "id", "spreadMethod", "pathLength",
}  # fmt: skip
_INTERNAL_REF = re.compile(r"url\(#[A-Za-z][\w.-]*\)")
_NUMBER = re.compile(r"\d+(?:\.\d+)?")


class InvalidSvg(ValueError):
    pass


def _local(tag: str) -> str | None:
    """Tag name without the SVG namespace; None for elements of other namespaces."""
    if tag.startswith("{"):
        namespace, _, name = tag[1:].partition("}")
        return name if namespace == SVG_NS else None
    return tag


def _safe_value(value: str) -> bool:
    lowered = value.lower()
    if "javascript:" in lowered or "data:" in lowered or "expression" in lowered:
        return False
    if "url(" in lowered:
        return _INTERNAL_REF.fullmatch(value.strip()) is not None
    return True


def _copy(source: ET.Element, target: ET.Element, counter: list[int]) -> None:
    for child in source:
        if not isinstance(child.tag, str):
            continue  # comments / processing instructions
        name = _local(child.tag)
        if name in UNWRAP:
            _copy(child, target, counter)
            continue
        if name not in ALLOWED or name == "svg":
            continue
        counter[0] += 1
        if counter[0] > MAX_ELEMENTS:
            raise InvalidSvg("The SVG is too complex")
        clean = ET.SubElement(target, name)
        for attr, value in child.attrib.items():
            if attr in ATTRIBUTES and _safe_value(value):
                clean.set(attr, value)
        if name == "title" and child.text:
            clean.text = child.text[:200]
        _copy(child, clean, counter)


def sanitize_svg(source: str | bytes) -> str:
    raw = source.encode() if isinstance(source, str) else source
    if not raw.strip() or len(raw) > MAX_BYTES:
        raise InvalidSvg("Upload an SVG file under 128 KB")
    try:
        root = fromstring(raw, forbid_dtd=True)
    except (ET.ParseError, DefusedXmlException, ValueError) as error:
        raise InvalidSvg("This file isn't a valid SVG") from error
    if _local(root.tag) != "svg":
        raise InvalidSvg("This file isn't a valid SVG")

    clean = ET.Element("svg", {"xmlns": SVG_NS})
    for attr, value in root.attrib.items():
        if attr in ATTRIBUTES - {"width", "height", "id"} and _safe_value(value):
            clean.set(attr, value)
    if "viewBox" not in clean.attrib:
        width, height = (_NUMBER.match(root.attrib.get(k, "").strip()) for k in ("width", "height"))
        if not (width and height):
            raise InvalidSvg("The SVG needs a viewBox (or a width and height)")
        clean.set("viewBox", f"0 0 {width.group()} {height.group()}")

    counter = [0]
    _copy(root, clean, counter)
    if not any(_local(el.tag) in DRAWABLE for el in clean.iter()):
        raise InvalidSvg("The SVG has nothing to draw")
    return ET.tostring(clean, encoding="unicode")
