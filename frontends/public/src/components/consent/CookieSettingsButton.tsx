"use client";

import { openConsentSettings } from "@/lib/consent";

/** Opens the cookie settings panel (ConsentBanner) from anywhere: footer, cookie policy page. */
export function CookieSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={openConsentSettings} className={className}>
      {label}
    </button>
  );
}
