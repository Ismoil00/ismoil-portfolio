// Addresses and files shared by the config and the tests. The E2E servers use their own ports, so
// they run next to your development servers (3000 / 3001 / 8000) without touching them.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const REPO_DIR = path.dirname(E2E_DIR);
export const TMP_DIR = path.join(E2E_DIR, ".tmp");

export const PORTS = { backend: 8100, site: 3100, admin: 3101 } as const;

export const SITE_URL = `http://localhost:${PORTS.site}`;
export const ADMIN_URL = `http://localhost:${PORTS.admin}`;
export const API_URL = `http://localhost:${PORTS.backend}/api/v1`;

/** A page of the public site, e.g. site("/en/projects"). */
export const site = (pathname: string) => `${SITE_URL}${pathname}`;
/** A page of the admin panel, e.g. admin("/about"). */
export const admin = (pathname: string) => `${ADMIN_URL}${pathname}`;

/** Signed-in admin browser state, saved once by tests/auth.setup.ts. */
export const ADMIN_STATE = path.join(TMP_DIR, "admin-state.json");

/** The E2E admin, created with a new random password on every run by scripts/backend.py. */
export function adminCredentials(): { email: string; password: string } {
  return JSON.parse(readFileSync(path.join(TMP_DIR, "admin.json"), "utf-8"));
}

export const LOCALES = ["en", "ru", "tg"] as const;
export type Locale = (typeof LOCALES)[number];
