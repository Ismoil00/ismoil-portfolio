/**
 * Down arrow with a long shaft and short, wide head (shaft ≈ 3× the head's height),
 * drawn by hand because icon sets only ship the compact proportions.
 * Size it by height (e.g. `h-8 w-auto`); color follows `currentColor`.
 */
export function LongArrowDown({ className = "", strokeWidth = 2.25 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2v28" />
      <path d="M3.5 21.5 12 30l8.5-8.5" />
    </svg>
  );
}
