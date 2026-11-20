"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { visitorId } from "@/lib/consent";

type Kind = "page_view" | "resume_download";

function device(): "mobile" | "tablet" | "desktop" {
  const width = window.innerWidth;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (width < 640) return "mobile";
  if (touch && width < 1100) return "tablet";
  return "desktop";
}

/** The site the visitor came from: only on the first page of a visit, and never this site itself. */
function externalReferrer(): string | null {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    return ref && ref.origin !== location.origin ? ref.href : null;
  } catch {
    return null;
  }
}

/**
 * Reports page views and résumé downloads to /api/track (this site's server, which passes them to
 * the backend). The anonymous visitor id is added only with analytics consent (lib/consent.ts).
 */
export function VisitTracker() {
  const pathname = usePathname();
  const locale = useLocale();
  const first = useRef(true);

  useEffect(() => {
    const send = (kind: Kind, referrer: string | null = null) => {
      const body = JSON.stringify({ kind, path: location.pathname, locale, device: device(), referrer, visitorId: visitorId() });
      fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(
        () => {},
      );
    };
    send("page_view", first.current ? externalReferrer() : null);
    first.current = false;

    // The résumé is the only file the site offers for download.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("a[download]")) send("resume_download");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname, locale]);

  return null;
}
