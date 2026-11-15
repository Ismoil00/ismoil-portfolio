"use client";

import { useEffect } from "react";
import { LuRotateCcw, LuSave } from "react-icons/lu";
import { Button } from "@/components/ui/Button";

/**
 * Sticky bar at the bottom of a page form: shows unsaved changes, Save and Discard.
 * While there are unsaved changes, closing or reloading the tab asks for confirmation.
 */
export function SaveBar({
  dirty,
  saving,
  onDiscard,
  error,
  label = "Save changes",
}: {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  error?: string | null;
  label?: string;
}) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div className="sticky bottom-4 z-20 mt-8">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md transition-[border-color,background-color,box-shadow] duration-300 sm:px-5 ${
          dirty || error
            ? "border-accent/40 bg-surface/90 shadow-[0_20px_60px_-25px_var(--pop-shadow)]"
            : "border-line bg-bg/60"
        }`}
      >
        <p className={`text-sm ${error ? "text-danger" : dirty ? "text-fg" : "text-subtle"}`} role={error ? "alert" : undefined}>
          {error ?? (dirty ? "You have unsaved changes." : "Everything is saved.")}
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="ghost" size="sm" icon={<LuRotateCcw className="size-3.5" />} onClick={onDiscard} disabled={saving}>
              Discard
            </Button>
          )}
          <Button type="submit" size="sm" loading={saving} disabled={!dirty} icon={<LuSave className="size-3.5" />}>
            {label}
          </Button>
        </div>
      </div>
    </div>
  );
}
