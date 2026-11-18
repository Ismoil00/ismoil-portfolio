"use client";

import { useCallback, useId, useRef, useState, type FocusEvent } from "react";
import { LuCalendar, LuX } from "react-icons/lu";
import { CalendarPanel, type CalendarTexts } from "@/components/ui/CalendarPanel";
import { useDismiss } from "@/components/ui/useDismiss";
import { dayKey, displayDate, inRange, monthKey, parseTyped, typedFormat, type DateMode } from "@/lib/date-input";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TEXTS: CalendarTexts = {
  prevYear: "Previous year",
  nextYear: "Next year",
  prevYears: "Previous 12 years",
  nextYears: "Next 12 years",
  chooseYear: "Choose a year",
  prevMonth: "Previous month",
  nextMonth: "Next month",
  chooseMonth: "Choose a month",
  weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};

/**
 * Date field used by every form: type the date (03.2024, Mar 2024, 15.03.2024…) or pick it in the
 * calendar. Month mode stores "YYYY-MM", day mode "YYYY-MM-DD". A typed date is taken as soon as it
 * is complete and inside [min, max]; leaving the field with anything else restores the last date.
 * The public site's MonthPicker shares the calendar and the typing rules (CalendarPanel, date-input).
 */
export function DateField({
  id,
  mode = "month",
  value,
  onChange,
  min,
  max,
  disabled,
  invalid,
  placeholder,
}: {
  id?: string;
  mode?: DateMode;
  value: string | null;
  onChange: (value: string | null) => void;
  min?: string | null;
  max?: string | null;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null); // the text while typing
  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  const shown = value ? displayDate(value, mode, MONTHS) : "";
  const text = draft ?? shown;
  const typed = draft?.trim() ? parseTyped(draft, mode, MONTHS) : null;
  const typedBad = Boolean(draft?.trim()) && !(typed && inRange(typed, min, max));
  const now = new Date();
  const today = mode === "day" ? dayKey(now.getFullYear(), now.getMonth() + 1, now.getDate()) : monthKey(now.getFullYear(), now.getMonth() + 1);

  function type(next: string) {
    setDraft(next);
    if (!next.trim()) return onChange(null);
    const parsed = parseTyped(next, mode, MONTHS);
    if (parsed && inRange(parsed, min, max)) onChange(parsed);
  }

  function finish() {
    setDraft(null); // shows the last valid date again
    setOpen(false);
  }

  function onBlur(e: FocusEvent) {
    if (!rootRef.current?.contains(e.relatedTarget as Node | null)) finish();
  }

  return (
    <div ref={rootRef} className="relative" onBlur={onBlur}>
      <div
        data-invalid={invalid || typedBad || undefined}
        data-disabled={disabled || undefined}
        className="flex w-full items-center rounded-xl border border-line bg-tint/[0.03] text-sm text-fg transition-[border-color,background-color,box-shadow] duration-200 hover:border-line-strong focus-within:border-accent/70 focus-within:bg-tint/[0.05] focus-within:ring-2 focus-within:ring-accent/20 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[invalid=true]:border-danger/70"
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
          aria-label="Open the calendar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-l-xl text-subtle transition-colors hover:text-accent disabled:cursor-not-allowed"
        >
          <LuCalendar className="size-4" />
        </button>
        <input
          ref={inputRef}
          id={id}
          value={text}
          disabled={disabled}
          placeholder={placeholder ?? `Pick or type ${typedFormat(mode)}`}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={calendarId}
          aria-invalid={invalid || typedBad || undefined}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => setDraft(null)} // leaving the text shows the date it holds, tidied
          onClick={() => setOpen(true)}
          onChange={(e) => type(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // don't submit the form
              finish();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            } else if (e.key === "Escape" && !open) {
              setDraft(null);
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-2.5 pr-2 outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setDraft(null);
              inputRef.current?.focus();
            }}
            aria-label="Clear the date"
            className="mr-1.5 grid size-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-tint/[0.06] hover:text-fg"
          >
            <LuX className="size-3.5" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div
          id={calendarId}
          role="dialog"
          aria-label="Calendar"
          tabIndex={-1}
          className="absolute left-0 top-full z-40 mt-2 animate-pop-in rounded-xl border border-line-strong bg-surface p-3 shadow-[0_18px_50px_-12px_var(--pop-shadow)] outline-none"
        >
          <CalendarPanel
            key={value ?? "empty"}
            mode={mode}
            value={value}
            focus={max && today > max ? max : min && today < min ? min : today}
            min={min}
            max={max}
            monthNames={MONTHS}
            texts={TEXTS}
            onPick={(picked) => {
              onChange(picked);
              finish();
              inputRef.current?.focus();
            }}
          />
          <p className="mt-2.5 border-t border-line pt-2 text-[11px] text-faint">
            Or type it: {mode === "day" ? "15.03.2024 or 15 Mar 2024" : "03.2024 or Mar 2024"}
          </p>
        </div>
      )}
    </div>
  );
}
