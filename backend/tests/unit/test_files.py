"""Uploaded files are recognized by their content, and each use has its own types and size limit."""

import io

import pytest
from PIL import Image

from app.core.files import RULES, UploadRejected, check_upload, sniff_type
from app.models.enums import MediaPurpose

MB = 1024 * 1024


def image_bytes(fmt: str, size=(8, 6)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (30, 60, 200)).save(buffer, format=fmt)
    return buffer.getvalue()


SAMPLES = {
    "application/pdf": b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj",
    "image/png": image_bytes("PNG"),
    "image/jpeg": image_bytes("JPEG"),
    "image/webp": image_bytes("WEBP"),
    "image/gif": image_bytes("GIF"),
    "video/mp4": b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41",
    "video/quicktime": b"\x00\x00\x00\x14ftypqt  \x00\x00\x00\x00qt  ",
    "video/webm": b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\x82\x84webm",
    "image/avif": b"\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1miaf",
    "image/svg+xml": b'<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
}


@pytest.mark.parametrize(("expected", "data"), SAMPLES.items())
def test_sniffs_types_from_content(expected, data):
    assert sniff_type(data[:64]) == expected


def test_unknown_content_is_not_guessed():
    assert sniff_type(b"MZ\x90\x00 an exe") is None
    assert sniff_type(b"<html><script>") is None


def test_resume_accepts_only_pdf_up_to_10_mb():
    assert check_upload(MediaPurpose.RESUME, SAMPLES["application/pdf"], 3 * MB) == "application/pdf"
    with pytest.raises(UploadRejected):
        check_upload(MediaPurpose.RESUME, SAMPLES["image/png"], 1000)
    with pytest.raises(UploadRejected) as error:
        check_upload(MediaPurpose.RESUME, SAMPLES["application/pdf"], 10 * MB + 1)
    assert error.value.too_large


@pytest.mark.parametrize(
    ("purpose", "limit_mb"),
    [
        (MediaPurpose.PROJECT_IMAGE, 10),
        (MediaPurpose.PROJECT_VIDEO, 100),
        (MediaPurpose.TESTIMONIAL_IMAGE, 10),
        (MediaPurpose.TESTIMONIAL_VIDEO, 100),
        (MediaPurpose.CERTIFICATE_IMAGE, 2),
        (MediaPurpose.LOGO, 1),
    ],
)
def test_size_limits_per_use(purpose, limit_mb):
    assert RULES[purpose].max_bytes == limit_mb * MB


def test_images_and_videos_go_only_where_they_belong():
    for kind in ("image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"):
        assert check_upload(MediaPurpose.PROJECT_IMAGE, SAMPLES[kind], 1000) == kind
    for kind in ("video/mp4", "video/webm", "video/quicktime"):
        assert check_upload(MediaPurpose.PROJECT_VIDEO, SAMPLES[kind], 1000) == kind
        with pytest.raises(UploadRejected):
            check_upload(MediaPurpose.PROJECT_IMAGE, SAMPLES[kind], 1000)
    with pytest.raises(UploadRejected):
        check_upload(MediaPurpose.PROJECT_VIDEO, SAMPLES["image/png"], 1000)


def test_svg_only_for_logos():
    assert check_upload(MediaPurpose.LOGO, SAMPLES["image/svg+xml"], 1000) == "image/svg+xml"
    with pytest.raises(UploadRejected):
        check_upload(MediaPurpose.PROJECT_IMAGE, SAMPLES["image/svg+xml"], 1000)
