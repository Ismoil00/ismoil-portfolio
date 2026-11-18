import { LANGS, type I18nText } from "./i18n";

// How "my role" on a testimonial reads on the site — the same rule as the backend's
// app/core/roles.py (which decides what the site really shows; keep the two in step).
const SUFFIX: I18nText = { en: " development", ru: " Разработчик", tg: " Барномасоз" };

/**
 * A development field's name (3 languages) or a technology's name (one for all) → the role in each
 * language: "Python development" · "Python Разработчик" · "Python Барномасоз". A name that already
 * ends in "development" ("Game development") is shown as it is.
 */
export function roleLabel(name: I18nText | string): I18nText {
  const names = Object.fromEntries(
    LANGS.map((lang) => [lang, typeof name === "string" ? name : name[lang] || name.en]),
  ) as I18nText;
  if (names.en.trim().toLowerCase().endsWith("development")) return names;
  return Object.fromEntries(LANGS.map((lang) => [lang, `${names[lang]}${SUFFIX[lang]}`])) as I18nText;
}
