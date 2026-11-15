"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { LuCircleAlert, LuCircleCheck, LuX } from "react-icons/lu";

type Tone = "success" | "error";
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

/** Small notices in the bottom-right corner ("Saved", "Couldn't delete…"), gone after a few seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, tone: Tone = "success") => {
      const id = ++nextId.current;
      setItems((list) => [...list.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 3500);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex animate-pop-in items-start gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3 text-sm shadow-[0_20px_50px_-20px_var(--pop-shadow)]"
          >
            {item.tone === "success" ? (
              <LuCircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <LuCircleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            )}
            <p className="flex-1">{item.message}</p>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss" className="text-faint hover:text-fg">
              <LuX className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
