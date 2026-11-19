"""Every public route: read-only data for the public site, plus the contact form."""

from fastapi import APIRouter

from app.api.public_api import contact, content

public_router = APIRouter(prefix="/public")
public_router.include_router(contact.router)
public_router.include_router(content.router)
