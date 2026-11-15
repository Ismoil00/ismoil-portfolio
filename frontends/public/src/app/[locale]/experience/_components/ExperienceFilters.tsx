"use client";

import { useTranslations } from "next-intl";
import type { ExperienceFilterOptions } from "@/types/content";
import { FilterPanel, FilterSelect, PeriodFilter, TechFilter } from "@/components/listing/FilterFields";

export interface Filters {
  companies: string[];
  stack: string[];
  fields: string[];
  from?: string;
  to?: string;
}

export const emptyFilters: Filters = { companies: [], stack: [], fields: [] };

export const hasFilters = (f: Filters) =>
  f.companies.length > 0 || f.stack.length > 0 || f.fields.length > 0 || Boolean(f.from || f.to);

/** URL ⇄ filters: ?company=…&stack=…&field=…&from=YYYY-MM&to=YYYY-MM */
export function readFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    companies: p.getAll("company"),
    stack: p.getAll("stack"),
    fields: p.getAll("field"),
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
  };
}
export function toSearchParams(f: Filters) {
  const p = new URLSearchParams();
  f.companies.forEach((v) => p.append("company", v));
  f.stack.forEach((v) => p.append("stack", v));
  f.fields.forEach((v) => p.append("field", v));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  return p;
}

/** Company · Technologies · Field (multi-select) · Period (from–to months). */
export function ExperienceFilters({
  options,
  value,
  onChange,
}: {
  options: ExperienceFilterOptions;
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const t = useTranslations("experiencePage");
  const tl = useTranslations("listing");

  return (
    <FilterPanel label={t("filtersLabel")}>
      <FilterSelect
        label={tl("company")}
        options={options.companies.map((c) => ({ value: c, label: c }))}
        value={value.companies}
        onChange={(companies) => onChange({ ...value, companies })}
      />
      <TechFilter options={options.stack} value={value.stack} onChange={(stack) => onChange({ ...value, stack })} />
      <FilterSelect
        label={t("fields")}
        options={options.fields.map((f) => ({ value: f.id, label: f.title }))}
        value={value.fields}
        onChange={(fields) => onChange({ ...value, fields })}
      />
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
