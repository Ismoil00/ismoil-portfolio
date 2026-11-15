# Progress — admin panel + backend

Plan and decisions: [`docs/PLAN.md`](docs/PLAN.md). Resume from the first unchecked item.

_Last updated: 2026-11-15 (docs pass + pre-commit audit) — backend: 303 tests passing + ruff clean; admin and public: tsc + eslint clean; public `next build` passes; E2E: 37 passing_

## Phases

- [x] **0. Plan** — decisions, data model, API, security (docs/PLAN.md)
- [x] **1. Backend foundation** — venv, dependencies, settings, async DB, Alembic, test setup, middleware, error format, 33 tables.
  - DB: the user's own PostgreSQL login is in `backend/.env` (DB_USER/DB_PASSWORD — never print it). Databases `portfolio` + `portfolio_test` created; every table lives in schema `DB_SCHEMA=work` (connection search_path); `DB_ECHO` logs SQL (values hidden in production). Migration `alembic/versions/*_initial_schema.py` applied.
  - Test DB guard: the suite refuses to wipe a database whose name doesn't end in `_test`.
- [x] **2. Auth** — sessions, CSRF, origin check, per-IP + site-wide login throttling (forwarded IPs can be faked when Next.js is reached directly), CLI `create-admin` / `delete-admin` / `cleanup`.
  - Temporary dev admin for browser testing: `.dev-credentials` at the repo root (git-ignored). Delete before launch: `python -m app.cli delete-admin --email dev-admin@example.com`.
- [x] **3. Media** — uploads (content-sniffed, EXIF stripped, SVG sanitized), local + S3 storage, serving with safe headers.
- [x] **5a. Selectors backend** — all 8 kinds, tested.
- [x] **4. Admin app shell** — `frontends/cms-admin`, port 3001: design tokens, fonts, themes, login page (redirect without cookie), sidebar + mobile drawer, axios client with CSRF + 401 → login, server-side fetch with cookie forwarding, toasts, dialogs. Used against the running backend from phase 5 on and covered by the E2E tests.
  - Form kit done: Field/TextInput/TextArea, I18nField (EN/RU/TG tabs + Translate), RichTextEditor (TipTap), Picker (single/multi + search), MonthField, Checkbox, RadioCards, ColorField, IconPicker (Simple Icons + Lucide library, .svg upload), LogoField, SortableList (dnd-kit)
