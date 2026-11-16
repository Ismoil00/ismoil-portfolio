# Backend

FastAPI API for the public site ([`frontends/public`](../frontends/public/README.md)) and the admin panel
([`frontends/cms-admin`](../frontends/cms-admin/README.md)). It owns the data: PostgreSQL (schema `work`) and the
uploaded files. Plan and decisions: [`docs/PLAN.md`](../docs/PLAN.md).

Commands below run in PowerShell from the `backend/` folder.

## First-time setup

1. Python 3.13 or newer: `python -m venv .venv`
2. Packages: `.venv/Scripts/python -m pip install -r requirements-dev.txt -c requirements.lock`
3. Settings: `Copy-Item .env.example .env`, then fill in `DB_PASSWORD` and `SECRET_KEY`.
4. Databases: `./scripts/create_db.ps1` (asks for the `postgres` superuser password; safe to run again).
5. Tables: `.venv/Scripts/alembic upgrade head`
6. Content: `.venv/Scripts/python -m app.cli seed` (only into an empty database).
7. Admin user: `.venv/Scripts/python -m app.cli create-admin`
8. Run: `.venv/Scripts/uvicorn app.main:create_app --factory --reload --port 8000`

## Settings (`.env`)

Every setting, its default and which ones are required are listed in [`.env.example`](.env.example). The main ones:

| Variable | What |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `TEST_DB_NAME` | PostgreSQL login and databases (`DB_PASSWORD` required) |
| `SECRET_KEY` | Required; the app refuses to start without it |
| `ADMIN_ORIGINS`, `CORS_ORIGINS`, `TRUSTED_PROXIES` | Who may call the API and whose forwarded IPs are trusted |
| `STORAGE_BACKEND`, `MEDIA_BASE_URL`, `S3_*` | Where uploads go: `local` (`storage/`) or an S3-compatible server |
| `ANTHROPIC_API_KEY` | Optional; enables the admin's Translate button |

Real environment variables (Docker, hosting panel) override `.env`, so a server doesn't need the file.

## Run

- Development: step 8 above → <http://localhost:8000>. API docs: <http://localhost:8000/docs> (not in production).
- Health check: `GET /api/v1/health`

## Command-line tools

| Command | Does |
| --- | --- |
| `.venv/Scripts/python -m app.cli create-admin` | Create the admin user, or reset its password |
| `.venv/Scripts/python -m app.cli delete-admin --email <email>` | Remove an admin user |
| `.venv/Scripts/python -m app.cli seed` | Load `seed/content.json` into an empty database (refuses otherwise) |
| `.venv/Scripts/python -m app.cli cleanup` | Delete uploads nothing uses after 24 h, old login attempts and expired sessions; run it on a schedule once deployed |

Database changes: edit the models in `app/models/`, then `.venv/Scripts/alembic revision --autogenerate -m "what changed"`,
check the new file in `alembic/versions/`, and apply it with `.venv/Scripts/alembic upgrade head`. Finally refresh the
architecture site's database data with `.venv/Scripts/python scripts/export_architecture_db.py`
(`tests/unit/test_architecture_db.py` fails until you do).

## Packages

| File | Holds | Pushed |
| --- | --- | --- |
| `requirements.txt` | Packages the app needs, without versions | Yes |
| `requirements-dev.txt` | The above + test and lint tools | Yes |
| `requirements.lock` | Exact versions of everything installed in `.venv` (both lists + their dependencies) | Yes |

Always install with `-c requirements.lock`. It takes the versions from the lock but installs only what the given list needs, so every computer gets the same versions.

- Development: `pip install -r requirements-dev.txt -c requirements.lock`
- Server: `pip install -r requirements.txt -c requirements.lock` (no test tools)

Add or update a package:

1. Add it to `requirements.txt` (the app uses it) or `requirements-dev.txt` (only tests or tools use it).
2. Install:
   - one new package, others unchanged: `.venv/Scripts/python -m pip install -r requirements-dev.txt -c requirements.lock`
   - update everything to the newest versions: `.venv/Scripts/python -m pip install -U -r requirements-dev.txt`
3. Run the tests (below).
4. Refresh the lock from the full development install:
   `.venv/Scripts/python -m pip freeze | Set-Content -Encoding ascii requirements.lock`

`tests/unit/test_requirements.py` fails when a listed package is missing from the lock.

## Checks

- Tests: `.venv/Scripts/python -m pytest` (unit + API integration; needs the databases from step 4).
- Lint: `.venv/Scripts/ruff check .` and `.venv/Scripts/ruff format --check .`
- End-to-end (browser): see [`e2e/README.md`](../e2e/README.md).

## Folders

| Folder | Holds | Pushed |
| --- | --- | --- |
| `app/` | The application | Yes |
| `alembic/` | Database migrations | Yes |
| `scripts/` | One-time database setup; the architecture site's database export | Yes |
| `seed/` | Starting content for an empty database | Yes |
| `tests/` | Unit and API integration tests | Yes |
| `storage/` | Uploaded files in development | No |
| `.tmp/` | Temp files and test sandboxes | No |
