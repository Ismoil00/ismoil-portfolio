"use server";

import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import type { TestimonialQuery, TestimonialsPage } from "@/types/content";
import { getTestimonialsPage } from "./testimonials.api";
import { cleanMonth, cleanPaging } from "./query-guards";

/** Server Action the testimonials page calls for "Show more" and filter changes (see experience.actions.ts). */
export async function loadTestimonialsPage(locale: string, query: TestimonialQuery): Promise<TestimonialsPage> {
  if (!hasLocale(routing.locales, locale)) throw new Error("Unsupported locale");
  return getTestimonialsPage(locale, {
    ...cleanPaging(query),
    from: cleanMonth(query?.from),
    to: cleanMonth(query?.to),
  });
}
