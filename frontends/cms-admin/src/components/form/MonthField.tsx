"use client";

import { useCallback, useRef, useState } from "react";
import { LuCalendar, LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";
import { useDismiss } from "@/components/ui/useDismiss";
import { inputClass } from "./Field";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/**
 * Month + year picker ("YYYY-MM"), the public site's MonthPicker in form style.
 * Months outside [min, max] can't be picked.
 */
export function MonthField({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  invalid,
  placeholder = "Pick a month",
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  min?: string | null;
  max?: string | null;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const startYear = Number((value ?? max ?? `${new Date().getFullYear()}`).slice(0, 4));
  const [year, setYear] = useState(startYear);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  const key = (m: number) => `${year}-${String(m).padStart(2, "0")}`;
  const blocked = (m: number) => Boolean((min && key(m) < min) || (max && key(m) > max));
  const minYear = min ? Number(min.slice(0, 4)) : -Infinity;
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-invalid={invalid || undefined}
        onClick={() => {
          setYear(startYear);
          setOpen((v) => !v);
        }}
        className={`${inputClass} flex items-center gap-2 text-left`}
      >
        <LuCalendar className="size-4 shrink-0 text-subtle" />
        <span className={value ? "text-fg" : "text-faint"}>{value ? formatMonth(value) : placeholder}</span>
      </button>
      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Clear month"
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-faint hover:bg-tint/[0.06] hover:text-fg"
        >
          <LuX className="size-3.5" />
        </button>
      )}
      {open && (
        <div role="dialog" className="absolute left-0 top-full z-40 mt-2 w-64 animate-pop-in rounded-xl border border-line-strong bg-surface p-3 shadow-[0_18px_50px_-12px_var(--pop-shadow)]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              disabled={year <= minYear}
              aria-label="Previous year"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-tint/[0.06] hover:text-fg disabled:opacity-30"
            >
              <LuChevronLeft className="size-4" />
            </button>
            <span className="font-display tabular-nums">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= maxYear}
              aria-label="Next year"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-tint/[0.06] hover:text-fg disabled:opacity-30"
            >
              <LuChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((name, i) => {
              const selected = value === key(i + 1);
              return (
                <button
                  key={name}
                  type="button"
                  disabled={blocked(i + 1)}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(key(i + 1));
                    setOpen(false);
                  }}
                  className={`rounded-lg py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                    selected ? "bg-accent font-medium text-bg light:text-white" : "text-muted hover:bg-tint/[0.06] hover:text-fg"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
