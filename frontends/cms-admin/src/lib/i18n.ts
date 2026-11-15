/** The public site's languages; every visitor-facing text is stored in all three. */
export const LANGS = ["en", "ru", "tg"] as const;
export type Lang = (typeof LANGS)[number];
export type I18nText = Record<Lang, string>;

export const LANG_LABELS: Record<Lang, string> = { en: "EN", ru: "RU", tg: "TG" };
export const LANG_NAMES: Record<Lang, string> = { en: "English", ru: "Russian", tg: "Tajik" };

export const emptyI18n = (): I18nText => ({ en: "", ru: "", tg: "" });

/** null (not set) → empty tabs, for optional texts. */
export const i18nOrEmpty = (value: I18nText | null | undefined): I18nText => value ?? emptyI18n();

/** Empty tabs → null, so the backend stores "not set" (all three or none). */
export function i18nOrNull(value: I18nText): I18nText | null {
  return LANGS.every((lang) => !stripTags(value[lang]).trim()) ? null : value;
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/** Visible length of a text (rich text: tags removed, whitespace runs counted once). */
export function visibleLength(value: string, rich = false): number {
  const text = rich ? stripTags(value) : value;
  return (rich ? text.replace(/\s+/g, " ").trim() : text).length;
}
