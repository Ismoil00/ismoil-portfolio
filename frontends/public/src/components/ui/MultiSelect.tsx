"use client";

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { LuCheck, LuChevronDown, LuSearch } from "react-icons/lu";
import { useDismiss } from "./useDismiss";

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Trigger text when nothing is selected (e.g. "Any"). */
  placeholder: string;
  searchPlaceholder: string;
  noOptionsText: string;
  clearText: string;
  /** Trigger text when 3+ items are selected, e.g. (n) => `${n} selected`. */
  selectedText: (count: number) => string;
}

/**
 * Dropdown with checkboxes for picking several values.
 * Keyboard: Enter/Space opens, ↑/↓ move between options, Space/Enter toggles, Esc closes.
 * A search box appears when there are more than 6 options.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noOptionsText,
  clearText,
  selectedText,
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  useDismiss(rootRef, open, close);

  const visible = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );
  const selectedLabels = options.filter((o) => value.includes(o.value)).map((o) => o.label);
  const summary =
    value.length === 0 ? placeholder : value.length <= 2 ? selectedLabels.join(", ") : selectedText(value.length);

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const focusOption = (index: number) => {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]");
    if (!items?.length) return;
    items[(index + items.length) % items.length].focus();
  };
  const onListKey = (e: KeyboardEvent) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? [])];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusOption(current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusOption(current - 1);
    } else if (e.key === "Escape") {
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <span id={`${id}-label`} className="mb-1.5 block font-display text-xs uppercase tracking-[0.15em] text-subtle">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-card px-3.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          open || value.length ? "border-accent/50" : "border-line hover:border-line-strong"
        }`}
      >
        <span id={`${id}-value`} className={`truncate ${value.length ? "text-fg" : "text-subtle"}`}>
          {summary}
        </span>
        <span className="flex items-center gap-2">
          {value.length > 0 && (
            <span className="rounded-full bg-accent px-1.5 text-[11px] font-medium tabular-nums text-bg">{value.length}</span>
          )}
          <LuChevronDown className={`size-4 text-subtle transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 min-w-[15rem] overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_18px_50px_-12px_var(--pop-shadow)]">
          {options.length > 6 && (
            <label className="flex items-center gap-2 border-b border-line px-3">
              <LuSearch className="size-4 text-subtle" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    focusOption(0);
                  }
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-10 w-full bg-transparent text-sm text-fg placeholder:text-faint outline-none"
              />
            </label>
          )}
          <ul
            ref={listRef}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={`${id}-label`}
            onKeyDown={onListKey}
            className="max-h-64 overflow-y-auto p-1.5"
          >
            {visible.length === 0 && <li className="px-3 py-2.5 text-sm text-subtle">{noOptionsText}</li>}
            {visible.map((o, i) => {
              const checked = value.includes(o.value);
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    autoFocus={options.length <= 6 && i === 0}
                    onClick={() => toggle(o.value)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:bg-tint/[0.06] focus-visible:outline-none ${
                      checked ? "text-fg" : "text-muted hover:text-fg"
                    } hover:bg-tint/[0.05]`}
                  >
                    <span
                      aria-hidden
                      className={`inline-flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked ? "border-accent bg-accent text-bg" : "border-line-strong"
                      }`}
                    >
                      {checked && <LuCheck className="size-3" strokeWidth={3} />}
                    </span>
                    {o.icon}
                    {/* Long labels (e.g. "Кроссплатформенное") wrap instead of being cut off. */}
                    <span className="min-w-0 leading-snug [overflow-wrap:anywhere]">{o.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {value.length > 0 && (
            <div className="border-t border-line p-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-accent transition-colors hover:bg-tint/[0.05]"
              >
                {clearText}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
