"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LuChevronDown, LuLoaderCircle, LuRotateCcw, LuSearchX } from "react-icons/lu";

/** "Showing 10 of 23" + "Clear filters". */
export function ResultBar({
  filtering,
  shown,
  total,
  canClear,
  onClear,
}: {
  filtering: boolean;
  shown: number;
  total: number;
  canClear: boolean;
  onClear: () => void;
}) {
  const t = useTranslations("listing");
  return (
    <div className="mb-8 mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p aria-live="polite" className="text-subtle">
        {filtering ? t("loading") : t("showing", { shown, total })}
      </p>
      {canClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-accent transition-[color,scale] duration-200 hover:text-accent-soft active:scale-95"
        >
          <LuRotateCcw className="size-3.5" aria-hidden />
          {t("clearAll")}
        </button>
      )}
    </div>
  );
}

/** Shown when the filters match nothing. */
export function EmptyResults({ text, onClear }: { text: string; onClear: () => void }) {
  const t = useTranslations("listing");
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line py-16 text-center">
      <LuSearchX className="size-8 text-subtle" aria-hidden />
      <p className="text-muted">{text}</p>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full border border-accent/40 px-5 py-2 font-display text-sm text-accent transition-[color,background-color,border-color,scale] duration-200 hover:border-accent hover:bg-accent/10 active:scale-95"
      >
        {t("clearAll")}
      </button>
    </div>
  );
}

export function ListError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-6 text-center text-sm text-red-400 light:text-red-600">
      {children}
    </p>
  );
}

/** "Show 10 more" — appends the next page. */
export function LoadMoreButton({ count, loading, onClick }: { count: number; loading: boolean; onClick: () => void }) {
  const t = useTranslations("listing");
  return (
    <div className="mt-10 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="group inline-flex items-center gap-2 rounded-full border border-accent/40 px-6 py-3 font-display text-accent transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-[0_8px_24px_-8px_rgb(66_135_255/0.6)] active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-60"
      >
        {loading ? (
          <>
            <LuLoaderCircle className="size-4 animate-spin" aria-hidden />
            {t("loading")}
          </>
        ) : (
          <>
            {t("loadMore", { count })}
            <LuChevronDown className="size-4 transition-transform group-hover:translate-y-0.5" aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}
