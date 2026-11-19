"""The ready-made app, for servers that import one instead of calling the factory:
Vercel (see `[tool.vercel] entrypoint` in pyproject.toml) and the Docker image (`uvicorn app.asgi:app`).

Locally, keep using the factory with reload: uvicorn app.main:create_app --factory --reload
"""

from app.main import create_app

app = create_app()
