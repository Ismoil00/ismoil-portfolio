"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { TechRef } from "@/types/content";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { SvgIcon } from "@/components/ui/SvgIcon";
import { themedBrandColor } from "@/lib/brand-color";

/**
 * The bordered box holding a page's filters — by default 2 columns on tablets and 4 on large
 * screens (Company · Technologies · <page filter> · Period). `columns` replaces that layout.
 */
export function FilterPanel({
  label,
  children,
  columns = "sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr]",
}: {
  label: string;
  children: ReactNode;
  columns?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`grid gap-4 rounded-2xl border border-line bg-card p-4 sm:p-5 ${columns}`}
    >
      {children}
    </div>
  );
}

/** Multi-select with the shared texts ("Any", "Search…", "3 selected", …). */
export function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const t = useTranslations("listing");
  return (
    <MultiSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={t("any")}
      searchPlaceholder={t("search")}
      noOptionsText={t("noOptions")}
      clearText={t("clear")}
      selectedText={(count) => t("selected", { count })}
    />
  );
}

/** "Technologies" filter, each option with its brand icon. */
export function TechFilter({
  options,
  value,
  onChange,
}: {
  options: TechRef[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const t = useTranslations("listing");
  return (
    <FilterSelect
      label={t("technologies")}
      options={options.map((s) => ({
        value: s.id,
        label: s.name,
        icon: <SvgIcon svg={s.icon} color={themedBrandColor(s.color)} className="size-4" />,
      }))}
      value={value}
      onChange={onChange}
    />
  );
}

/** "Period · From" and "To" month pickers; each limits the other so the range stays valid. */
export function PeriodFilter({
  from,
  to,
  minDate,
  maxDate,
  onChange,
}: {
  from?: string;
  to?: string;
  minDate: string | null;
  maxDate: string | null;
  onChange: (range: { from?: string; to?: string }) => void;
}) {
  const t = useTranslations("listing");
  const monthNames = useTranslations("experience").raw("months") as string[];
  const texts = {
    monthNames,
    placeholder: t("any"),
    clearText: t("clear"),
    prevYearText: t("prevYear"),
    nextYearText: t("nextYear"),
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <MonthPicker
        label={`${t("period")} · ${t("from")}`}
        value={from}
        onChange={(value) => onChange({ from: value, to })}
        min={minDate}
        max={to ?? maxDate}
        {...texts}
      />
      <MonthPicker
        label={t("to")}
        value={to}
        onChange={(value) => onChange({ from, to: value })}
        min={from ?? minDate}
        max={maxDate}
        {...texts}
        align="end"
      />
    </div>
  );
}
