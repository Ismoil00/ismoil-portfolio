"""A downloaded file keeps the name it was uploaded with (spaces, Cyrillic and all)."""

from urllib.parse import unquote

import pytest

from app.core.files import content_disposition
from app.services.media import download_name


@pytest.mark.parametrize(
    ("uploaded", "extension", "kept"),
    [
        ("CV - Ru - Sharifov Ismoil.pdf", "pdf", "CV - Ru - Sharifov Ismoil.pdf"),
        ("Резюме — Шарифов Исмоил.pdf", "pdf", "Резюме — Шарифов Исмоил.pdf"),
        ("My CV (2026).pdf", "pdf", "My CV (2026).pdf"),
        ("cv.PDF", "pdf", "cv.PDF"),
        ("photo.jpeg", "jpg", "photo.jpeg"),
        ("photo", "png", "photo.png"),
        ("report.docx", "pdf", "report.docx.pdf"),  # the content decides the real type
        ("C:\\fakepath\\My CV.pdf", "pdf", "My CV.pdf"),
        ("folder/My CV.pdf", "pdf", "My CV.pdf"),
        ("bad\r\nname\x00.pdf", "pdf", "badname.pdf"),
        ("  My CV.pdf  ", "pdf", "My CV.pdf"),
        ("   ", "pdf", "file.pdf"),
        ("", "pdf", "file.pdf"),
    ],
)
def test_the_uploaded_name_is_kept(uploaded, extension, kept):
    assert download_name(uploaded, extension) == kept


def test_very_long_names_are_shortened_but_keep_the_extension():
    name = download_name("x" * 400 + ".pdf", "pdf")
    assert len(name) == 255
    assert name.endswith(".pdf")


def test_the_download_header_carries_the_exact_name():
    header = content_disposition("CV - Ru - Sharifov Ismoil.pdf")
    assert header == (
        "attachment; filename=\"CV - Ru - Sharifov Ismoil.pdf\"; filename*=UTF-8''CV%20-%20Ru%20-%20Sharifov%20Ismoil.pdf"
    )


def test_names_outside_ascii_are_sent_encoded_with_an_ascii_fallback():
    header = content_disposition("Резюме Шарифов.pdf")
    assert header.isascii()
    assert unquote(header.split("filename*=UTF-8''")[1]) == "Резюме Шарифов.pdf"
    assert 'filename="' in header


@pytest.mark.parametrize("name", ['say "hi".pdf', "back\\slash.pdf", "semi;colon.pdf", "line\r\nbreak.pdf"])
def test_no_name_can_break_out_of_the_header(name):
    header = content_disposition(name)
    fallback = header.split('filename="')[1].split('"; filename*=')[0]
    assert '"' not in fallback and "\\" not in fallback
    assert "\r" not in header and "\n" not in header
    assert header.count(";") == 2
