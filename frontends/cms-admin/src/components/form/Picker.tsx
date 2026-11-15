"use client";

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { LuCheck, LuChevronDown, LuSearch, LuX } from "react-icons/lu";
import { useDismiss } from "@/components/ui/useDismiss";
import { inputClass } from "./Field";

export interface PickerOption {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Small grey text after the label (e.g. "used by 3 projects"). */
  note?: string;
  /** Pinned to the top with a divider under them (e.g. "Self-initiated project"). */
  special?: boolean;
}

interface Common {
  id?: string;
  options: PickerOption[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Shown when the list is empty — usually a hint to add items on the Selectors page. */
  emptyText?: ReactNode;
}

type Props = Common &
  ({ multiple?: false; value: string | null; onChange: (value: string | null) => void; clearable?: boolean } | {
    multiple: true;
    value: string[];
    onChange: (value: string[]) => void;
    clearable?: never;
  });

/**
 * Dropdown with search for picking one item (or several with `multiple`) from a selector list.
 * Keyboard: ↓/↑ move, Enter picks, Esc closes; typing filters.
 */
export function Picker(props: Props) {
  const { options, placeholder = "Choose…", invalid, disabled, emptyText = "Nothing to choose from yet." } = props;
  const autoId = useId();
  const id = props.id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  useDismiss(rootRef, open, close);

  const selected = props.multiple ? props.value : props.value ? [props.value] : [];
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !q || o.label.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(value: string) {
    if (props.multiple) {
      props.onChange(props.value.includes(value) ? props.value.filter((v) => v !== value) : [...props.value, value]);
    } else {
      props.onChange(value);
      close();
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && visible[active]) {
      event.preventDefault();
      toggle(visible[active].value);
    }
  }

  const single = !props.multiple ? options.find((o) => o.value === props.value) : undefined;
  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const summary = props.multiple
    ? selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels[0]} +${selected.length - 1} more`
    : single?.label ?? placeholder;

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-invalid={invalid || undefined}
        onClick={() => {
          setOpen((v) => !v);
          setActive(0);
          requestAnimationFrame(() => searchRef.current?.focus());
        }}
        className={`${inputClass} flex items-center gap-2 text-left ${open ? "border-accent/70" : ""}`}
      >
        {single?.icon}
        <span className={`min-w-0 flex-1 truncate ${selected.length ? "text-fg" : "text-faint"}`}>{summary}</span>
        <LuChevronDown className={`size-4 shrink-0 text-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {!props.multiple && props.clearable && props.value && !disabled && (
        <button
          type="button"
          onClick={() => props.onChange(null)}
          aria-label="Clear"
          className="absolute right-9 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-faint hover:text-fg"
        >
          <LuX className="size-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 animate-pop-in overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_18px_50px_-12px_var(--pop-shadow)]">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <LuSearch className="size-4 text-faint" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-faint"
            />
          </div>
          <ul role="listbox" aria-multiselectable={props.multiple || undefined} className="max-h-64 overflow-y-auto p-1.5">
            {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-subtle">{options.length ? "No matches." : emptyText}</li>}
            {visible.map((option, index) => {
              const isSelected = selected.includes(option.value);
              const lastSpecial = option.special && !visible[index + 1]?.special;
              return (
                <li key={option.value} className={lastSpecial ? "mb-1.5 border-b border-line pb-1.5" : ""}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => toggle(option.value)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      index === active ? "bg-tint/[0.06]" : ""
                    } ${isSelected ? "text-accent" : "text-fg"}`}
                  >
                    {props.multiple && (
                      <span
                        className={`grid size-4 shrink-0 place-items-center rounded border ${
                          isSelected ? "border-accent bg-accent text-bg light:text-white" : "border-line-strong"
                        }`}
                      >
                        {isSelected && <LuCheck className="size-3" strokeWidth={3} />}
                      </span>
                    )}
                    {option.icon}
                    <span className={`min-w-0 flex-1 truncate ${option.special ? "italic" : ""}`}>{option.label}</span>
                    {option.note && <span className="shrink-0 text-xs text-faint">{option.note}</span>}
                    {!props.multiple && isSelected && <LuCheck className="size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
