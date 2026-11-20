/**
 * Cookie consent. The visitor's choice is kept in one small cookie, `consent` ("necessary" storage: it
 * needs no consent of its own), for 6 months:
 * - analytics: a random visitor id (`vid` cookie) is sent with visit statistics, so returning visitors
 *   can be counted. Without it a page view is still counted, anonymously, with nothing stored.
 * - preferences: the light/dark theme is remembered (localStorage). Without it the theme still
 *   switches, but resets on the next visit.
 * Changing the choice later (footer → Cookie settings) takes effect at once: refusing removes what
 * was stored.
 */
import { THEME_STORAGE_KEY } from "./theme";

export type Consent = { analytics: boolean; preferences: boolean };

export const CONSENT_COOKIE = "consent";
export const VISITOR_COOKIE = "vid";
/** Fired on `window` when the choice changes, and to open the settings panel. */
export const CONSENT_CHANGED = "consent-changed";
export const OPEN_CONSENT_SETTINGS = "open-consent-settings";

const VERSION = "1";
const HALF_YEAR = 60 * 60 * 24 * 182;
const YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

/** The saved choice, or null when the visitor hasn't chosen yet (or chose under an older policy). */
export function readConsent(): Consent | null {
  const value = readCookie(CONSENT_COOKIE);
  const match = value?.match(/^v(\d+):a([01])p([01])$/);
  if (!match || match[1] !== VERSION) return null;
  return { analytics: match[2] === "1", preferences: match[3] === "1" };
}

export function saveConsent(consent: Consent) {
  writeCookie(CONSENT_COOKIE, `v${VERSION}:a${consent.analytics ? 1 : 0}p${consent.preferences ? 1 : 0}`, HALF_YEAR);
  if (!consent.analytics) writeCookie(VISITOR_COOKIE, "", 0);
  try {
    // Allowed now: keep the theme already chosen on this visit. Refused: forget it.
    if (consent.preferences) localStorage.setItem(THEME_STORAGE_KEY, document.documentElement.dataset.theme ?? "dark");
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Storage blocked: nothing is stored either way.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED, { detail: consent }));
}

export function allowsPreferences(): boolean {
  return readConsent()?.preferences ?? false;
}

/** The anonymous visitor id, created on first use, only with analytics consent. */
export function visitorId(): string | null {
  if (!readConsent()?.analytics) return null;
  let id = readCookie(VISITOR_COOKIE);
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = crypto.randomUUID();
  }
  writeCookie(VISITOR_COOKIE, id, YEAR); // refreshed on each visit
  return id;
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_CONSENT_SETTINGS));
}
