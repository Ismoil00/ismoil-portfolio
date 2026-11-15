"use client";

import { useTranslations } from "next-intl";
import { PRIVATE_CLIENTS, SELF_INITIATED, type ProjectFilterOptions } from "@/types/content";
import { FilterPanel, FilterSelect, PeriodFilter, TechFilter } from "@/components/listing/FilterFields";
import { SvgIcon } from "@/components/ui/SvgIcon";

export interface Filters {
  clients: string[];
  stack: string[];
  types: string[];
  from?: string;
  to?: string;
}

export const emptyFilters: Filters = { clients: [], stack: [], types: [] };

export const hasFilters = (f: Filters) =>
  f.clients.length > 0 || f.stack.length > 0 || f.types.length > 0 || Boolean(f.from || f.to);

/** URL ⇄ filters: ?client=…&stack=…&type=…&from=YYYY-MM&to=YYYY-MM */
export function readFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    clients: p.getAll("client"),
    stack: p.getAll("stack"),
    types: p.getAll("type"),
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
  };
}
export function toSearchParams(f: Filters) {
  const p = new URLSearchParams();
  f.clients.forEach((v) => p.append("client", v));
  f.stack.forEach((v) => p.append("stack", v));
  f.types.forEach((v) => p.append("type", v));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  return p;
}

/** Client · Technologies · Product type (multi-select) · Period (from–to months). */
export function ProjectsFilters({
  options,
  value,
  onChange,
}: {
  options: ProjectFilterOptions;
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const t = useTranslations("projectsPage");
  const clientLabel = (c: string) =>
    c === SELF_INITIATED ? t("selfInitiated") : c === PRIVATE_CLIENTS ? t("privateClients") : c;

  return (
    <FilterPanel label={t("filtersLabel")}>
      <FilterSelect
        label={t("client")}
        options={options.clients.map((c) => ({ value: c, label: clientLabel(c) }))}
        value={value.clients}
        onChange={(clients) => onChange({ ...value, clients })}
      />
      <TechFilter options={options.stack} value={value.stack} onChange={(stack) => onChange({ ...value, stack })} />
      <FilterSelect
        label={t("types")}
        options={options.types.map((type) => ({
          value: type.id,
          label: type.title,
          icon: type.icon ? <SvgIcon svg={type.icon} className="size-4 text-accent" /> : undefined,
        }))}
        value={value.types}
        onChange={(types) => onChange({ ...value, types })}
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
