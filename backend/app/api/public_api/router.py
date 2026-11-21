"""Every public route: read-only data for the public site, plus the contact form, visit statistics and the
AI assistant."""

from fastapi import APIRouter

from app.api.public_api import chat, contact, content, events

public_router = APIRouter(prefix="/public")
public_router.include_router(chat.router)
public_router.include_router(contact.router)
public_router.include_router(content.router)
public_router.include_router(events.router)
