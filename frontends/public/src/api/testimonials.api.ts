import "server-only";
import type { Locale } from "@/i18n/routing";
import type { TestimonialFilterOptions, TestimonialQuery, TestimonialsPage } from "@/types/content";
import { apiGet } from "./client";
import { endpoints } from "./endpoints";

function toParams(locale: Locale, q: TestimonialQuery) {
  const params = new URLSearchParams({ lang: locale, offset: String(q.offset), limit: String(q.limit) });
  if (q.from) params.set("from", q.from);
  if (q.to) params.set("to", q.to);
  return params;
}

/** One page of testimonials (newest first), filtered by date. */
export const getTestimonialsPage = (locale: Locale, q: TestimonialQuery) =>
  apiGet<TestimonialsPage>(endpoints.testimonials, toParams(locale, q));

/** Date bounds for the filter. */
export const getTestimonialFilterOptions = () => apiGet<TestimonialFilterOptions>(endpoints.testimonialFilters);
