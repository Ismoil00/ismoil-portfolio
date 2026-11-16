"""Which files may be uploaded where. Types are recognized from the file's first bytes, never
from its name or the browser's Content-Type (both are chosen by the uploader)."""

from dataclasses import dataclass
from urllib.parse import quote

from app.models.enums import MediaPurpose

MB = 1024 * 1024

IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"})
VIDEO_TYPES = frozenset({"video/mp4", "video/webm", "video/quicktime"})
SVG = "image/svg+xml"

EXTENSIONS = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    SVG: "svg",
}

# Files a browser should save under their uploaded name (the résumé) instead of showing in the page.
ATTACHMENT_TYPES = frozenset({"application/pdf"})


def content_disposition(filename: str) -> str:
    """The download header that keeps the exact file name (RFC 6266).

    `filename*` carries the real name, UTF-8 and percent-encoded, so spaces, Cyrillic and any symbol survive;
    `filename` is a plain-ASCII stand-in for very old clients. Neither part can break out of the header.
    """
    fallback = "".join(c if " " <= c <= "~" and c not in '"\\;' else "_" for c in filename)
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"


@dataclass(frozen=True)
class UploadRule:
    types: frozenset[str]
    max_bytes: int
    label: str  # what to ask for in the error message


RULES: dict[MediaPurpose, UploadRule] = {
    MediaPurpose.RESUME: UploadRule(frozenset({"application/pdf"}), 10 * MB, "a PDF file"),
    MediaPurpose.PROJECT_IMAGE: UploadRule(IMAGE_TYPES, 10 * MB, "a JPEG, PNG, WebP, GIF or AVIF image"),
    MediaPurpose.PROJECT_VIDEO: UploadRule(VIDEO_TYPES, 100 * MB, "an MP4, WebM or MOV video"),
    MediaPurpose.TESTIMONIAL_IMAGE: UploadRule(IMAGE_TYPES, 10 * MB, "a JPEG, PNG, WebP, GIF or AVIF image"),
    MediaPurpose.TESTIMONIAL_VIDEO: UploadRule(VIDEO_TYPES, 100 * MB, "an MP4, WebM or MOV video"),
    MediaPurpose.CERTIFICATE_IMAGE: UploadRule(IMAGE_TYPES, 2 * MB, "a JPEG, PNG, WebP, GIF or AVIF image"),
    MediaPurpose.LOGO: UploadRule(
        frozenset({SVG, "image/png", "image/webp", "image/jpeg"}), 1 * MB, "an SVG, PNG, WebP or JPEG image"
    ),
    MediaPurpose.POSTER: UploadRule(frozenset({"image/jpeg", "image/webp", "image/png"}), 2 * MB, "a JPEG image"),
}

_MP4_BRANDS = {
    b"isom", b"iso2", b"iso4", b"iso5", b"iso6", b"mp41", b"mp42", b"avc1", b"M4V ", b"dash", b"mmp4", b"MSNV",
}  # fmt: skip


class UploadRejected(ValueError):
    def __init__(self, message: str, *, too_large: bool = False) -> None:
        super().__init__(message)
        self.too_large = too_large


def sniff_type(head: bytes) -> str | None:
    """MIME type from the first bytes (64 are enough), or None when it isn't a supported format."""
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"avif", b"avis"):
            return "image/avif"
        if brand == b"qt  ":
            return "video/quicktime"
        if brand in _MP4_BRANDS:
            return "video/mp4"
        return None
    if head.startswith(b"\x1a\x45\xdf\xa3"):  # EBML: WebM (Matroska in general isn't playable everywhere)
        return "video/webm" if b"webm" in head else None
    text = head.lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    if text.startswith(b"<svg") or (text.startswith((b"<?xml", b"<!--")) and b"<svg" in text):
        return SVG
    return None


def check_upload(purpose: MediaPurpose, head: bytes, size: int) -> str:
    """The detected MIME type, or UploadRejected when the file doesn't fit this use."""
    rule = RULES[purpose]
    if size > rule.max_bytes:
        raise UploadRejected(f"The file is larger than {rule.max_bytes // MB} MB", too_large=True)
    kind = sniff_type(head)
    if kind not in rule.types:
        raise UploadRejected(f"Upload {rule.label}")
    return kind
