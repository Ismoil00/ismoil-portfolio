# Architecture, visually explained

An interactive map of the whole project: the system, the backend's layers, both frontends, the database and
step-by-step journeys. Plain HTML, CSS and JavaScript: no build step, no libraries, nothing to install.

## Open it

- Double-click `index.html` (it works straight from the disk), or
- serve the folder: `backend/.venv/Scripts/python -m http.server 3005 --directory architecture_visually_explained`
  from the repo root, then open <http://localhost:3005> (`.claude/launch.json` has this as `architecture`).

Keys: `/` jumps to search, `Esc` closes the details panel, `←` `→` step through a journey.

## The five views

| View | Shows |
| --- | --- |
| 1 · System | Browsers, the two Next.js apps, the backend, PostgreSQL, storage, Claude, CLI, E2E: every box and arrow is clickable; "Play a journey" animates a request |
| 2 · Backend | The layers one request passes (middleware → routers → dependencies → handlers → schemas → services → repositories → models), every file, who handles each feature, the error codes |
| 3 · Frontends | How a request flows through each app, every page and the backend routes it calls |
| 4 · Database | All 33 tables grouped by meaning, entity view (link tables folded into many-to-many lines) or every table, a focus view per table with its columns and neighbours, delete behaviour, CHECK rules, other objects, conventions |
| 5 · Flows | Sequence diagrams: a page visit, signing in, saving with an upload, Translate, the contact form, a blocked delete |

## Keep it current

The site must match the code. When something in the project changes, update it in the same piece of work:

| What changed | Update |
| --- | --- |
| A model (table, column, key, rule, index) | Run `.venv/Scripts/python scripts/export_architecture_db.py` from `backend/` (writes `data/db-schema.generated.js`); `tests/unit/test_architecture_db.py` fails until you do. A new table also needs a position and a description in `data/database.js`. |
| A backend file or layer | `data/backend.js` |
| A page, an endpoint call, a frontend folder | `data/frontends.js` |
| How the parts connect (ports, services, storage) | `data/system.js` |
| A journey's steps | `data/flows.js` |

Then set `CHECKED_ON` at the top of `app.js` to the date you checked.

## Files

| File | Holds |
| --- | --- |
| `index.html` | The page shell, header icons (one per view) and the script order |
| `favicon.svg` | The tab icon, also the logo in the header: two apps wired to the backend |
| `styles.css` | Colors (light and dark), layout, diagram styles |
| `app.js` | Draws every view from the data; no facts in here |
| `data/*.js` | The facts. `db-schema.generated.js` is generated; the rest are written by hand |
