"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, getPathname } from "@/i18n/navigation";
import { routing, localeLabels, type Locale } from "@/i18n/routing";

/**
 * Switching language does a full page load on purpose: `[locale]/layout.tsx` is the root layout
 * (it renders <html lang>), so a fresh document gives the correct lang attribute, fonts and
 * server-rendered SEO markup. The current #section is kept so the visitor stays in place.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("nav");
  const current = useLocale() as Locale;
  const pathname = usePathname();

  const change = (locale: Locale) => {
    if (locale === current) return;
    window.location.assign(getPathname({ href: pathname, locale }) + window.location.hash);
  };

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={`inline-flex rounded-full border border-line bg-card p-1 ${className}`}
    >
      {routing.locales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            title={localeLabels[locale].name}
            aria-pressed={active}
            onClick={() => change(locale)}
            // Hover: inactive pills light up, the active one brightens. Click: pill presses in.
            className={`cursor-pointer rounded-full px-2.5 py-1 font-display text-xs font-medium transition-[color,background-color,transform,translate,scale,box-shadow] duration-200 ease-out active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active
                ? "bg-accent text-bg hover:bg-accent-soft hover:shadow-[0_0_12px_-2px_rgb(66_135_255/0.7)]"
                : "text-muted hover:bg-tint/10 hover:text-fg active:bg-tint/15"
            }`}
          >
            {localeLabels[locale].short}
          </button>
        );
      })}
    </div>
  );
}
