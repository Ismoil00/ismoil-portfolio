# The backend as a container image: the same app Vercel runs, for `docker compose up` (repo root)
# and for the pipeline, which builds this image on every change to prove it still works.
#
#   docker build -t portfolio-backend backend
#   docker run --env-file backend/.env -p 8000:8000 portfolio-backend

FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=60 \
    PIP_RETRIES=10

WORKDIR /app

# Dependencies first: this layer is reused until requirements change.
COPY requirements.txt requirements.lock ./
RUN pip install -r requirements.txt -c requirements.lock

COPY alembic.ini ./
COPY alembic ./alembic
COPY seed ./seed
COPY app ./app

# Never run as root. Uploads (local storage) and temp files go to folders this user owns.
RUN useradd --create-home --uid 10001 portfolio \
    && mkdir -p /app/storage /app/.tmp \
    && chown portfolio /app/storage /app/.tmp
USER portfolio

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')"]
CMD ["uvicorn", "app.asgi:app", "--host", "0.0.0.0", "--port", "8000"]
