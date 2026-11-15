"use client";

import { useCallback, useId, useRef, useState } from "react";
import { LuCalendar, LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";
import { formatMonth, parseMonth } from "@/lib/dates";
import { useDismiss } from "./useDismiss";

interface Props {
  label: string;
  /** "YYYY-MM" or undefined. */
  value?: string;
  onChange: (value: string | undefined) => void;
  /** Months outside [min, max] are disabled ("YYYY-MM"). */
  min?: string | null;
  max?: string | null;
  monthNames: string[];
  placeholder: string;
  clearText: string;
  prevYearText: string;
  nextYearText: string;
  /** Which edge the popover lines up with — use "end" for pickers near the right edge. */
  align?: "start" | "end";
}

/**
 * Year/month picker in a popover — a consistent, cross-browser replacement for <input type="month">
 * (which Firefox doesn't support).
 */
export function MonthPicker({
  label,
  value,
  onChange,
  min,
  max,
  monthNames,
  placeholder,
  clearText,
  prevYearText,
  nextYearText,
  align = "start",
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const initialYear = parseMonth(value ?? max ?? min ?? `${new Date().getFullYear()}-01`).year;
  const [year, setYear] = useState(initialYear);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  const minYear = min ? parseMonth(min).year : -Infinity;
  const maxYear = max ? parseMonth(max).year : Infinity;
  const key = (m: number) => `${year}-${String(m).padStart(2, "0")}`;
  const disabled = (m: number) => (min ? key(m) < min : false) || (max ? key(m) > max : false);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span id={`${id}-label`} className="mb-1.5 block font-display text-xs uppercase tracking-[0.15em] text-subtle">
        {label}
      </span>
      <div
        className={`flex h-11 w-full items-center rounded-xl border bg-card text-sm transition-colors ${
          open || value ? "border-accent/50" : "border-line hover:border-line-strong"
        }`}
      >
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-value`}
          onClick={() => {
            if (!open) setYear(initialYear);
            setOpen((v) => !v);
          }}
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-xl px-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <LuCalendar className="size-4 shrink-0 text-subtle" aria-hidden />
          <span id={`${id}-value`} className={`truncate ${value ? "text-fg" : "text-subtle"}`}>
            {value ? formatMonth(value, monthNames) : placeholder}
          </span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label={clearText}
            title={clearText}
            className="mr-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-tint/[0.06] hover:text-fg"
          >
            <LuX className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-labelledby={`${id}-label`}
          className={`absolute top-full z-30 mt-2 w-64 rounded-xl ${align === "end" ? "right-0" : "left-0"} border border-line-strong bg-surface p-3 shadow-[0_18px_50px_-12px_var(--pop-shadow)]`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              disabled={year <= minYear}
              aria-label={prevYearText}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-tint/[0.06] hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <LuChevronLeft className="size-4" />
            </button>
            <span className="font-display text-fg tabular-nums" aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= maxYear}
              aria-label={nextYearText}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-tint/[0.06] hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <LuChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {monthNames.map((name, i) => {
              const m = i + 1;
              const selected = value === key(m);
              return (
                <button
                  key={name}
                  type="button"
                  disabled={disabled(m)}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(key(m));
                    setOpen(false);
                  }}
                  className={`rounded-lg py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                    selected
                      ? "bg-accent font-medium text-bg"
                      : "text-muted hover:bg-tint/[0.06] hover:text-fg disabled:hover:bg-transparent"
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
