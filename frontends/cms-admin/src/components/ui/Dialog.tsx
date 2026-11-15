"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LuX } from "react-icons/lu";
import { lockScroll } from "@/lib/scroll-lock";

/**
 * Modal window (native <dialog>: focus is trapped, Esc closes, the page behind is inert).
 * Rendered only while open, so its form state starts fresh every time.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    dialog.showModal();
    // showModal() focuses the first focusable element (the Close button); start in a field instead:
    // one marked data-autofocus, else the first visible input.
    const field =
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog.querySelector<HTMLElement>("input:not([type=hidden]):not([type=file]):not([hidden]), textarea");
    field?.focus();
    const unlock = lockScroll();
    return () => {
      unlock();
      if (dialog.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Esc closes only this window: React would otherwise pass the event on to a parent dialog.
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className={`m-auto w-[calc(100%-2rem)] ${width} animate-pop-in rounded-2xl border border-line-strong bg-surface p-0 text-fg shadow-[0_40px_120px_-30px_var(--pop-shadow)] backdrop:bg-bg/70 backdrop:backdrop-blur-sm`}
    >
      <div className="flex max-h-[min(90svh,56rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 id="dialog-title" className="font-display text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-subtle">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-tint/5 hover:text-fg"
          >
            <LuX className="size-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </dialog>
  );
}
