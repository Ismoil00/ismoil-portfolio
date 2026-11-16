// Hand-written meaning of the database. The facts (columns, keys, rules, indexes) come from
// db-schema.generated.js, which backend/scripts/export_architecture_db.py writes from the models.
window.ARCH = window.ARCH || {};

window.ARCH.database = {
  groups: {
    auth: { label: "Admin panel", color: "--g-auth" },
    sections: { label: "Sections", color: "--g-sections" },
    content: { label: "Content", color: "--g-content" },
    links: { label: "Link tables", color: "--g-links" },
    selectors: { label: "Selectors", color: "--g-selectors" },
    files: { label: "Files", color: "--g-files" },
    system: { label: "Migrations", color: "--g-system" },
  },

  // Zones drawn behind the map (their size comes from the tables in them).
  zones: [
    { label: "Admin panel (sign-in, settings)", group: "auth", tables: ["admin_users", "admin_sessions", "login_attempts", "admin_settings"] },
    { label: "Migrations", group: "system", tables: ["alembic_version"] },
    { label: "Sections (single rows)", group: "sections", tables: ["hero", "about", "contacts", "other_links"] },
    { label: "Content", group: "content", tables: ["experiences", "projects", "testimonials", "certificates", "contact_messages"] },
    { label: "Link tables (many-to-many)", group: "links", tables: ["experience_techs", "experience_fields", "experience_projects", "experience_testimonials", "project_types", "project_techs", "project_media", "testimonial_projects", "certificate_fields", "certificate_media"] },
    { label: "Selectors (reusable lists)", group: "selectors", tables: ["companies", "tech_stacks", "product_types", "positions", "institutes", "link_platforms", "tech_stack_fields", "tech_stack_instruments", "development_fields", "instruments"] },
    { label: "Files", group: "files", tables: ["media"] },
  ],

  // Map positions (top-left of each 200 × 48 card) in a 1800 × 1110 canvas.
  layout: {
    admin_users: [50, 90], admin_sessions: [50, 170], login_attempts: [50, 250], admin_settings: [50, 330],
    alembic_version: [50, 470],
    hero: [50, 610], about: [50, 690], contacts: [50, 770], other_links: [50, 850],
    experiences: [340, 140], projects: [340, 420], testimonials: [340, 660], certificates: [340, 880], contact_messages: [340, 1010],
    experience_techs: [640, 40], experience_fields: [640, 110], experience_projects: [640, 180], experience_testimonials: [640, 250],
    project_types: [640, 370], project_techs: [640, 440], project_media: [640, 510], testimonial_projects: [640, 640],
    certificate_fields: [640, 820], certificate_media: [640, 890],
    media: [640, 1010],
    companies: [960, 60], tech_stacks: [960, 300], product_types: [960, 440], positions: [960, 620], institutes: [960, 880], link_platforms: [960, 1010],
    tech_stack_fields: [1260, 240], tech_stack_instruments: [1260, 360],
    development_fields: [1560, 180], instruments: [1560, 400],
  },

  tables: {
    admin_users: {
      group: "auth",
      what: "The one admin account. The email is unique; the password is stored only as an Argon2id hash (rehashed on sign-in when the settings change). The password can be changed on /settings or reset from the command line.",
      managedBy: ["services/auth.py · AuthService", "repositories/auth.py", "cli.py create-admin / delete-admin"],
      shownIn: ["Admin: /login, /settings → Change password"],
    },
    admin_sessions: {
      group: "auth",
      what: "One row per signed-in browser. Only hashes of the session and CSRF tokens are stored, so a copy of the database can't be used to sign in. Ends after 12 h without use or 7 days in total; signing out deletes it, and a password change deletes every other browser's row.",
      managedBy: ["services/auth.py · AuthService", "repositories/auth.py", "cli.py cleanup (expired rows)"],
      shownIn: ["Every admin request (cookie → this row)"],
    },
    login_attempts: {
      group: "auth",
      what: "Every sign-in attempt, with a salted hash of the visitor's IP. Counting failures in the last 15 minutes gives the limits: 5 per IP and 20 in total.",
      managedBy: ["services/auth.py · AuthService", "repositories/auth.py", "cli.py cleanup (rows older than 30 days)"],
      shownIn: ["Admin: /login and the password change on /settings (429 when over the limit)"],
    },
    admin_settings: {
      group: "auth",
      what: "A single row (id = 1) with the admin panel's own settings. translator decides what helps fill Russian and Tajik from English: claude (the Translate button; only once ANTHROPIC_API_KEY is set), google_web (buttons open Google Translate with the English text) or manual. Until the row exists, manual applies.",
      managedBy: ["services/settings.py · PanelSettingsService", "repositories/settings.py"],
      shownIn: ["Admin: /settings", "Every EN / RU / TG field's helper button"],
    },
    alembic_version: {
      group: "system",
      what: "Alembic's bookmark: the id of the last migration applied to this database (ba844e7ce9b0). Not a model; only `alembic upgrade` writes it.",
      managedBy: ["alembic/ (env.py, versions/)"],
      shownIn: ["—"],
    },
    hero: {
      group: "sections",
      what: "A single row (id = 1): first and last name, role and an optional description in 3 languages, the résumé PDF, and the job-search status (seeking / open / unavailable).",
      managedBy: ["services/sections.py · SectionsService", "repositories/sections.py"],
      shownIn: ["Admin: /hero", "Site: home Hero, header, hero stats"],
    },
    about: {
      group: "sections",
      what: "A single row: title, one or two paragraphs and city in 3 languages, country code, time zone, open to remote / relocation.",
      managedBy: ["services/sections.py · SectionsService", "repositories/sections.py"],
      shownIn: ["Admin: /about", "Site: home About"],
    },
    contacts: {
      group: "sections",
      what: "A single row: email, Telegram, WhatsApp, LinkedIn. At least two must be set (checked by the service).",
      managedBy: ["services/sections.py · SectionsService", "core/contacts.py (formats)"],
      shownIn: ["Admin: /contacts", "Site: Contact section, social rail, footer"],
    },
    other_links: {
      group: "sections",
      what: "Extra profile links (GitHub, LeetCode…): a platform from link_platforms plus a URL, in the order you drag them to.",
      managedBy: ["services/sections.py · OtherLinksService", "repositories/sections.py"],
      shownIn: ["Admin: /contacts → Other links", "Site: the Other links layer"],
    },
    experiences: {
      group: "content",
      what: "A job: title and rich-text description in 3 languages, company, start month, end month or \"current\". Only one job can be current: a unique index that covers only rows WHERE is_current.",
      managedBy: ["services/content.py · ExperienceService", "repositories/content.py · links.py", "services/public.py (site reads)"],
      shownIn: ["Admin: /experience", "Site: home Experience, /experience, hero stats (months, roles)"],
    },
    projects: {
      group: "content",
      what: "A project: slug (its URL), title and description in 3 languages, months, who it was for (self / private / a company), monthly traffic range, live and source links, private (NDA) flag, cover image.",
      managedBy: ["services/content.py · ProjectService", "repositories/content.py · links.py", "services/public.py (site reads)"],
      shownIn: ["Admin: /projects", "Site: home Projects, /projects, /projects/[slug], sitemap"],
    },
    testimonials: {
      group: "content",
      what: "A recommendation: author name and role in 3 languages, company, my position then, date, optional quote, optional image or video, verify link; can mention several projects.",
      managedBy: ["services/content.py · TestimonialService", "repositories/content.py · links.py", "services/public.py (site reads)"],
      shownIn: ["Admin: /testimonials", "Site: home Testimonials, /testimonials (hidden while none)"],
    },
    certificates: {
      group: "content",
      what: "A certificate or degree: title in 3 languages, institute, months, verify link, fields of study, 1–5 images.",
      managedBy: ["services/content.py · CertificateService", "repositories/content.py · links.py", "services/public.py (site reads)"],
      shownIn: ["Admin: /certificates", "Site: home Certificates, /certificates"],
    },
    contact_messages: {
      group: "content",
      what: "Messages from the public contact form: name, how to reply, the message, and a salted IP hash for the limit (5 per IP and 30 in total per hour).",
      managedBy: ["services/sections.py · MessagesService", "repositories/sections.py"],
      shownIn: ["Site: Contact form (writes)", "Admin: /contacts → Messages (reads, deletes)"],
    },
    media: {
      group: "files",
      what: "Describes one uploaded file; the bytes live in storage under storage_key. purpose decides the allowed types and size (résumé PDF ≤ 10 MB, project image ≤ 10 MB, video ≤ 100 MB, certificate image ≤ 2 MB, logo ≤ 1 MB, poster ≤ 2 MB). A video points to its poster image. original_name keeps the name the file had on your computer (spaces, Cyrillic and all); the résumé downloads under it. There is no \"linked\" flag: a file is in use while some row points to it.",
      managedBy: ["services/media.py · MediaService", "repositories/media.py · storage.py", "cli.py cleanup (unused after 24 h)"],
      shownIn: ["Every upload field in the admin", "Site: images, videos, the résumé download"],
    },
    companies: {
      group: "selectors",
      what: "Employers and clients: name (unique), website, logo. Used by experiences, projects and testimonials, so it can't be deleted while used.",
      managedBy: ["services/selectors.py · SelectorService (SPECS[\"companies\"])", "repositories/selectors.py"],
      shownIn: ["Admin: /selectors, pickers in Experience / Projects / Testimonials", "Site: logos, filters"],
    },
    institutes: {
      group: "selectors",
      what: "Universities, schools, course platforms: name in 3 languages, website, logo. Used by certificates.",
      managedBy: ["services/selectors.py · SelectorService", "repositories/selectors.py"],
      shownIn: ["Admin: /selectors, Certificates picker", "Site: certificate cards"],
    },
    positions: {
      group: "selectors",
      what: "Positions I held, in 3 languages: \"My position\" on testimonials.",
      managedBy: ["services/selectors.py · SelectorService", "repositories/selectors.py"],
      shownIn: ["Admin: /selectors, Testimonials picker", "Site: testimonial cards"],
    },
    product_types: {
      group: "selectors",
      what: "What a project is (Web, Mobile, Game…), with an icon. Every project needs at least one.",
      managedBy: ["services/selectors.py · SelectorService", "repositories/selectors.py"],
      shownIn: ["Admin: /selectors, Projects picker", "Site: project cards, project filter"],
    },
    tech_stacks: {
      group: "selectors",
      what: "Technologies: name (unique), icon, brand color, docs link. showcase_active / showcase_position decide what the site's Tech stack section shows; development fields and instruments are its filters.",
      managedBy: ["services/selectors.py · SelectorService", "services/sections.py · TechShowcaseService", "repositories/selectors.py"],
      shownIn: ["Admin: /selectors, /tech-stack, pickers", "Site: Skills section, chips on every card, filters"],
    },
    development_fields: {
      group: "selectors",
      what: "Directions of IT (Backend, AI & LLM…) in 3 languages: filters on /experience and /certificates (\"field of study\") and on the Tech stack section. filter_active / filter_position control the filter.",
      managedBy: ["services/selectors.py · SelectorService", "repositories/selectors.py"],
      shownIn: ["Admin: /selectors, /tech-stack, pickers", "Site: filters"],
    },
    instruments: {
      group: "selectors",
      what: "Kinds of tools (Languages & frameworks, APIs & protocols, Tools) in 3 languages: the second filter of the Tech stack section.",
      managedBy: ["services/selectors.py · SelectorService", "repositories/selectors.py"],
      shownIn: ["Admin: /selectors, /tech-stack", "Site: Skills filter"],
    },
    link_platforms: {
      group: "selectors",
      what: "Platforms for Other links (GitHub, LeetCode…): name (unique), icon, color.",
      managedBy: ["services/selectors.py · SelectorService", "repositories/selectors.py"],
      shownIn: ["Admin: /selectors, /contacts → Other links", "Site: Other links layer"],
    },
  },

  // Alembic's own table (not a model, so the exporter doesn't see it).
  extraTables: [
    {
      name: "alembic_version", model: null, module: "alembic/", doc: "",
      columns: [{ name: "version_num", type: "VARCHAR(32)", nullable: false, pk: true, unique: false, default: null, onUpdate: null, fk: null }],
      foreignKeys: [], checks: [], uniques: [], indexes: [],
    },
  ],

  checks: {
    ck_admin_settings_single_row: "Only one row can exist (id is always 1).",
    ck_admin_settings_translator: "The translator is claude, google_web or manual.",
    ck_about_single_row: "Only one row can exist (id is always 1).",
    ck_contacts_single_row: "Only one row can exist (id is always 1).",
    ck_hero_single_row: "Only one row can exist (id is always 1).",
    ck_hero_availability: "The status is seeking, open or unavailable.",
    ck_media_purpose: "purpose is one of the 8 known kinds (résumé, project image/video, testimonial image/video, certificate image, logo, poster).",
    ck_projects_client_kind: "Who it was for: self, private or company.",
    ck_projects_company_matches_kind: "A company is set exactly when the client is a company.",
    ck_projects_end_after_start: "The end month can't be before the start month.",
    ck_projects_private_has_no_links: "Private (NDA) ⇔ no live link and no source link.",
    ck_projects_traffic: "One of the 6 monthly-traffic ranges (empty allowed only because seeded projects lack it; the API requires it on save).",
    ck_experiences_current_has_no_end: "A current job has no end month; a past job must have one.",
    ck_experiences_end_after_start: "The end month, when set, can't be before the start month.",
    ck_certificates_end_after_start: "The end month can't be before the start month.",
  },

  onDelete: {
    CASCADE: "Deleting the owner deletes these rows too (an experience's links go with it).",
    RESTRICT: "The referenced row can't be deleted while this row points at it. The backend checks first and answers 409 with what uses it.",
    "SET NULL": "The pointer is cleared (a project loses its cover image, a video loses its poster).",
  },

  objects: [
    { name: "Tables", count: 35, text: "34 from the models + alembic_version." },
    { name: "Functions", count: 0, text: "Business rules live in the backend's services: one place, tested in Python." },
    { name: "Triggers", count: 0, text: "updated_at is set by SQLAlchemy on every update (onupdate=now()); the database does nothing behind the code's back." },
    { name: "Views", count: 0, text: "The public site's read queries are built in repositories/public.py." },
    { name: "Custom types / enums", count: 0, text: "Fixed lists are VARCHAR + a CHECK rule (values in app/models/enums.py), so adding a value is a small migration." },
    { name: "Sequences", count: 4, text: "hero_id_seq, about_id_seq, contacts_id_seq, admin_settings_id_seq for the four single-row tables. Every other table uses a UUID made in Python (uuid4)." },
    { name: "Indexes", count: 70, text: "35 primary keys, 13 unique (12 constraints + the one-current-job rule), 19 on foreign keys, 3 for time windows: login_attempts (ip_hash, created_at), contact_messages (ip_hash, created_at) and (created_at)." },
    { name: "Extensions", count: 1, text: "plpgsql only (built into PostgreSQL)." },
  ],

  conventions: [
    ["Schema", "Every table lives in schema work; each connection sets search_path=work."],
    ["Ids", "UUID v4 made in Python (unguessable). The single-row tables (hero, about, contacts, admin_settings) use id = 1."],
    ["3-language texts", "JSONB {\"en\", \"ru\", \"tg\"}: required fields need all three, optional ones all three or none."],
    ["Months", "Stored as a DATE on the 1st (2024-03-01), exchanged as \"YYYY-MM\"."],
    ["Timestamps", "created_at and updated_at default to now(); updated_at is refreshed by SQLAlchemy."],
    ["Ordered lists", "Every link table has a position, so picked lists keep their order."],
    ["Constraint names", "pk_<table>, fk_<table>_<column>_<target>, uq_<table>_<column>, ck_<table>_<rule>, ix_<table>_<column> (set in app/db/base.py so migrations can find them)."],
    ["Migrations", "Alembic: f7e7e155e0e8 initial schema → 4e6924f14a2d seeded rows may lack traffic and verify_url → ba844e7ce9b0 admin_settings (head)."],
  ],
};
