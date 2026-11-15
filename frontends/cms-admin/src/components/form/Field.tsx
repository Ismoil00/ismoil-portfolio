import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/** Shared look of text inputs, textareas and select buttons. */
export const inputClass =
  "w-full rounded-xl border border-line bg-tint/[0.03] px-3.5 py-2.5 text-sm text-fg placeholder:text-faint transition-[border-color,background-color,box-shadow] duration-200 hover:border-line-strong focus:border-accent/70 focus:bg-tint/[0.05] focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger/70 data-[invalid=true]:border-danger/70";

/** Label + control + hint/error, with an optional character counter. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  counter,
  children,
  className = "",
}: {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  counter?: { value: number; max: number };
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1 text-sm font-medium text-muted">
          {label}
          {required ? <span className="text-accent" aria-hidden>*</span> : <span className="text-xs text-faint">(optional)</span>}
        </label>
      )}
      {children}
      {(error || hint || counter) && (
        <div className="mt-1.5 flex items-start justify-between gap-3 text-xs">
          {error ? (
            <p role="alert" className="text-danger">
              {error}
            </p>
          ) : (
            <p className="text-faint">{hint}</p>
          )}
          {counter && (
            <span className={`shrink-0 tabular-nums ${counter.value > counter.max ? "text-danger" : "text-faint"}`}>
              {counter.value} / {counter.max}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function TextInput({ invalid, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={`${inputClass} ${className}`} />;
}

export function TextArea({
  invalid,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea {...props} aria-invalid={invalid || undefined} className={`${inputClass} min-h-28 resize-y leading-relaxed ${className}`} />
  );
}
