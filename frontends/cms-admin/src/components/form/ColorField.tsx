"use client";

import { LuX } from "react-icons/lu";
import { inputClass } from "./Field";

/** Hex color: a swatch that opens the system color picker, plus the code as text. */
export function ColorField({
  id,
  value,
  onChange,
  optional,
  invalid,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  optional?: boolean;
  invalid?: boolean;
}) {
  const valid = value && /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-line-strong" title="Pick a color">
        <span className="absolute inset-0" style={{ background: valid ? value : "transparent" }} />
        {!valid && <span className="absolute inset-0 bg-[linear-gradient(135deg,transparent_45%,var(--color-danger)_45%_55%,transparent_55%)] opacity-60" />}
        <input
          type="color"
          value={valid ? value : "#a4c4ff"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pick a color"
        />
      </label>
      <input
        id={id}
        value={value ?? ""}
        onChange={(e) => {
          const text = e.target.value.trim();
          onChange(text ? (text.startsWith("#") ? text : `#${text}`).toUpperCase().slice(0, 7) : null);
        }}
        placeholder={optional ? "Site accent" : "#3776AB"}
        aria-invalid={invalid || undefined}
        className={`${inputClass} w-36 font-mono uppercase`}
        maxLength={7}
        spellCheck={false}
      />
      {optional && value && (
        <button type="button" onClick={() => onChange(null)} aria-label="Use the site's accent color" title="Use the site's accent color" className="grid size-8 place-items-center rounded-lg text-faint hover:text-fg">
          <LuX className="size-4" />
        </button>
      )}
    </div>
  );
}
