"use client";

import { useEffect } from "react";

/**
 * When the page is opened or navigated to with a hash (e.g. #project-gov-platform),
 * makes sure the target is visible and gives it a short glow (`data-flash`, see globals.css).
 * Works for links from the experience cards on the home page and from other pages.
 */
export function HashHighlight() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const flash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      // Reveal-on-scroll may still hide it; show it right away.
      el.closest(".reveal-pending")?.classList.remove("reveal-pending");
      el.querySelectorAll(".reveal-pending").forEach((n) => n.classList.remove("reveal-pending"));
      const target = (el.querySelector("[data-flash-target]") as HTMLElement | null) ?? el;
      target.removeAttribute("data-flash");
      void target.offsetWidth; // restart the animation if the same link is clicked twice
      target.setAttribute("data-flash", "");
      clearTimeout(timer);
      timer = setTimeout(() => target.removeAttribute("data-flash"), 2300);
    };

    const onLoad = setTimeout(flash, 300); // after the browser's own jump to the anchor
    window.addEventListener("hashchange", flash);
    return () => {
      clearTimeout(onLoad);
      clearTimeout(timer);
      window.removeEventListener("hashchange", flash);
    };
  }, []);

  return null;
}
