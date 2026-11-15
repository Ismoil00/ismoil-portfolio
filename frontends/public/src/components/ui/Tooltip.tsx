import type { ReactNode } from "react";

/**
 * Small text bubble above (or to the right of) an element, shown on hover and on keyboard focus
 * (CSS only, so it works in server components). The element itself should carry the same text
 * as aria-label — the bubble is visual only.
 * `align` (above only) decides which edge the bubble lines up with, so it never sticks out of a
 * card. `side="right"` is for elements at the screen's left edge, like the side rail.
 */
export function Tooltip({
  label,
  children,
  align = "start",
  side = "top",
  className = "",
}: {
  label: string;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right";
  className?: string;
}) {
  const position =
    side === "right"
      ? "left-full top-1/2 ml-2 -translate-x-1 -translate-y-1/2 group-hover/tip:translate-x-0 group-has-[:focus-visible]/tip:translate-x-0"
      : `bottom-full mb-2 translate-y-1 group-hover/tip:translate-y-0 group-has-[:focus-visible]/tip:translate-y-0 ${
          align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"
        }`;
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        aria-hidden
        className={`pointer-events-none absolute z-30 w-max max-w-64 whitespace-pre-line rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs leading-snug text-fg opacity-0 shadow-[0_10px_30px_-10px_var(--pop-shadow)] transition-[opacity,translate] duration-150 group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:opacity-100 ${position}`}
      >
        {label}
      </span>
    </span>
  );
}
