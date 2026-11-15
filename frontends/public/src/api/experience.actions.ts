"use server";

import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import type { ExperiencePage, ExperienceQuery } from "@/types/content";
import { getExperiencePage } from "./experience.api";
import { cleanList, cleanMonth, cleanPaging } from "./query-guards";

/**
 * Server Action the experience page calls for "Show more" and filter changes.
 * Why a Server Action and not axios in the browser: the request still goes through our
 * api layer on the server (same code path as the first render, works with or without the
 * backend), the static data never ships to the browser, and the backend URL stays private.
 */
export async function loadExperiencePage(locale: string, query: ExperienceQuery): Promise<ExperiencePage> {
  if (!hasLocale(routing.locales, locale)) throw new Error("Unsupported locale");
  return getExperiencePage(locale, {
    ...cleanPaging(query),
    companies: cleanList(query?.companies),
    stack: cleanList(query?.stack),
    fields: cleanList(query?.fields),
    from: cleanMonth(query?.from),
    to: cleanMonth(query?.to),
  });
}
