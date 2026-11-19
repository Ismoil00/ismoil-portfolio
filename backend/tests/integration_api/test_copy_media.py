"""Moving the existing uploads from the local folder to the production storage (`python -m app.cli copy-media`):
every file the database knows is copied under the same key, so the database itself needs no change."""

import io

from app.models import Media
from app.repositories.storage import BlobStorage, LocalStorage
from app.services.maintenance import copy_media
from tests.blob_fake import BASE_URL, FakeBlobClient


async def test_every_known_file_is_copied_and_the_resume_keeps_its_name(db_session, settings, storage_dir):
    local = LocalStorage(storage_dir, "http://localhost:8000/media")
    await local.save("project_image/a1.png", io.BytesIO(b"png"), "image/png")
    await local.save("resume/b2.pdf", io.BytesIO(b"%PDF-1.7"), "application/pdf")
    rows = [
        Media(purpose="project_image", storage_key="project_image/a1.png", content_type="image/png", size_bytes=3,
              original_name="shot.png"),
        Media(purpose="resume", storage_key="resume/b2.pdf", content_type="application/pdf", size_bytes=8,
              original_name="CV - En.pdf"),
        Media(purpose="project_image", storage_key="project_image/gone.png", content_type="image/png", size_bytes=1,
              original_name="lost.png"),
    ]  # fmt: skip
    db_session.add_all(rows)
    await db_session.flush()

    fake = FakeBlobClient()
    copied, missing = await copy_media(db_session, local, BlobStorage(BASE_URL, client=fake))

    assert (copied, missing) == (2, ["project_image/gone.png"])
    assert fake.files["project_image/a1.png"].body == b"png"
    assert fake.files["resume/b2/CV - En.pdf"].content_type == "application/pdf"

    # Running it again is safe (files are overwritten, nothing is duplicated).
    assert (await copy_media(db_session, local, BlobStorage(BASE_URL, client=fake)))[0] == 2
    assert len(fake.files) == 2
