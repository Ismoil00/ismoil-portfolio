"""Public: the contact form — the only thing the public site sends to the backend."""

from fastapi import APIRouter, status

from app.api.deps import IpHashDep, SessionDep, SettingsDep
from app.repositories.sections import MessagesRepository
from app.schemas.sections import ContactMessageIn
from app.services.sections import MessagesService

router = APIRouter(tags=["public"])


@router.post("/contact", status_code=status.HTTP_201_CREATED)
async def send_message(
    data: ContactMessageIn, session: SessionDep, settings: SettingsDep, ip_hash: IpHashDep
) -> dict[str, str]:
    await MessagesService(MessagesRepository(session), settings).receive(data, ip_hash=ip_hash)
    return {"status": "sent"}
