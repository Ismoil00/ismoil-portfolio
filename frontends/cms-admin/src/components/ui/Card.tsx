import type { ReactNode } from "react";

/** A section of a page: bordered glass card with an optional title, hint and actions. */
export function Card({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    // No backdrop-blur here: it would create a stacking context and trap dropdowns under the next card.
    <section className={`rounded-2xl border border-line bg-card p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
            {description && <p className="mt-1 text-sm text-subtle">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
