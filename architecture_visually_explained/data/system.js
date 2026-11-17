// The whole system: who talks to whom. Coordinates are in a 1200 x 720 canvas.
window.ARCH = window.ARCH || {};

window.ARCH.system = {
  nodes: [
    {
      id: "visitor", x: 30, y: 110, w: 190, h: 76, kind: "client",
      title: "Visitor's browser", sub: "anyone on the internet",
      what: "Opens the public site. Gets ready-made HTML and never sees the backend's API address.",
      does: [
        "Loads pages from the public site (Next.js).",
        "Loads images, videos and the résumé from the file address the backend hands out.",
        "Sends the contact form through a Server Action (not straight to the backend).",
      ],
    },
    {
      id: "adminBrowser", x: 30, y: 420, w: 190, h: 76, kind: "client",
      title: "Admin's browser", sub: "you, signed in",
      what: "Uses the admin panel. Every call goes to the panel's own address, so the session cookie stays first-party.",
      does: [
        "Holds two cookies after sign-in: session (HttpOnly) and csrf (readable, echoed in a header).",
        "Calls /api/v1/* and /media/* on the panel's address; the panel forwards them to the backend.",
        "Uploads files first, then saves forms that point at them.",
      ],
    },
    {
      id: "public", x: 320, y: 90, w: 220, h: 116, kind: "next",
      title: "Public site", sub: "Next.js 16 · port 3000", folder: "frontends/public",
      what: "Renders every page on the server per request in English, Russian or Tajik, from data it reads from the backend.",
      does: [
        "proxy.ts keeps the language in the URL (/ → /en or the browser's language).",
        "Server components call the backend through src/api/*.api.ts (API_URL is server-only).",
        "\"Show more\" and the contact form run as Server Actions on this server.",
        "Hides anything optional that is missing (traffic row, testimonials section).",
      ],
      readme: "frontends/public/README.md",
    },
    {
      id: "admin", x: 320, y: 400, w: 220, h: 116, kind: "next",
      title: "Admin panel", sub: "Next.js 16 · port 3001", folder: "frontends/cms-admin",
      what: "Forms for every part of the site. Stores nothing itself: every change is sent to the backend.",
      does: [
        "proxy.ts: no session cookie → /login (the backend still decides if a session is valid).",
        "next.config.ts rewrites forward /api/* and /media/* to the backend.",
        "Server components read with the visitor's cookie; forms write with axios + X-CSRF-Token.",
        "Never indexed by search engines; can't be framed.",
      ],
      readme: "frontends/cms-admin/README.md",
    },
    {
      id: "backend", x: 640, y: 150, w: 240, h: 330, kind: "backend",
      title: "Backend API", sub: "FastAPI · port 8000", folder: "backend",
      inner: ["/api/v1/public · open", "/api/v1/auth · sign in", "/api/v1/admin · signed in", "/media · local files", "/docs · dev only"],
      what: "The only part that owns data. Checks every input, applies the business rules, and talks to the database, file storage and Claude.",
      does: [
        "Layers: routes → services (rules) → repositories (SQL, storage, Claude) → models (tables).",
        "Separate read endpoints for the public site (one language, only what is shown) and the admin (all languages).",
        "Security: Argon2id passwords, opaque sessions, CSRF + Origin checks, login and contact limits, strict headers.",
      ],
      readme: "backend/README.md",
    },
    {
      id: "db", x: 975, y: 90, w: 200, h: 96, kind: "db",
      title: "PostgreSQL 18", sub: "portfolio · schema work",
      what: "35 tables: 34 from the models + Alembic's version table. No functions, triggers or views: the rules live in the backend, the database guards them with keys and CHECKs.",
      does: [
        "Foreign keys: owner deleted → its links go (CASCADE); a used item can't be deleted (RESTRICT).",
        "15 CHECK rules (e.g. a private project has no links) and 12 unique rules.",
        "Texts in 3 languages are JSONB {\"en\",\"ru\",\"tg\"}.",
      ],
      jump: "database",
    },
    {
      id: "storage", x: 975, y: 300, w: 200, h: 96, kind: "storage",
      title: "File storage", sub: "backend/storage · or S3",
      what: "The bytes of uploaded files. The media table describes them; storage keeps them under <purpose>/<random name>.",
      does: [
        "Development: files on disk in backend/storage (git-ignored), served by the backend at /media/{key}.",
        "Production: any S3-compatible server (MinIO, RustFS, R2, AWS S3…), which serves the files itself; the résumé's download name is stored with it.",
      ],
    },
    {
      id: "claude", x: 975, y: 510, w: 200, h: 86, kind: "external",
      title: "Claude API", sub: "Translate button only",
      what: "Used by one button: Translate fills Russian and Tajik from English for you to review. Optional and paid: it can only be chosen in Settings once ANTHROPIC_API_KEY is set. The free alternatives (Google Translate's website in a new tab, or typing by hand) never reach the backend.",
      does: [
        "Model claude-opus-5-5, low effort, JSON output.",
        "The answer is cleaned like anything typed into the panel, and nothing is saved until you press Save.",
      ],
    },
    {
      id: "cli", x: 640, y: 580, w: 240, h: 86, kind: "tool",
      title: "Command line", sub: "python -m app.cli · alembic",
      what: "Tasks run by hand (or on a schedule) from backend/.",
      does: [
        "alembic upgrade head: creates or changes the tables (migrations in backend/alembic/versions).",
        "create-admin / delete-admin: the one admin user.",
        "seed: loads seed/content.json into an empty database and uploads the résumé.",
        "import-selectors: adds the seed's new development fields and technologies to a filled database (by name; nothing changed or deleted).",
        "cleanup: deletes uploads nothing uses after 24 h, old login attempts and expired sessions.",
      ],
    },
    {
      id: "e2e", x: 320, y: 600, w: 220, h: 76, kind: "tool",
      title: "E2E tests", sub: "Playwright · Edge · e2e/",
      what: "Starts its own backend (8100, fresh seeded portfolio_e2e database) and production builds of both apps (3100, 3101), then drives a real browser through them.",
      does: ["37 tests: sign-in, edits reaching the site, filters, languages, themes, phone width…"],
      readme: "e2e/README.md",
    },
  ],

  // a / b: [node id, side (l r t b), position along that side 0..1]
  edges: [
    {
      id: "visitor-public", a: ["visitor", "r", 0.5], b: ["public", "l", 0.4], label: "pages · Server Actions",
      protocol: "HTTPS", carries: "HTML pages rendered on the server; Server Action calls (Show more, contact form).",
      auth: "None.",
    },
    {
      id: "public-backend", a: ["public", "r", 0.35], b: ["backend", "l", 0.12], label: "GET /api/v1/public/*",
      protocol: "HTTP, server to server", carries: "JSON in one language (camelCase), computed values, only published data. Plus POST /public/contact with the visitor's IP in X-Forwarded-For.",
      auth: "None. The backend's address (API_URL) is known only to the Next.js server.",
    },
    {
      id: "visitor-media", a: ["visitor", "t", 0.7], b: ["backend", "t", 0.5], label: "images · videos · résumé", dashed: true,
      protocol: "HTTPS", carries: "Files at the URLs the backend puts in its JSON (MEDIA_BASE_URL/…). Locally the backend serves /media/{key}; with S3 the storage server does.",
      auth: "None (public files). Served with nosniff, a strict CSP and the right Content-Type.",
    },
    {
      id: "adminBrowser-admin", a: ["adminBrowser", "r", 0.5], b: ["admin", "l", 0.4], label: "pages · /api · /media",
      protocol: "HTTPS, one origin", carries: "Pages, plus API calls and files on the panel's own address.",
      auth: "Session cookie (HttpOnly, SameSite=Strict) + X-CSRF-Token header on every write.",
    },
    {
      id: "admin-backend", a: ["admin", "r", 0.4], b: ["backend", "l", 0.7], label: "/api/v1/admin · /auth",
      protocol: "HTTP (rewrites + server calls)", carries: "Browser calls forwarded by next.config.ts rewrites; server components call the backend directly and pass the cookies along.",
      auth: "The backend checks the session on every admin route, and Origin + CSRF token on every write.",
    },
    {
      id: "backend-db", a: ["backend", "r", 0.12], b: ["db", "l", 0.5], label: "SQL (asyncpg)",
      protocol: "PostgreSQL wire protocol", carries: "SQLAlchemy 2.0 async queries; every connection sets search_path=work. One session per request; services decide when to commit.",
      auth: "DB_USER / DB_PASSWORD from backend/.env.",
    },
    {
      id: "backend-storage", a: ["backend", "r", 0.5], b: ["storage", "l", 0.5], label: "file bytes",
      protocol: "Local disk or the S3 API", carries: "Save, read and delete uploads under random keys (<purpose>/<hex>.<ext>).",
      auth: "S3 keys from backend/.env in production.",
    },
    {
      id: "backend-claude", a: ["backend", "r", 0.88], b: ["claude", "l", 0.5], label: "Translate",
      protocol: "HTTPS (Anthropic SDK)", carries: "One English text in, Russian + Tajik out (JSON).",
      auth: "ANTHROPIC_API_KEY (optional). Without it the button explains how to enable it (503).",
    },
    {
      id: "cli-backend", a: ["cli", "t", 0.5], b: ["backend", "b", 0.5], label: "same code, no HTTP", dashed: true,
      protocol: "Python imports (no HTTP, no running server needed)",
      carries: "The command line is the backend's own code run from a terminal: Alembic migrations, create-admin, delete-admin, seed (also uploads the résumé to file storage), cleanup (also deletes uploaded files nothing uses). It reaches PostgreSQL and storage through the same services and repositories (arrows 6 and 7).",
      auth: "Same backend/.env as the backend: database login and storage settings.",
    },
    {
      id: "e2e-apps", a: ["e2e", "t", 0.5], b: ["admin", "b", 0.5], label: "tests both apps", dashed: true,
      protocol: "Playwright (Edge)", carries: "Drives the production builds of both apps with a real browser.",
      auth: "Signs in as its own E2E admin.",
    },
  ],

  traces: [
    { id: "page", label: "Visitor opens a page", steps: ["visitor-public", "public-backend", "backend-db", "-backend-db", "-public-backend", "-visitor-public", "visitor-media"] },
    { id: "save", label: "Admin saves with a file", steps: ["adminBrowser-admin", "admin-backend", "backend-storage", "backend-db", "-admin-backend", "-adminBrowser-admin"] },
    { id: "translate", label: "Translate button", steps: ["adminBrowser-admin", "admin-backend", "backend-claude", "-backend-claude", "-admin-backend", "-adminBrowser-admin"] },
    { id: "contact", label: "Contact form", steps: ["visitor-public", "public-backend", "backend-db", "-public-backend", "-visitor-public"] },
    { id: "setup", label: "Setup: migrate + seed", steps: ["cli-backend", "backend-db", "backend-storage"] },
  ],

  kinds: {
    client: { label: "Browser", color: "--k-client" },
    next: { label: "Next.js app", color: "--k-next" },
    backend: { label: "Backend", color: "--k-backend" },
    db: { label: "Database", color: "--k-db" },
    storage: { label: "Files", color: "--k-storage" },
    external: { label: "Outside service", color: "--k-external" },
    tool: { label: "Tooling", color: "--k-tool" },
  },

  facts: [
    ["Languages", "Python 3.13 · TypeScript 5"],
    ["Backend", "FastAPI · SQLAlchemy 2.0 async · Pydantic 2 · Alembic"],
    ["Frontends", "Next.js 16 · React 19 · Tailwind 4 · axios"],
    ["Database", "PostgreSQL 18, schema work"],
    ["Site languages", "English · Russian · Tajik"],
    ["Tests", "pytest (unit + API) · Playwright E2E"],
  ],
};
