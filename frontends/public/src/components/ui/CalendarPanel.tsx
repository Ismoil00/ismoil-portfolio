"use client";

import { useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { dayKey, daysInMonth, inRange, monthKey, splitDate, type DateMode } from "@/lib/date-input";

// The same file is in both apps (cms-admin and public): one calendar everywhere.

export interface CalendarTexts {
  prevYear: string;
  nextYear: string;
  prevYears: string;
  nextYears: string;
  chooseYear: string;
  /** Day mode only. */
  prevMonth?: string;
  nextMonth?: string;
  chooseMonth?: string;
  /** Day mode only: short weekday names, Monday first. */
  weekdays?: string[];
}

type View = "years" | "months" | "days";
const YEARS_PER_PAGE = 12;

const navButton =
  "inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-tint/[0.06] hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent";
const cell = (selected: boolean, current = false) =>
  `rounded-lg text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
    selected
      ? "bg-accent font-medium text-bg light:text-white"
      : `${current ? "text-accent" : "text-muted"} hover:bg-tint/[0.06] hover:text-fg disabled:hover:bg-transparent`
  }`;

/**
 * The calendar inside a date field's popover. Month mode: months of a year. Day mode: days of a
 * month. A click on the heading zooms out (days → months → years) for fast jumps; the arrows step
 * a month, a year or 12 years. Values outside [min, max] can't be picked.
 */
export function CalendarPanel({
  mode,
  value,
  focus,
  min,
  max,
  monthNames,
  texts,
  onPick,
}: {
  mode: DateMode;
  /** The picked value ("YYYY-MM" / "YYYY-MM-DD"), highlighted. */
  value: string | null;
  /** Where the calendar opens when nothing is picked yet. */
  focus: string;
  min?: string | null;
  max?: string | null;
  monthNames: string[];
  texts: CalendarTexts;
  onPick: (value: string) => void;
}) {
  const start = splitDate(value ?? focus);
  const [view, setView] = useState<View>(mode === "day" ? "days" : "months");
  const [year, setYear] = useState(start.year);
  const [month, setMonth] = useState(start.month);
  const [pageStart, setPageStart] = useState(start.year - (start.year % YEARS_PER_PAGE));
  const picked = value ? splitDate(value) : null;
  const today = new Date();

  // Bounds at each zoom level (min/max are in the field's own format).
  const minMonth = min?.slice(0, 7);
  const maxMonth = max?.slice(0, 7);
  const minYear = min ? Number(min.slice(0, 4)) : -Infinity;
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;
  const monthOk = (y: number, m: number) => inRange(monthKey(y, m), minMonth, maxMonth);

  function shiftMonth(step: number) {
    const index = year * 12 + (month - 1) + step;
    setYear(Math.floor(index / 12));
    setMonth((index % 12) + 1);
  }

  let heading: string;
  let prev: { label: string; disabled: boolean; go: () => void };
  let next: typeof prev;
  let zoomOut: (() => void) | null = null;
  let zoomLabel = "";

  if (view === "days") {
    const prevKey = month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1);
    const nextKey = month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1);
    heading = `${monthNames[month - 1]} ${year}`;
    prev = { label: texts.prevMonth ?? "", disabled: Boolean(minMonth && prevKey < minMonth), go: () => shiftMonth(-1) };
    next = { label: texts.nextMonth ?? "", disabled: Boolean(maxMonth && nextKey > maxMonth), go: () => shiftMonth(1) };
    zoomOut = () => setView("months");
    zoomLabel = texts.chooseMonth ?? "";
  } else if (view === "months") {
    heading = String(year);
    prev = { label: texts.prevYear, disabled: year <= minYear, go: () => setYear((y) => y - 1) };
    next = { label: texts.nextYear, disabled: year >= maxYear, go: () => setYear((y) => y + 1) };
    zoomOut = () => {
      setPageStart(year - (year % YEARS_PER_PAGE));
      setView("years");
    };
    zoomLabel = texts.chooseYear;
  } else {
    heading = `${pageStart} – ${pageStart + YEARS_PER_PAGE - 1}`;
    prev = { label: texts.prevYears, disabled: pageStart <= minYear, go: () => setPageStart((s) => s - YEARS_PER_PAGE) };
    next = { label: texts.nextYears, disabled: pageStart + YEARS_PER_PAGE - 1 >= maxYear, go: () => setPageStart((s) => s + YEARS_PER_PAGE) };
  }

  return (
    <div className={mode === "day" ? "w-72" : "w-64"}>
      <div className="mb-2 flex items-center justify-between gap-1">
        <button type="button" onClick={prev.go} disabled={prev.disabled} aria-label={prev.label} className={navButton}>
          <LuChevronLeft className="size-4" />
        </button>
        {zoomOut ? (
          <button
            type="button"
            onClick={zoomOut}
            aria-label={`${zoomLabel}: ${heading}`}
            className="rounded-lg px-2.5 py-1 font-display text-fg tabular-nums transition-colors hover:bg-tint/6 hover:text-accent"
          >
            {heading}
          </button>
        ) : (
          <span className="px-2.5 py-1 font-display text-fg tabular-nums" aria-live="polite">
            {heading}
          </span>
        )}
        <button type="button" onClick={next.go} disabled={next.disabled} aria-label={next.label} className={navButton}>
          <LuChevronRight className="size-4" />
        </button>
      </div>

      {view === "years" && (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i).map((y) => (
            <button
              key={y}
              type="button"
              disabled={y < minYear || y > maxYear}
              aria-pressed={picked?.year === y}
              onClick={() => {
                setYear(y);
                setView("months");
              }}
              className={`py-2 ${cell(picked?.year === y, today.getFullYear() === y)}`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {view === "months" && (
        <div className="grid grid-cols-3 gap-1.5">
          {monthNames.map((name, i) => {
            const m = i + 1;
            const selected = picked?.year === year && picked.month === m;
            return (
              <button
                key={name}
                type="button"
                disabled={!monthOk(year, m)}
                aria-pressed={selected}
                onClick={() => {
                  if (mode === "month") return onPick(monthKey(year, m));
                  setMonth(m);
                  setView("days");
                }}
                className={`py-2 ${cell(selected)}`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {view === "days" && (
        <div className="grid grid-cols-7 gap-1">
          {(texts.weekdays ?? []).map((d) => (
            <span key={d} className="py-1 text-center text-[11px] uppercase tracking-wide text-faint">
              {d}
            </span>
          ))}
          {/* Blank cells before the 1st (weeks start on Monday). */}
          {Array.from({ length: (new Date(year, month - 1, 1).getDay() + 6) % 7 }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map((d) => {
            const key = dayKey(year, month, d);
            const selected = value === key;
            const isToday = key === dayKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
            return (
              <button
                key={d}
                type="button"
                disabled={!inRange(key, min, max)}
                aria-pressed={selected}
                aria-label={`${d} ${monthNames[month - 1]} ${year}`}
                onClick={() => onPick(key)}
                className={`h-8 ${cell(selected, isToday)}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
