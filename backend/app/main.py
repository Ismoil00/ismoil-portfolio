"""FastAPI application factory.

Run in development:  .venv/Scripts/uvicorn app.main:create_app --factory --reload --port 8000
"""

import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import media_files
from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.middleware import BodySizeLimitMiddleware, SecurityHeadersMiddleware
from app.db.session import Database
from app.repositories.chat_model import GroqChatModel
from app.repositories.storage import S3Storage, create_storage
from app.repositories.translation import ClaudeTranslator
from app.services.chat_prompt import FactsCache


def create_app(settings: Settings | None = None, *, database: Database | None = None) -> FastAPI:
    settings = settings or get_settings()

    # Uploads are spooled to temp files: keep them inside the project folder.
    settings.temp_dir.mkdir(parents=True, exist_ok=True)
    tempfile.tempdir = str(settings.temp_dir)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        owned = database is None
        if owned:
            app.state.db = Database(
                settings.database_url(),
                echo=settings.db_echo,
                connect_args=settings.connect_args(),
                hide_parameters=settings.is_production,
                null_pool=settings.db_behind_pooler(),
            )
        if isinstance(app.state.storage, S3Storage):
            await app.state.storage.ensure_bucket()
        yield
        if owned:
            await app.state.db.dispose()

    docs = not settings.is_production
    app = FastAPI(
        title="Portfolio API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs else None,
    )
    app.state.settings = settings
    app.state.storage = create_storage(settings)
    # The Translate button works only with an Anthropic API key; without one it explains how to enable it.
    key = settings.anthropic_api_key.get_secret_value() if settings.anthropic_api_key else ""
    app.state.translator = ClaudeTranslator(key, settings.translation_model) if key else None
    # The public site's AI assistant answers only with a Groq API key (free tier); without one it's off.
    groq_key = settings.groq_api_key.get_secret_value() if settings.groq_api_key else ""
    app.state.chat_model = GroqChatModel(groq_key) if groq_key else None
    app.state.chat_facts = FactsCache()
    app.state.chat_paused = {}
    if database is not None:
        app.state.db = database

    # Last added = outermost: security headers wrap everything, CORS answers preflights before
    # the body limit, and the body limit runs before any route reads the request.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
        max_age=600,
    )
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)

    register_error_handlers(app)
    app.include_router(api_router, prefix="/api/v1")
    if settings.storage_backend == "local":
        app.include_router(media_files.router)
    return app
