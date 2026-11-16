# Admin panel + backend — plan

The contract for building `backend/` (FastAPI) and `frontends/cms-admin/` (Next.js), and for
switching `frontends/public/` from static data to the backend. Written before the build and kept in line
with the code (last checked 2026-11-15); when they disagree, the code wins and this file is fixed.
Progress is tracked in [`PROGRESS.md`](../PROGRESS.md) — read it first when resuming.

## 1. Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Translations | Every visitor-facing text field has **EN / RU / TG tabs**. A **Translate** button fills RU and TG from English with the Claude API (key in `backend/.env`); you check and edit before saving. Without a key the tabs still work by hand. Brand names (companies, technologies, platforms), URLs and emails have one value. |
| 2 | Companies | One **Companies** selector (name, website, logo) used by experience, projects and testimonials. |
| 3 | Development fields | One **Development fields** selector used by: the /experience filter, the /certificates filter ("field of study"), and the tech-stack filters (together with **Instruments**). |
| 4 | Hero stats | The counts come from the server, computed from the content: months of experience (overlapping jobs merged), roles, projects, certificates, technologies. "Projects" stat = all projects, label "projects shipped to production". The site turns months into whole years, with "+" when there are extra months. |
| 5 | Read endpoints | **Separate** `/public/*` and `/admin/*` reads. Public: one language, only what is shown, computed fields, no internal data. Admin: all languages, raw values, private data (contact messages). One shared GET would leak private data and make the public site download 3 languages. |
| 6 | Auth | One admin user, created from the command line. Opaque random session token (no JWT) in an `HttpOnly; Secure; SameSite=Strict` cookie named `__Host-session` (in development over http: `session`, without `Secure`), stored hashed in the DB, 12 h idle / 7 days max, revocable on logout. Argon2id password hashes. CSRF: token cookie + `X-CSRF-Token` header on every write, plus an `Origin` check. Failed logins are limited to 5 per IP and 20 in total per 15 min (forwarded IPs can be faked, the total can't). |
| 7 | Admin ↔ backend | The admin app forwards `/api/*` and `/media/*` to the backend (Next.js rewrites): the browser sees one origin, the cookie is first-party, no CORS needed. Server components call the backend directly and pass the cookie along. The public site reads on the server and sends the contact form through a Server Action. CORS still has an explicit allow-list. |
| 8 | File storage | The "free S3 alternative" is **MinIO**. Note: since late 2025 MinIO no longer publishes free builds and its community edition is in maintenance mode. The backend uses the plain S3 API, so any S3-compatible server works (MinIO, RustFS, SeaweedFS, Garage, Cloudflare R2, AWS S3). In development (no Docker yet) files go to `backend/storage/` on disk; the server is chosen at the Docker step. |
| 9 | Icons | Selector icons are single-color SVGs: picked from a built-in icon library (Simple Icons brand logos + Lucide) or uploaded as `.svg`. The backend sanitizes and stores them; the sites draw them through a CSS mask, so they're always transparent and take any color (brand color, accent, theme). Company and institute logos are uploaded images (SVG / PNG / WebP / JPEG, ≤ 1 MB) shown as-is. |
| 10 | Rich text | The experience job description uses a TipTap editor (bold, italic, underline, strike, bullet and numbered lists, links). It's saved as HTML, cleaned by the backend with an allow-list (`nh3`); the 5000-character limit counts visible text. |
| 11 | Plain text | The project description and hero description are plain textareas: a blank line starts a new paragraph, `**text**` is emphasized (as now). |
| 12 | Location | City (EN/RU/TG) + country (ISO code from a list; names translated by the browser's `Intl`) + time zone (IANA list, shown as "GMT+5", follows daylight saving). |
| 13 | Media | Two-step upload: the file is uploaded first (progress bar) and gets an id; saving the form links the ids. `python -m app.cli cleanup` deletes uploads that nothing uses 24 h after upload (not automatic yet: run it on a schedule once deployed). Video posters are captured in the browser (no ffmpeg). Files are checked by content (magic bytes); images are opened with Pillow (size read, metadata stripped). |
| 14 | Projects | Also need a **title** (EN/RU/TG) and a **slug** (URL, made from the English title, editable): a project can't be shown without them. Cover = one of the gallery images (default: first). Client = Self-initiated project · Private client · a company. |
| 15 | Private projects | Private (NDA) ⇔ no live link and no source link. Private projects take no media. The checkbox and the links lock each other, as described. |
| 16 | Present job | Only one experience can be "present" (DB unique index + check in the service). |
| 17 | Contact form | Rate limit: 5 messages per IP (salted hash, counted in the DB) and 30 in total per hour; hidden honeypot field, length limits, same validation on both sides. |
| 18 | Scope | Monolith, no cache layer, no microservices. Docker comes later. |
| 19 | Order of work | Foundation first, then **section by section**: backend tests → backend code → admin page, so every admin form is built on a real, tested API (nothing written twice against a mock). The public site switches over once all public endpoints exist. |

## 2. Data model (PostgreSQL)

All ids are UUIDs. `I18n` = JSONB `{"en","ru","tg"}`: required fields need all three; optional ones need all three or none.
Months are stored as dates on the 1st (`2024-03-01`) and exchanged as `"YYYY-MM"`.

**Auth**
- `admin_users`: email (unique), password_hash, created_at, last_login_at
- `admin_sessions`: user_id, token_hash (unique), csrf_hash, created_at, last_seen_at, expires_at, ip_hash, user_agent
- `login_attempts`: ip_hash, succeeded, created_at

**Files**
- `media`: purpose (`resume` | `project_image` | `project_video` | `testimonial_image` | `testimonial_video` | `certificate_image` | `logo` | `poster`; decides the allowed types and size), storage_key (unique), content_type, size_bytes, width?, height?, poster_id?, original_name, created_at. No "linked" flag: a file is linked while a row points to it.

**Selectors** (each has `position` for ordering)
- `development_fields`: name I18n, icon_svg?, filter_active, filter_position
- `instruments`: name I18n, icon_svg?, filter_active, filter_position — "Languages & frameworks", "Tools"…
- `tech_stacks`: name (unique), icon_svg, color, docs_url?, showcase_active, showcase_position; M2M → development_fields, instruments
- `positions`: name I18n — my position (testimonials)
- `companies`: name (unique), website_url?, logo_id?
- `institutes`: name I18n, website_url?, logo_id?
- `product_types`: name I18n, icon_svg
- `link_platforms`: name (unique), icon_svg?, color?

**Sections** (single-row tables)
- `hero`: first_name I18n, last_name I18n, role I18n, description I18n?, resume_id, availability (`seeking` | `open` | `unavailable`)
- `about`: title I18n, paragraph_1 I18n, paragraph_2 I18n?, city I18n, country_code, timezone, open_to_remote, open_to_relocation
- `contacts`: email?, telegram?, whatsapp?, linkedin? (at least 2)

**Content**
- `other_links`: platform_id, url, position
- `experiences`: title I18n, company_id, start_month, end_month?, is_current (unique index: only one true), description I18n (HTML); M2M → tech_stacks (≥ 1), development_fields, projects, testimonials
- `projects`: slug (unique), title I18n, description I18n, start_month, end_month, client_kind (`self` | `private` | `company`), company_id?, traffic? (`under100` | `from100` | `from1k` | `from10k` | `from100k` | `over1m`), live_url?, repo_url?, is_private, cover_id?; M2M → product_types (≥ 1), tech_stacks (≥ 1), media
- `testimonials`: author_name I18n, author_role I18n, company_id, position_id, given_on (date), quote I18n?, media_id?, verify_url; M2M → projects
- `certificates`: title I18n, institute_id, start_month, end_month, verify_url?; M2M → development_fields, media (1–5)
- `contact_messages`: name, contact, message, created_at, ip_hash

Every M2M link table keeps a `position`, so every picked list keeps its order.
`projects.traffic` and `certificates.verify_url` may be empty only because the real data seeded on 2026-11-14 lacked them:
the API and the forms still require them on save, the public site hides them when empty, and the admin lists flag "Missing …".
Deleting a selector item or a project/testimonial that something still uses returns **409** with what uses it.

## 3. Field rules (from your spec)

| Section | Field | Rule |
|---|---|---|
| Hero | first name, last name | required, ≤ 100, no spaces (letters, `-`, `'`) |
| | title | required, ≤ 500 |
| | description | optional, ≤ 1000 |
| | resume | required, PDF only, ≤ 10 MB |
| | status | required: seeking / open / not interested |
| About | title | required, ≤ 200 |
| | paragraph 1 / 2 | required / optional, ≤ 1000 |
| | location | required: city + country + time zone |
| | remote / relocation | two checkboxes (true/false) |
| Tech stack | filters | optional, from Development fields + Instruments, ordered |
| | technologies | ≥ 1, from Tech stacks, ordered |
| Experience | title | required, ≤ 200 |
| | from / to | from required; to required unless "present"; only one "present" |
| | company | required (Companies selector) |
| | description | required, rich text, ≤ 5000 |
| | technologies | ≥ 1 · projects, testimonials, development fields: optional |
| Projects | gallery | optional: ≤ 10 images (≤ 10 MB each), ≤ 2 videos (≤ 100 MB each); none if private |
| | live / source link | optional; none ⇒ private |
| | product types | ≥ 1 |
| | from / to | both required |
| | client | Self-initiated / Private client / company |
| | traffic | required (6 ranges) |
| | technologies | ≥ 1 |
| | description | required, ≤ 5000 |
| Testimonials | thumbnail | optional: one image or one video |
| | date | required |
| | name, role | required, ≤ 100 |
| | company, my position | required (selectors) |
| | quote | optional, ≤ 1000 |
| | projects | optional, many |
| | verify link | required |
| Certificates | images | 1–5, ≤ 2 MB each |
| | from / to | both required |
| | name | required, ≤ 200 |
| | institute | required (selector) |
| | verify link | required |
| | development fields | optional |
| Contacts | email, Telegram, WhatsApp, LinkedIn | at least 2 |
| | other links | any number: platform (selector) + URL |
| | messages | table: name, contact, message, date + delete |

Every URL: `http(s)` only, ≤ 2048. Dates can't be in the future; "to" can't be before "from".

## 4. API (`/api/v1`)

**Public** (no auth; `?lang=en|ru|tg`; shapes match `frontends/public/src/types/content.ts`, updated where the data changed)
`GET /public/profile` (hero + about + contacts + other links + all 6 stats) · `GET /public/skills` ·
`GET /public/experience[/filters]` · `GET /public/projects[/filters|/slugs|/{slug}]` ·
`GET /public/certificates[/filters]` · `GET /public/testimonials[/filters]` · `POST /public/contact` · `GET /health`

**Files** `GET /media/{key}` — outside `/api/v1`, local storage only (S3 serves its own files)

**Auth** `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`

**Admin** (session + CSRF on writes)
- `GET|PUT /admin/hero` · `GET|PUT /admin/about` · `GET|PUT /admin/contacts` · `GET|PUT /admin/tech-showcase`
- `/admin/{experiences|projects|testimonials|certificates}`: list, create (`GET|POST /`), read, update, delete (`GET|PUT|DELETE /{id}`)
- `/admin/selectors/{development-fields|instruments|tech-stacks|positions|companies|institutes|product-types|link-platforms}`
  and `/admin/other-links`: list, create (`GET|POST /`), reorder (`PUT /order`), update, delete (`PUT|DELETE /{id}`)
- `GET /admin/messages` · `DELETE /admin/messages/{id}`
- `POST /admin/media` (upload) · `DELETE /admin/media/{id}` (only a file nothing uses yet)
- `POST /admin/translate`

## 5. Security (OWASP)

- **Injection**: SQLAlchemy bound parameters only (no SQL strings built from input); Pydantic `extra="forbid"` input models (no mass assignment).
- **XSS**: React escapes text; rich text and SVGs are cleaned with allow-lists on the backend; only `http(s)`/`mailto` links; uploads served with the right `Content-Type`, `nosniff`, and `Content-Disposition`.
- **CSRF**: SameSite=Strict cookies + token header + `Origin` check on writes.
- **Auth**: Argon2id, opaque sessions (revocable), throttled login, generic error messages, session rotated on login.
- **Headers**: HSTS (prod), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, a strict CSP on API responses (a separate one for files).
- **Uploads**: size limits enforced while streaming, type checked by content, random storage keys, images re-read with Pillow.
- **Deployment**: the Next.js apps must sit behind a reverse proxy (nginx, Caddy, Cloudflare…) that appends the real visitor IP to `X-Forwarded-For`, and their ports must not be reachable directly — Next.js keeps a client-sent `X-Forwarded-For` as is. Per-IP limits rely on it; the site-wide limits hold either way.
- **Misc**: request body cap (110 MB), explicit CORS allow-list, no stack traces in responses, secrets only from env, pinned dependencies (`backend/requirements.lock`; npm lock files), UUIDs (no guessable ids).

## 6. Layout

```
backend/
  app/
    api/            routes only (public/, admin/, auth.py, deps.py)
    services/       business rules
    schemas/        Pydantic validation (in/out)
    models/         SQLAlchemy tables
    repositories/   DB queries + integrations (storage, Claude API)
    core/           settings, security, errors, middleware
    db/             engine, session, base
    cli.py          create-admin, delete-admin, seed, cleanup
  alembic/          migrations
  scripts/          one-time database setup (create_db.ps1 + .sql)
  seed/             content.json: the real content, loaded into an empty database
  storage/          uploaded files in development (git-ignored)
  tests/unit/              pure logic, no database
  tests/integration_api/   HTTP → routes → services → real PostgreSQL test DB (no browser)
frontends/public/      the CV site (Next.js 16, React 19, Tailwind 4, next-intl)
frontends/cms-admin/   same stack and structure as frontends/public (+ axios, TipTap, dnd-kit)
e2e/                   end-to-end tests with Playwright: a real browser on both apps + the backend
docs/                  this plan
architecture_visually_explained/   interactive map of the system (HTML/CSS/JS; open index.html)
```

Each of `backend/`, `frontends/public/`, `frontends/cms-admin/` and `e2e/` has a README with its setup and commands.

Ports in development: public `3000`, admin `3001`, backend `8000`. End-to-end runs: public `3100`, admin `3101`, backend `8100`.
