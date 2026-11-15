import { z } from "zod";
import { LANGS, visibleLength } from "./i18n";

// The same rules as the backend (backend/app/schemas/fields.py), checked before sending.

const FILL = "Fill in this language";

function i18nText(max: number, kind: "text" | "multiline" | "rich" | "name") {
  const rich = kind === "rich";
  const text = z.string().superRefine((value, ctx) => {
    const length = visibleLength(value.trim(), rich);
    if (length === 0) ctx.addIssue({ code: "custom", message: FILL });
    else if (length > max) ctx.addIssue({ code: "custom", message: `Use at most ${max} characters` });
    else if (kind === "name" && !NAME.test(value.trim()))
      ctx.addIssue({ code: "custom", message: "Use letters only, without spaces (hyphens and apostrophes are fine)" });
  });
  return z.object({ en: text, ru: text, tg: text });
}

/** EN, RU and TG all required, each at most `max` characters. */
export const i18nRequired = (max: number, kind: "text" | "multiline" | "rich" | "name" = "text") => i18nText(max, kind);

/** All three or none (empty tabs mean "not set"). */
export function i18nOptional(max: number, kind: "text" | "multiline" | "rich" = "text") {
  const rich = kind === "rich";
  return z
    .object({ en: z.string(), ru: z.string(), tg: z.string() })
    .superRefine((value, ctx) => {
      const lengths = LANGS.map((lang) => visibleLength(value[lang].trim(), rich));
      if (lengths.every((n) => n === 0)) return;
      LANGS.forEach((lang, i) => {
        if (lengths[i] === 0) ctx.addIssue({ code: "custom", path: [lang], message: "Fill in every language, or leave all three empty" });
        else if (lengths[i] > max) ctx.addIssue({ code: "custom", path: [lang], message: `Use at most ${max} characters` });
      });
    });
}

// Letters of any script joined by single hyphens/apostrophes — no spaces, digits or symbols.
const NAME = /^\p{L}[\p{L}\p{M}]*(?:['’ʼ-]\p{L}[\p{L}\p{M}]*)*$/u;

export const line = (max: number) =>
  z.string().trim().min(1, "Fill in this field").max(max, `Use at most ${max} characters`);

const URL_MESSAGE = "Enter a full link starting with https://";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") && !url.username;
  } catch {
    return false;
  }
}

export const url = () => z.string().trim().min(1, "Fill in this field").max(2048).refine(isHttpUrl, URL_MESSAGE);
export const optionalUrl = () =>
  z.string().trim().max(2048).refine((v) => v === "" || isHttpUrl(v), URL_MESSAGE);

export const hexColor = () => z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #3776AB");

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
export const month = () =>
  z
    .string()
    .regex(MONTH, "Pick a month")
    .refine((v) => v <= currentMonth(), "This month is in the future");
