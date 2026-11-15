"use client";

import { useEffect, useSyncExternalStore, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { LuMoon, LuSun } from "react-icons/lu";
import { applyTheme, currentTheme, syncThemeColor, type Theme } from "@/lib/theme";

/** Re-render when <html data-theme> changes. */
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/**
 * Round sun / moon button in the header. The new theme spreads as a circle from the button
 * (View Transitions API); without it, or with reduced motion, the switch is instant.
 * Which icon shows is decided by CSS (`light:`), so there's no flash before hydration.
 */
export function ThemeToggle() {
  const t = useTranslations("nav");
  // Read from <html data-theme>; null on the server, which can't see the visitor's choice.
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, () => null);

  // The browser bar color is a static <meta> from the server: match it to a saved light theme.
  useEffect(() => syncThemeColor(currentTheme()), []);

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    const next: Theme = currentTheme() === "light" ? "dark" : "light";
    let switched = false;
    const switchTo = () => {
      switched = true;
      applyTheme(next);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) {
      switchTo();
      return;
    }

    // Circle center: the click point, or the button's center for keyboard presses.
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.detail > 0 ? e.clientX : box.left + box.width / 2;
    const y = e.detail > 0 ? e.clientY : box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const root = document.documentElement;
    root.classList.add("theme-switching");
    const transition = document.startViewTransition(switchTo);
    // If the browser can't produce the animation frames (e.g. the page isn't being drawn),
    // skip the animation so the theme still changes right away.
    window.setTimeout(() => {
      if (!switched) transition.skipTransition();
    }, 300);
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 550, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
    transition.finished.finally(() => root.classList.remove("theme-switching"));
  };

  const label = theme === "light" ? t("themeDark") : t("themeLight");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-card text-muted transition-[color,border-color,background-color,transform,translate,scale] duration-200 ease-out hover:border-accent/50 hover:text-accent active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* Dark theme shows the sun (switch to light), light theme shows the moon. */}
      <LuSun className="size-4 light:hidden" aria-hidden />
      <LuMoon className="hidden size-4 light:block" aria-hidden />
    </button>
  );
}
