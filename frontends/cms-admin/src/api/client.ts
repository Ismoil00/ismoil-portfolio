import axios, { isAxiosError } from "axios";

/**
 * Browser-side API client. Calls go to this app's own /api/* (forwarded to the backend), so the
 * session cookie is sent automatically; writes also carry the CSRF token from its cookie.
 */
export const api = axios.create({ baseURL: "/api/v1", withCredentials: true, timeout: 10 * 60_000 });

const CSRF_COOKIES = ["__Host-csrf", "csrf"];
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

function readCookie(name: string): string | undefined {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/** The CSRF token the backend expects in X-CSRF-Token on writes (read from its cookie). */
export function csrfToken(): string | undefined {
  return CSRF_COOKIES.map(readCookie).find(Boolean);
}

api.interceptors.request.use((config) => {
  if (!SAFE.has((config.method ?? "get").toUpperCase())) {
    const token = csrfToken();
    if (token) config.headers.set("X-CSRF-Token", token);
  }
  return config;
});

api.interceptors.response.use(undefined, (error) => {
  // Session expired while working: back to the login page, then back here.
  if (isAxiosError(error) && error.response?.status === 401 && !location.pathname.startsWith("/login")) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload drops stale client state
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
  }
  return Promise.reject(error);
});
