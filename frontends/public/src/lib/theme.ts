/**
 * Dark / light theme. Dark is the default; choosing light sets <html data-theme="light">
 * (see globals.css → Themes) and is remembered in localStorage.
 */
import { allowsPreferences } from "./consent";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "theme";

/** Browser UI color (address bar on phones) per theme = the page background. */
export const themeColors: Record<Theme, string> = { dark: "#080a0f", light: "#f5f7fb" };

/**
 * Runs in <head> before the page is painted, so a visitor who chose light never sees a dark
 * flash. Kept tiny and dependency-free on purpose.
 */
export const themeInitScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Applies a theme now (no animation) and remembers it. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;
  syncThemeColor(theme);
  // Remembered only with the visitor's consent to preference cookies (lib/consent.ts).
  if (!allowsPreferences()) return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / storage blocked: the choice just isn't remembered.
  }
}

export function syncThemeColor(theme: Theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[theme]);
}
