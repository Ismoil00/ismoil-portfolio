"""All API routes, mounted under /api/v1."""

from fastapi import APIRouter

from app.api import auth
from app.api.admin.router import admin_router
from app.api.public.router import public_router

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin_router)
api_router.include_router(public_router)


@api_router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
