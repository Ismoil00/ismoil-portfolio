"""Public: the AI assistant. The public site's server calls it for each question and streams the answer
on to the browser."""

import uuid

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.api.deps import SessionDep, SettingsDep, StorageDep, VisitorDep
from app.core.net import hash_ip
from app.repositories.chat import ChatRepository
from app.repositories.public import PublicRepository
from app.repositories.settings import SettingsRepository
from app.schemas.chat import ChatIn
from app.services.chat import Asker, ChatService
from app.services.chat_prompt import build_facts
from app.services.public import PublicService
from app.services.settings import PanelSettingsService

router = APIRouter(tags=["public"])


async def assistant_on(request: Request, session) -> bool:
    """The admin switched the assistant on, and the backend has a model to answer with (GROQ_API_KEY)."""
    if getattr(request.app.state, "chat_model", None) is None:
        return False
    return await PanelSettingsService(SettingsRepository(session), claude_ready=False).assistant_enabled()


@router.post("/chat", response_class=StreamingResponse)
async def ask(
    data: ChatIn,
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    storage: StorageDep,
    visitor: VisitorDep,
) -> StreamingResponse:
    state = request.app.state
    service = ChatService(
        ChatRepository(session),
        settings,
        getattr(state, "chat_model", None),
        enabled=await assistant_on(request, session),
        paused=state.chat_paused,
    )
    secret = settings.secret_key.get_secret_value()
    asker = Asker(
        ip_hash=visitor.ip_hash,
        net_hash=visitor.net_hash,
        session_hash=hash_ip(str(data.session_id), secret) if data.session_id else None,
    )

    async def facts() -> str:
        return await state.chat_facts.get(lambda: build_facts(PublicService(PublicRepository(session), storage)))

    answer = await service.start(data, asker, facts)

    async def record(usage_id: uuid.UUID, model: str, tokens: int) -> None:
        # A fresh session: the answer is written after the request's own work is done.
        async for db in state.db.session():
            await ChatRepository(db).finish_usage(usage_id, model, tokens)
            await db.commit()

    return StreamingResponse(
        service.stream(answer, record),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
