"use client";

import { useTranslations } from "next-intl";
import type { CertificateFilterOptions } from "@/types/content";
import { FilterPanel, FilterSelect, PeriodFilter } from "@/components/listing/FilterFields";

export interface Filters {
  fields: string[];
  from?: string;
  to?: string;
}

export const emptyFilters: Filters = { fields: [] };

export const hasFilters = (f: Filters) => f.fields.length > 0 || Boolean(f.from || f.to);

/** URL ⇄ filters: ?field=…&from=YYYY-MM&to=YYYY-MM */
export function readFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  return { fields: p.getAll("field"), from: p.get("from") ?? undefined, to: p.get("to") ?? undefined };
}
export function toSearchParams(f: Filters) {
  const p = new URLSearchParams();
  f.fields.forEach((v) => p.append("field", v));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  return p;
}

/** Field of study (multi-select) · Period (from–to months). */
export function CertificatesFilters({
  options,
  value,
  onChange,
}: {
  options: CertificateFilterOptions;
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const t = useTranslations("certificatesPage");

  return (
    <FilterPanel label={t("filtersLabel")} columns="sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr]">
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
