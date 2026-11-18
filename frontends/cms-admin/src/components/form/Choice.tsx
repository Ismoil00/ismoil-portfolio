"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { LuBan, LuCheck } from "react-icons/lu";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * A checkbox with a label and an optional line of explanation.
 * `blockedReason`: why it can't be ticked right now. While disabled, hovering it turns the box into
 * a "not allowed" sign and shows the reason in a tooltip (screen readers get it as text).
 */
export function Checkbox({
  label,
  description,
  blockedReason,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode; blockedReason?: string }) {
  const blocked = Boolean(props.disabled && blockedReason);
  const dim = props.disabled ? "opacity-60" : "";
  const box = (
    <label className={`group flex items-start gap-3 ${props.disabled ? "cursor-not-allowed" : "cursor-pointer"} ${className}`}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          type="checkbox"
          {...props}
          className={`peer absolute inset-0 cursor-[inherit] appearance-none rounded-md border border-line-strong bg-tint/[0.03] transition-[opacity,border-color,background-color] checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            props.disabled ? "" : "group-hover:border-accent/60"
          } ${blocked ? "opacity-60 group-hover:opacity-0" : dim}`}
        />
        <LuCheck className="pointer-events-none relative size-3.5 text-bg opacity-0 transition-opacity peer-checked:opacity-100 light:text-white" strokeWidth={3} />
        {blocked && <LuBan aria-hidden className="pointer-events-none absolute size-5 text-danger opacity-0 transition-opacity group-hover:opacity-100" />}
      </span>
      <span className={dim}>
        <span className="text-sm text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-subtle">{description}</span>}
        {blocked && <span className="sr-only">{blockedReason}</span>}
      </span>
    </label>
  );
  return blocked ? <Tooltip label={blockedReason!}>{box}</Tooltip> : box;
}

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** A small colored dot (e.g. the job-search status color). */
  dot?: string;
  /** A short tag after the label ("Free", "Not set up"). */
  badge?: string;
  /** Shown but can't be picked (the description says why). */
  disabled?: boolean;
}

/** Big clickable choices in a row (one can be picked). */
export function RadioCards<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: RadioCardOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={`relative flex flex-col gap-1 rounded-xl border p-4 transition-[border-color,background-color,box-shadow] duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
              option.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${
              checked
                ? "border-accent/70 bg-accent/[0.06] shadow-[0_0_0_3px_rgb(var(--spot-rim)/0.12)]"
                : `border-line ${option.disabled ? "" : "hover:border-line-strong"}`
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="flex items-center gap-2 pr-6 text-sm font-medium">
              {option.dot && <span className="size-2.5 rounded-full" style={{ background: option.dot, boxShadow: `0 0 10px ${option.dot}` }} />}
              {option.label}
              {option.badge && (
                <span className="rounded-full border border-line px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-subtle">
                  {option.badge}
                </span>
              )}
            </span>
            {option.description && <span className="text-xs text-subtle">{option.description}</span>}
            {checked && <LuCheck className="absolute right-3 top-3 size-4 text-accent" />}
          </label>
        );
      })}
    </div>
  );
}
