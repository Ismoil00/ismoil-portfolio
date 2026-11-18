"use client";

import { useCallback, useId, useRef, useState, type FocusEvent } from "react";
import { LuCalendar, LuX } from "react-icons/lu";
import { displayDate, inRange, monthKey, parseTyped } from "@/lib/date-input";
import { CalendarPanel, type CalendarTexts } from "./CalendarPanel";
import { useDismiss } from "./useDismiss";

interface Props {
  label: string;
  /** "YYYY-MM" or undefined. */
  value?: string;
  onChange: (value: string | undefined) => void;
  /** Months outside [min, max] can't be picked or typed ("YYYY-MM"). */
  min?: string | null;
  max?: string | null;
  monthNames: string[];
  placeholder: string;
  clearText: string;
  openText: string;
  calendarText: string;
  typeHint: string;
  texts: CalendarTexts;
  /** Which edge the popover lines up with — use "end" for pickers near the right edge. */
  align?: "start" | "end";
}

/**
 * Month filter: type the month (03.2024, Mar 2024, мар. 2024…) or pick it in the calendar
 * (a click on the year shows a grid of years). A typed month is applied as soon as it is complete
 * and inside [min, max]; leaving the field with anything else restores the last month.
 * Same calendar and typing rules as the admin panel's date fields (CalendarPanel, date-input).
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
  openText,
  calendarText,
  typeHint,
  texts,
  align = "start",
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  const shown = value ? displayDate(value, "month", monthNames) : "";
  const typed = draft?.trim() ? parseTyped(draft, "month", monthNames) : null;
  const typedBad = Boolean(draft?.trim()) && !(typed && inRange(typed, min, max));
  const now = new Date();
  const today = monthKey(now.getFullYear(), now.getMonth() + 1);

  function type(next: string) {
    setDraft(next);
    if (!next.trim()) return onChange(undefined);
    const parsed = parseTyped(next, "month", monthNames);
    if (parsed && inRange(parsed, min, max) && parsed !== value) onChange(parsed);
  }

  function finish() {
    setDraft(null);
    setOpen(false);
  }

  function onBlur(e: FocusEvent) {
    if (!rootRef.current?.contains(e.relatedTarget as Node | null)) finish();
  }

  return (
    <div ref={rootRef} className="relative min-w-0" onBlur={onBlur}>
      <label htmlFor={`${id}-input`} className="mb-1.5 block font-display text-xs uppercase tracking-[0.15em] text-subtle">
        {label}
      </label>
      <div
        data-invalid={typedBad || undefined}
        className={`flex h-11 w-full items-center rounded-xl border bg-card text-sm transition-colors focus-within:border-accent/70 data-[invalid=true]:border-red-400/70 ${
          open || value ? "border-accent/50" : "border-line hover:border-line-strong"
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
          aria-label={openText}
          className="inline-flex h-full w-10 shrink-0 items-center justify-center rounded-l-xl text-subtle transition-colors hover:text-accent"
        >
          <LuCalendar className="size-4" aria-hidden />
        </button>
        <input
          ref={inputRef}
          id={`${id}-input`}
          value={draft ?? shown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          aria-invalid={typedBad || undefined}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => setDraft(null)} // leaving the text shows the date it holds, tidied
          onClick={() => setOpen(true)}
          onChange={(e) => type(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              finish();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            } else if (e.key === "Escape" && !open) {
              setDraft(null);
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent pr-2 text-fg outline-none placeholder:text-subtle"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setDraft(null);
            }}
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
          id={`${id}-calendar`}
          role="dialog"
          aria-label={calendarText}
          tabIndex={-1}
          className={`absolute top-full z-30 mt-2 rounded-xl ${align === "end" ? "right-0" : "left-0"} border border-line-strong bg-surface p-3 shadow-[0_18px_50px_-12px_var(--pop-shadow)] outline-none`}
        >
          <CalendarPanel
            key={value ?? "empty"}
            mode="month"
            value={value ?? null}
            focus={max && today > max ? max : min && today < min ? min : today}
            min={min}
            max={max}
            monthNames={monthNames}
            texts={texts}
            onPick={(picked) => {
              onChange(picked);
              finish();
            }}
          />
          <p className="mt-2.5 border-t border-line pt-2 text-[11px] text-subtle">{typeHint}</p>
        </div>
      )}
    </div>
  );
}