- [x] **5. Selectors** — backend + admin page, tried in the browser (login, add development field, add technology with library icon + color + category). Fixed: Esc in nested windows/dropdowns closed the outer dialog; dialogs now focus their first field.
- [x] **6. Hero · About · Contacts · Tech stack** — backend tested; admin pages done and tried in the browser (About, Contacts incl. "at least two" rule, Tech stack saved through the UI; Hero renders — its PDF upload is covered by API tests, the browser pane can't pick files). Contacts page also has Other links (sortable) and the Messages table.
  - Fixed: Tailwind scanned from the repo root (dev server cwd) and missed classes in new files → `@import "tailwindcss" source("..")` in admin globals.css (do the same in the public app).
- [x] **7. Experience · Projects · Testimonials · Certificates** — backend done and tested (CRUD, one "present" job, private ⇔ no links/media, gallery limits + cover, slugs, removed files deleted, in-use guards). Admin list + editor pages for all four (`/experience`, `/projects`, `/testimonials`, `/certificates`, each with `/new` and `/[id]`).
  - Tried in the browser: full experience entry (3-language title, rich text with bold + list, company, months, "I work here now", technology) saved and listed. Project/testimonial/certificate editors render; file uploads can't be driven from the browser pane — covered by the API tests.
  - Fixed: Card backdrop-blur trapped dropdowns under the next card (removed).
- [x] **8. Translate button** — `POST /admin/translate` (Claude Opus 5.5, low effort, JSON output, server-side refusal fallback), results sanitized; 503 with a clear message while `ANTHROPIC_API_KEY` is empty. Tested with a fake translator; no real call made yet (no key).
- [x] **9. Seed** — done: `backend/seed/content.json` (exported once, script in the session scratchpad), `python -m app.cli seed` (tests in `test_seed.py`); the dev DB was reset and seeded on 2026-11-14. Design:
  - One-off export (Node, type-stripping) of frontends/public/src/data/content (en/ru/tg/shared, NOT fake/) + messages labels + icon SVGs (react-icons rendered to markup) → `backend/seed/content.json` (committed). `python -m app.cli seed` loads it into an EMPTY database (refuses otherwise) + uploads the résumé PDF.
  - Real data lacks some now-required fields: project traffic (×3), diploma image + verify link. Never invent them: DB columns `projects.traffic` and `certificates.verify_url` become nullable (API/forms still require them on save), public hides them when empty, admin lists flag "Missing …".
  - Selectors seeded: dev fields = experience fields ∪ study fields (+ tech categories Databases/Frontend/AI & LLM), instruments = Languages & frameworks / APIs & protocols / Tools, 43 techs (+ "Micro-frontends", "OpenAPI" used by experience/projects, not shown), 8 product types, positions from real roles, companies Smartpay + Vatan ICT, institute TTU, 16 link platforms (LinkIcon list).
- [x] **10. Public site** — public endpoints (`/public/profile|skills|experience[/filters|/summary]|projects[/filters|/slugs|/{slug}]|certificates[/filters]|testimonials[/filters]`, schemas in `app/schemas/public.py`) and the site switched to them:
  - `src/types/content.ts` = the API shapes; `src/api/*.api.ts` call the backend (server-only `API_URL` in `frontends/public/.env.local`); list pages load more through Server Actions; the contact form is a Server Action (honeypot, rate-limit message).
  - Deleted: `src/data` (static + fake data), `api/static`, `LinkIcon`, `product-types`, `tech-icons`, unused messages (`productTypes`, `experience.workMode`).
  - Icons from the DB → `components/ui/SvgIcon.tsx`; experience description = sanitized HTML in `.rich-text`; certificates show all images in the lightbox; testimonials list several projects ("Project"/"Projects" in 3 languages).
  - Every page renders per request (`force-dynamic` in the [locale] layout; the old `revalidate = 3600` lines removed; sitemap built on request too, no backend needed at build time).
  - Nothing optional is shown when missing: traffic row hidden; no testimonials → home section + menu link hidden, `/testimonials` is a 404 and left out of the sitemap.
- [x] **11. Final check** — 299 backend tests + ruff; admin + public tsc/eslint; public production build. In the browser: every public page in EN/RU/TG, dark + light, phone width (no sideways scroll), project filter, Other links layer, contact form (empty → error, real send → saved; the test message was deleted), résumé served as PDF download. A temporary test testimonial was added through the admin API to check the card and section, then deleted.

- [x] **12. End-to-end tests** (2026-11-15) — `backend/tests/e2e` renamed to `backend/tests/integration_api` (API integration tests, no browser; underscore because Python can't import a folder with a hyphen). Root `e2e/` added: Playwright 1.64.1 driving the installed Microsoft Edge (no browser download; temp files and profiles stay in `e2e/.tmp`), its own backend on 8100 with a fresh seeded `portfolio_e2e` database per run, production builds of the site (3100) and admin (3101). See `e2e/README.md`.
  - 37 tests pass (~1 min after the builds): admin sign-in/out + redirects, About + Hero edits shown on the site in the right language, Translate without a key, "Missing …" badges, contact form → admin messages → delete, filters + URL state, Show more (11 temporary projects), every page × EN/RU/TG without console errors, language switcher, light/dark on both apps, testimonials hidden while none (section, menu, 404, sitemap), no traffic row, NDA note, phone width.
  - First run: 2 failures, both test mistakes (label lookup; Translate's confirm dialog), no app bugs. Mutation check: removing the testimonials 404 rule made the suite fail, restoring it made it pass.

- [x] **13. Docs and housekeeping** (2026-11-15)
  - `docs/PLAN.md` checked against the code and updated: table and column names (`admin_sessions`, `media.purpose`, `logo_id`, `resume_id`, `cover_id`), optional `traffic` / `verify_url` for seeded rows, login and contact limits (per IP + site-wide), hero stats (5 counts from the server), cleanup is a command, full admin API (reorder, media delete, health), security headers, layout + E2E ports.
  - READMEs: `backend/README.md` (setup, settings, run, command-line tools, migrations, packages, checks), `frontends/cms-admin/README.md` (new), `frontends/public/README.md` (replaced the create-next-app template).
  - Backend packages: install with `-c requirements.lock` (a server install gets no test tools; checked with pip dry runs), guarded by `tests/unit/test_requirements.py`. pytest temp files pinned to `backend/.tmp` (`tests/unit/test_temp_location.py`).
  - Pre-commit audit: the 355 files to commit hold no secrets (real `.env` / `.dev-credentials` values and key patterns checked); every `.env`, credentials, cache, build, report and upload folder is ignored. Removed: pip and npm install logs, 5 create-next-app SVGs, unused `Tag.tsx` and `lib/urls.ts` in the public site. Added: root `README.md`, `.gitattributes`. All npm and Python dependencies are in use. Checks after: 303 backend tests + ruff, tsc + eslint on both apps, E2E 37/37.

## Next steps

1. The user creates their own admin (`cd backend && .venv/Scripts/python -m app.cli create-admin`), then removes the temporary one (`python -m app.cli delete-admin --email dev-admin@example.com`) and `.dev-credentials` (repo root).
2. Fill in the gaps flagged "Missing …" in the admin lists: traffic for the 3 projects, diploma image + verify link.
3. Set `ANTHROPIC_API_KEY` in `backend/.env` to enable the Translate button.
4. Later: Docker; deployment behind a reverse proxy that sets X-Forwarded-For (see docs/PLAN.md); run `python -m app.cli cleanup` on a schedule there.

## Notes for resuming

- Setup and commands per project: [`backend/README.md`](backend/README.md), [`frontends/public/README.md`](frontends/public/README.md), [`frontends/cms-admin/README.md`](frontends/cms-admin/README.md), [`e2e/README.md`](e2e/README.md). Keep `docs/PLAN.md` in line with the code when something changes.
- Backend packages: Always install with `-c requirements.lock` (exact versions; a server install from `requirements.txt` gets no test tools). `tests/unit/test_requirements.py` guards the lock.
- Run things: `.claude/launch.json` has `public` (3000), `admin` (3001), `backend` (8000).
  Backend tests: `cd backend && .venv/Scripts/python -m pytest` (unit + integration_api; the latter needs the databases).
  End-to-end: `cd e2e && npm test` (starts its own backend + production builds on 8100/3100/3101).
  Admin checks: `cd frontends/cms-admin && npx tsc --noEmit && npx eslint src`.
- Public checks: `cd frontends/public && npx tsc --noEmit && npx eslint src` (needs the backend running to render).
- Line endings: `.gitattributes` (`* text=auto eol=lf`) stores every text file with LF; the working copy may still hold CRLF files from earlier Windows edits, which git converts on commit.

- Never touch files outside `C:\Users\admin\Desktop\portfoliio`. pip runs with `--no-cache-dir`, npm with a cache inside the repo.
- Temp files: the app points Python's temp folder at `backend/.tmp` when it starts; `tests/conftest.py` (`pytest_configure`) does the same before any test, so pytest's `tmp_path` sandboxes stay in `backend/.tmp/pytest-of-<user>` (last 3 runs kept) even when only unit tests run. Guarded by `tests/unit/test_temp_location.py`. `backend/.tmp` holds no test results (pytest prints them; E2E reports live in `e2e/`).
- The user usually runs the public site on port 3000 themselves.
