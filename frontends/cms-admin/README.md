# Admin panel

Next.js 16 app for editing the portfolio: Hero, About, Contacts (with Other links and messages), Tech stack,
Experience, Projects, Testimonials, Certificates, the Selectors lists, and its own Settings. It stores nothing itself: every change goes
to the backend. Plan and decisions: [`docs/PLAN.md`](../../docs/PLAN.md).

Commands below run in PowerShell from the `frontends/cms-admin/` folder.

## First-time setup

1. The backend is set up, running and has an admin user ([`backend/README.md`](../../backend/README.md), steps 1–8).
2. Packages: `npm install`
3. Settings: `Copy-Item .env.example .env.local` (the defaults fit local development).

## Settings (`.env.local`)

| Variable | What | Default |
| --- | --- | --- |
| `API_URL` | Backend address, without `/api/v1` | `http://localhost:8000` |
| `NEXT_PUBLIC_SITE_URL` | The public site, for the "View site" link | `http://localhost:3000` |

## Run

- Development: `npm run dev` → <http://localhost:3001> (opens the login page)
- Production: `npm run build`, then `npm start` (port 3001)

## Checks

- Types: `npx tsc --noEmit`
- Lint: `npx eslint src`
- End-to-end (browser): see [`e2e/README.md`](../../e2e/README.md).

## How it talks to the backend

- **Browser → backend:** `/api/*` and `/media/*` are forwarded from this app's own address (`next.config.ts`
  rewrites), so the session cookie stays first-party and no CORS is needed.
- **Forms:** `src/api/client.ts` (axios) adds the `X-CSRF-Token` header to every write; a 401 opens the login page.
- **Server components:** `src/api/server.ts` calls the backend directly and passes the visitor's cookies along.
- **Without a session cookie** `src/proxy.ts` sends every page to `/login`; whether a session is still valid is
  decided by the backend.
- Responses forbid framing and tell search engines not to index the panel.

## Pages

| Path | Edits |
| --- | --- |
| `/login` | Sign in (the account is created with `python -m app.cli create-admin`) |
| `/hero`, `/about`, `/contacts`, `/tech-stack` | One section each (`/` opens `/hero`) |
| `/experience`, `/projects`, `/testimonials`, `/certificates` | A list, plus `/new` and `/[id]` editors |
| `/selectors` | The reusable lists: development fields, instruments, technologies, positions, companies, institutes, product types, link platforms |
| `/settings` | The panel itself (bottom of the sidebar): the translator next to every EN / RU / TG field (Google Translate · Manual · Claude once its key is set) and changing the password |

## Folders

| Folder | Holds |
| --- | --- |
| `src/app/(panel)/` | Pages behind the login, with the sidebar layout |
| `src/app/login/` | The login page |
| `src/api/` | Backend calls: browser client, server client, error handling |
| `src/components/form/` | Form kit: EN/RU/TG fields with Translate, rich text, pickers, uploads, sortable lists |
| `src/components/layout/` | Sidebar (a drawer on phones), page headers, list and editor frames, theme toggle |
| `src/components/ui/` | Buttons, cards, dialogs, toasts, tooltips, sortable lists |
| `src/lib/` | Dates, countries and time zones, validation, theme |
| `src/types/` | The API's request and response shapes |
