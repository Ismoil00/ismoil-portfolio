import { defineRouting } from "next-intl/routing";

export const locales = ["en", "ru", "tg"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
});

export const localeLabels: Record<Locale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  ru: { short: "RU", name: "Русский" },
  tg: { short: "TJ", name: "Тоҷикӣ" },
};
