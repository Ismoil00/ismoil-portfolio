# Public site

The portfolio and CV site in English, Russian and Tajik (Next.js 16, next-intl). All content comes from the backend
and every page is rendered on the server per request, so admin edits show up on the next page load.
Plan and decisions: [`docs/PLAN.md`](../../docs/PLAN.md).

Commands below run in PowerShell from the `frontends/public/` folder.

## First-time setup

1. The backend is set up, seeded and running ([`backend/README.md`](../../backend/README.md), steps 1–8).
2. Packages: `npm install`
3. Settings: `Copy-Item .env.example .env.local` (the defaults fit local development).

## Settings (`.env.local`)

| Variable | What | Default |
| --- | --- | --- |
| `API_URL` | Backend API, including `/api/v1`; used on the server only, never sent to the browser | `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | The site's public address: canonical links, sitemap, Open Graph | `http://localhost:3000` |

## Run

- Development: `npm run dev` → <http://localhost:3000> (redirects to `/en`, or to the browser's language)
- Production: `npm run build`, then `npm start`. The build doesn't need the backend; serving pages does.

## Checks

- Types: `npx tsc --noEmit`
- Lint: `npx eslint src`
- End-to-end (browser): see [`e2e/README.md`](../../e2e/README.md).

## How it talks to the backend

- **Pages** read through `src/api/*.api.ts` on the server (`API_URL`).
- **"Show more"** loads the next items through Server Actions (`src/api/*.actions.ts`); filters are kept in the URL.
- **The contact form** is a Server Action that posts to `POST /public/contact` (hidden honeypot field; the backend
  limits messages per visitor).
- **Images, videos and the résumé** load from the backend's file address (`MEDIA_BASE_URL` in `backend/.env`).
- Anything optional that is missing is hidden: no traffic row, no testimonials section while there are none
  (`/testimonials` is then a 404 and left out of the sitemap).

## Pages

`/[locale]` with locale `en`, `ru` or `tg`: home, `/experience`, `/projects`, `/projects/[slug]`, `/certificates`,
`/testimonials`. Plus `/sitemap.xml` and `/robots.txt`.

## Folders

| Folder | Holds |
| --- | --- |
| `src/app/[locale]/` | The pages; `(home)` is the home page and its sections |
| `src/api/` | Backend calls and Server Actions |
| `src/components/` | Sections and cards per page, layout, shared UI |
| `src/i18n/`, `src/messages/` | Language routing; UI labels in `en.json`, `ru.json`, `tg.json` (content languages come from the backend) |
| `src/lib/` | Dates, URLs, theme, brand icons and colors |
| `src/types/` | The API's response shapes |
| `public/` | Cursors and `cv/Sharifov-Ismoil-CV-EN.pdf`, which the backend's seed uploads as the résumé |

`AGENTS.md` is written by `next dev` for AI coding tools.
