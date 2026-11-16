// Inside the backend (backend/app): the request path through the layers, and which file does what.
window.ARCH = window.ARCH || {};

window.ARCH.backend = {
  // Top to bottom = the path of one request.
  layers: [
    {
      id: "middleware", title: "Middleware", sub: "wraps every request", color: "--l-1",
      rule: "Runs before any route. Outermost first: security headers → CORS → body-size cap. Added in main.py (last added = outermost).",
      files: [
        ["app/core/middleware.py", "SecurityHeadersMiddleware (nosniff, DENY framing, no-referrer, Permissions-Policy, CSP, HSTS in production) and BodySizeLimitMiddleware (110 MB cap while streaming)."],
        ["app/main.py", "create_app(): builds the app, opens the database pool in lifespan, picks local or S3 storage, creates the Claude translator only when a key is set, adds middleware and routers."],
      ],
    },
    {
      id: "routers", title: "Routers", sub: "/api/v1/… → which file", color: "--l-2",
      rule: "Only map URLs to handlers. The admin router adds the guard to every admin route at once.",
      files: [
        ["app/api/router.py", "All API routes, mounted under /api/v1: auth, admin, public."],
        ["app/api/admin/router.py", "Every admin route: a signed-in session is required, plus CSRF token and allowed Origin on writes (dependency current_admin)."],
        ["app/api/public/router.py", "Every public route: read-only data for the public site, plus the contact form."],
        ["app/api/media_files.py", "GET /media/{key}: serves uploaded files from the local disk (development only; with S3 the storage server serves them). The résumé downloads under the name it was uploaded with."],
      ],
    },
    {
      id: "deps", title: "Dependencies", sub: "built per request", color: "--l-3",
      rule: "FastAPI Depends(): each request gets its own database session, settings, hashed client IP, storage and service objects. Handlers never create these themselves.",
      files: [
        ["app/api/deps.py", "SessionDep (one AsyncSession per request), SettingsDep, IpHashDep (salted hash of the real client IP), StorageDep, MediaServiceDep."],
        ["app/api/auth_deps.py", "current_admin: valid session cookie; on writes also the Origin check and the CSRF token check."],
      ],
    },
    {
      id: "handlers", title: "Route handlers", sub: "app/api/** — thin", color: "--l-4",
      rule: "Read the validated input, call one service, turn the result into a response schema. No SQL, no business rules here.",
      files: [
        ["app/api/auth.py", "Sign in / sign out of the admin panel; GET /auth/me."],
        ["app/api/admin/sections.py", "Hero, About, Contacts (+ Other links, messages) and the Tech stack page."],
        ["app/api/admin/content.py", "Experience, projects, testimonials and certificates: list, read, create, update, delete (one _register() per kind)."],
        ["app/api/admin/selectors.py", "The Selectors page: the same five routes for every kind of reusable list (one _register() per kind)."],
        ["app/api/admin/media.py", "Upload a file (step 1 of saving a form with files), or discard an unsaved upload."],
        ["app/api/admin/translate.py", "The Translate button (English → Russian + Tajik), used when Claude is the chosen translator."],
        ["app/api/admin/settings.py", "The Settings page: GET / PUT /admin/settings (translator choice) and PUT /admin/settings/password."],
        ["app/api/public/content.py", "Read-only content for the public site (no session needed); paging limit 1–30, default 10."],
        ["app/api/public/contact.py", "The contact form: the only thing the public site sends to the backend."],
      ],
    },
    {
      id: "schemas", title: "Schemas", sub: "Pydantic: what goes in and out", color: "--l-5",
      rule: "Every request body is an InputModel (extra fields forbidden). Shared field types do the heavy lifting: 3-language texts, URLs, months, colors, SVG icons, id lists.",
      files: [
        ["app/schemas/fields.py", "Reusable field types: I18nRequired[200], I18nOptional[1000], rich text (cleaned HTML), person names, HttpUrl, Month, HexColor, IconSvg, UniqueIds."],
        ["app/schemas/common.py", "InputModel / OutputModel base classes."],
        ["app/schemas/sections.py", "Hero, About, Contacts, Other links, Tech stack page and contact-form messages."],
        ["app/schemas/content.py", "Experience, projects, testimonials and certificates (admin requests and responses)."],
        ["app/schemas/selectors.py", "Request and response bodies for each kind of reusable list."],
        ["app/schemas/public.py", "Public responses: one language, camelCase JSON, computed values."],
        ["app/schemas/auth.py", "Login and /me bodies."],
        ["app/schemas/settings.py", "Translator choice and password change bodies."],
        ["app/schemas/media.py", "Uploaded-file responses."],
      ],
    },
    {
      id: "services", title: "Services", sub: "the business rules", color: "--l-6",
      rule: "Decide what is allowed, in what order, and when to commit. Raise AppError subclasses that become clean JSON errors. Know nothing about HTTP.",
      files: [
        ["app/services/auth.py", "One admin user, opaque sessions, CSRF tokens, login throttling (5 per IP + 20 in total per 15 min), password rehash; password change (current one checked and throttled, other browsers signed out)."],
        ["app/services/settings.py", "Settings page rules: the translator choice (manual by default; Claude only once ANTHROPIC_API_KEY is set)."],
        ["app/services/sections.py", "Hero, About, Contacts (at least two channels), Other links, Tech stack page, contact messages (5 per IP + 30 in total per hour, honeypot)."],
        ["app/services/content.py", "Only one current job; private project ⇔ no links and no media; gallery ≤ 10 images + 2 videos; certificates 1–5 images; slugs; files removed from a form are deleted."],
        ["app/services/selectors.py", "Unique names, valid references, logos, ordering, and no deleting what's in use (409 with what uses it). One service for 8 kinds, configured by SPECS."],
        ["app/services/media.py", "Uploads: type from the first bytes, size per purpose, Pillow inspection, metadata stripped, SVG cleaned, the file's own name kept for downloads; cleanup of unused files after 24 h."],
        ["app/services/public.py", "What the public site shows: one language at a time, computed numbers (months of experience with overlaps merged), only published data."],
        ["app/services/translation.py", "Translate button: calls the translator, cleans the answer, 503 when no key is set."],
        ["app/services/seed.py", "Loads seed/content.json into an empty database (refuses otherwise)."],
      ],
    },
    {
      id: "repos", title: "Repositories", sub: "SQL + outside systems", color: "--l-7",
      rule: "Run queries and talk to outside systems (disk/S3, Claude). Never commit: the service does.",
      files: [
        ["app/repositories/base.py", "Base class: holds the session; services decide when to commit."],
        ["app/repositories/auth.py", "Admin users, sessions (incl. signing out the other browsers), login attempts (counts in a time window)."],
        ["app/repositories/settings.py", "The admin panel's settings row."],
        ["app/repositories/sections.py", "Single-row sections, other links, Tech stack page, messages."],
        ["app/repositories/content.py", "Experience, projects, testimonials, certificates (generic, per model)."],
        ["app/repositories/selectors.py", "Generic access for all selector tables, plus usage counts."],
        ["app/repositories/links.py", "replace_links(): many-to-many links are replaced as a set; position keeps the given order."],
        ["app/repositories/media.py", "Uploaded-file records, where each file is used, unused files."],
        ["app/repositories/public.py", "Read queries for the public site: filters and paging run in SQL."],
        ["app/repositories/storage.py", "Storage interface: LocalStorage (disk) and S3Storage (any S3-compatible server; the résumé's download name is stored with the file)."],
        ["app/repositories/translation.py", "ClaudeTranslator: the Claude API call (an outside service, so it lives with the repositories)."],
      ],
    },
    {
      id: "models", title: "Models", sub: "SQLAlchemy tables", color: "--l-8",
      rule: "Describe the tables, keys and CHECK rules. Alembic compares them with the database to write migrations.",
      files: [
        ["app/models/auth.py", "AdminUser, AdminSession, LoginAttempt."],
        ["app/models/settings.py", "AdminSettings (one row: the translator choice)."],
        ["app/models/media.py", "Media (the bytes live in storage; this row describes them)."],
        ["app/models/sections.py", "Hero, About, Contacts (single rows), OtherLink."],
        ["app/models/selectors.py", "DevelopmentField, Instrument, TechStack, Position, Company, Institute, ProductType, LinkPlatform."],
        ["app/models/content.py", "Experience, Project, Testimonial, Certificate, ContactMessage."],
        ["app/models/links.py", "The 12 many-to-many link tables, each with a position."],
        ["app/models/enums.py", "Fixed value lists stored as text: Availability, ClientKind, Traffic, MediaPurpose, Translator."],
        ["app/db/base.py", "Base (naming convention for constraints), UUIDPk (uuid4 in Python), Timestamps (created_at, updated_at)."],
      ],
    },
  ],

  side: [
    {
      title: "core/ — shared helpers", color: "--l-core",
      files: [
        ["app/core/config.py", "Settings from environment variables and backend/.env."],
        ["app/core/errors.py", "AppError and its subclasses → JSON {detail, code, …}."],
        ["app/core/security.py", "Argon2id hashing, random tokens, token hashes."],
        ["app/core/text.py", "Cleaning text, person names, links, rich text (nh3), YYYY-MM months."],
        ["app/core/svg.py", "Allow-list cleaning of SVG icons and logos."],
        ["app/core/files.py", "Which files may be uploaded where (types from the first bytes), and the download header that keeps a file's exact name."],
        ["app/core/net.py", "Real client IP behind the Next.js servers; IP hashing."],
        ["app/core/throttle.py", "\"At most N events in the last T\" limits."],
        ["app/core/places.py", "Countries and time zones for About."],
        ["app/core/contacts.py", "Email, Telegram, WhatsApp, LinkedIn formats and links."],
      ],
    },
    {
      title: "db/ — connection", color: "--l-core",
      files: [
        ["app/db/session.py", "Database: async engine + session factory (one pool per app)."],
        ["app/db/base.py", "Declarative base and shared column mixins."],
      ],
    },
    {
      title: "Outside the request path", color: "--l-core",
      files: [
        ["app/cli.py", "create-admin, delete-admin, seed, cleanup."],
        ["alembic/", "Migrations: env.py reads the URL from the app settings; versions/ holds 2 revisions."],
        ["scripts/", "create_db.ps1 + .sql (one-time setup); export_architecture_db.py (this site's database data)."],
        ["tests/", "unit/ (no database) and integration_api/ (HTTP → real test database)."],
      ],
    },
  ],

  // Feature areas × layers: which file handles each part.
  matrix: {
    columns: ["Route", "Schema", "Service", "Repository", "Tables"],
    rows: [
      { area: "Sign-in", cells: ["api/auth.py · api/auth_deps.py", "schemas/auth.py", "services/auth.py", "repositories/auth.py", "admin_users · admin_sessions · login_attempts"] },
      { area: "Uploads", cells: ["api/admin/media.py · api/media_files.py", "schemas/media.py", "services/media.py", "repositories/media.py · repositories/storage.py", "media"] },
      { area: "Selectors", cells: ["api/admin/selectors.py", "schemas/selectors.py", "services/selectors.py", "repositories/selectors.py", "8 selector tables + 2 links"] },
      { area: "Sections", cells: ["api/admin/sections.py", "schemas/sections.py", "services/sections.py", "repositories/sections.py", "hero · about · contacts · other_links"] },
      { area: "Content", cells: ["api/admin/content.py", "schemas/content.py", "services/content.py", "repositories/content.py · repositories/links.py", "experiences · projects · testimonials · certificates + links"] },
      { area: "Public site", cells: ["api/public/content.py", "schemas/public.py", "services/public.py", "repositories/public.py", "reads almost all"] },
      { area: "Contact form", cells: ["api/public/contact.py", "schemas/sections.py", "services/sections.py", "repositories/sections.py", "contact_messages"] },
      { area: "Translate", cells: ["api/admin/translate.py", "(in the route file)", "services/translation.py", "repositories/translation.py", "— (Claude API)"] },
      { area: "Settings", cells: ["api/admin/settings.py", "schemas/settings.py", "services/settings.py · services/auth.py", "repositories/settings.py · repositories/auth.py", "admin_settings · admin_users · admin_sessions"] },
      { area: "Seed", cells: ["cli.py seed", "seed/content.json", "services/seed.py", "all repositories", "all"] },
    ],
  },

  errors: [
    ["400", "AppError", "Generic bad request"],
    ["401", "Unauthorized", "No or expired session; wrong email or password"],
    ["403", "Forbidden", "Foreign Origin or missing/wrong CSRF token"],
    ["404", "NotFound", "The item doesn't exist"],
    ["409", "Conflict", "Deleting something still in use (the answer lists what uses it)"],
    ["413", "PayloadTooLarge", "File or body over the limit"],
    ["415", "UnsupportedMediaType", "File type not allowed for this purpose"],
    ["422", "FieldErrors / validation", "Field-by-field messages (bad value, name or slug taken, a second current job…); the admin shows them under each input"],
    ["429", "TooManyRequests", "Login or contact-form limit, with Retry-After"],
    ["503", "ServiceUnavailable", "Claude's Translate without a key, or Claude failed"],
  ],
};
