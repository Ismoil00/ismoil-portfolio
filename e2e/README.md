# End-to-end tests

A real browser (the **Microsoft Edge** installed on this computer) uses the public site and the admin
panel the way a visitor and you would, against the real backend and a real PostgreSQL database.

| Kind of test | Where | What it covers |
|---|---|---|
| Unit | `backend/tests/unit` | Pure logic (validation, security, files), no database |
| Integration (API) | `backend/tests/integration_api` | HTTP → routes → services → real test database, no browser |
| **End-to-end** | **`e2e/` (here)** | Browser → both Next.js apps → backend → database |

## Run

```bash
cd e2e
npm install --cache ../.npm-cache   # once
npm test                            # all tests, headless
npm run test:headed                 # watch the browser
npm run test:ui                     # Playwright's UI: pick tests, time-travel through steps
npm run report                      # open the last HTML report
```

Run a single file or test: `npm test -- tests/contact.spec.ts`, `npm test -- -g "Show more"`.

## What a run does

1. **Backend** on port **8100** (`scripts/backend.py`): its own database `portfolio_e2e` (created on
   the first run), wiped, migrated and seeded from `backend/seed/content.json`; its own media folder
   (`backend/.tmp/e2e-storage`); a new admin `e2e-admin@example.com` with a random password
   (`e2e/.tmp/admin.json`, git-ignored). The Translate key is switched off, so no paid API calls.
2. **Public site** on **3100** and **admin panel** on **3101**: production builds (`next build` +
   `next start`) pointed at that backend — what real visitors get.
3. **Tests**, one at a time (they share one database and clean up what they add).

Your development servers (3000 / 3001 / 8000) and your development database are not touched, so
they can keep running. Note: the run's production build replaces each app's `.next` build output
(not `.next/dev`), so rebuild before a manual `npm start`.

Playwright writes only inside `e2e/`: browser profiles and temp files in `.tmp/`, failure traces
and screenshots in `test-results/`, the report in `playwright-report/` (all git-ignored).

## Specs

| File | Checks |
|---|---|
| `auth.setup.ts` | Signs in once through the login page; other tests reuse the session |
| `admin-auth.spec.ts` | Redirect to login when signed out, wrong password, sign in → requested page, reload, sign out |
| `content-to-site.spec.ts` | About title and Hero status edited in the admin show on the site (right language only); Translate without a key; "Missing …" badges |
| `contact.spec.ts` | Form validation, sending, the message in the admin table, deleting it |
| `listings.spec.ts` | Filters (kept in the URL), "Show more" |
| `languages-themes.spec.ts` | Every page in EN/RU/TG without errors, language switcher, light/dark on both apps |
| `empty-sections.spec.ts` | Testimonials hidden while there are none (section, menu, page 404, sitemap), no traffic row, NDA note |
| `mobile.spec.ts` | Phone screen: no sideways scrolling, menu navigation |
