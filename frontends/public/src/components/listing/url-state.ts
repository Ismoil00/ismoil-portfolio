"use client";

import { useSyncExternalStore } from "react";

// List filters live in the URL (?company=…&stack=…). The URL is the single source of truth:
// filtered views can be shared/bookmarked, and Back/Forward restore them.

const EVENT = "listing-url-change";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/** The current query string — "" on the server and during hydration, the real one afterwards. */
export function useUrlSearch() {
  return useSyncExternalStore(subscribe, () => window.location.search, () => "");
}

/** Replaces the query string without a navigation and notifies `useUrlSearch`. */
export function replaceUrlSearch(params: URLSearchParams) {
  const qs = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  window.dispatchEvent(new Event(EVENT));
}
