import "server-only";
import type { Locale } from "@/i18n/routing";
import type { ExperienceFilterOptions, ExperiencePage, ExperienceQuery } from "@/types/content";
import { apiGet } from "./client";
import { endpoints } from "./endpoints";

/** Query params in the shape the backend expects (repeated keys for lists: ?stack=a&stack=b). */
function toParams(locale: Locale, q: ExperienceQuery) {
  const params = new URLSearchParams({ lang: locale, offset: String(q.offset), limit: String(q.limit) });
  q.companies?.forEach((v) => params.append("company", v));
  q.stack?.forEach((v) => params.append("stack", v));
  q.fields?.forEach((v) => params.append("field", v));
  if (q.from) params.set("from", q.from);
  if (q.to) params.set("to", q.to);
  return params;
}

/** One page of experience (newest first, the present job on top), filtered. */
export const getExperiencePage = (locale: Locale, q: ExperienceQuery) =>
  apiGet<ExperiencePage>(endpoints.experience, toParams(locale, q));

/** Companies, technologies, fields and date bounds that the filters can offer. */
export const getExperienceFilterOptions = (locale: Locale) =>
  apiGet<ExperienceFilterOptions>(endpoints.experienceFilters, { lang: locale });
