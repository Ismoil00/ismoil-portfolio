"use client";

import { useTranslations } from "next-intl";
import type { TestimonialFilterOptions } from "@/types/content";
import { FilterPanel, PeriodFilter } from "@/components/listing/FilterFields";

export interface Filters {
  from?: string;
  to?: string;
}

export const emptyFilters: Filters = {};

export const hasFilters = (f: Filters) => Boolean(f.from || f.to);

/** URL ⇄ filters: ?from=YYYY-MM&to=YYYY-MM */
export function readFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  return { from: p.get("from") ?? undefined, to: p.get("to") ?? undefined };
}
export function toSearchParams(f: Filters) {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  return p;
}

/** Only a period (from–to months) — when the testimonials were given. */
export function TestimonialsFilters({
  options,
  value,
  onChange,
}: {
  options: TestimonialFilterOptions;
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const t = useTranslations("testimonialsPage");
  return (
    <FilterPanel label={t("filtersLabel")} columns="sm:max-w-xl">
      <PeriodFilter
        from={value.from}
        to={value.to}
        minDate={options.minDate}
        maxDate={options.maxDate}
        onChange={(range) => onChange({ ...value, ...range })}
      />
    </FilterPanel>
  );
}
