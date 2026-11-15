// Helpers for "YYYY-MM" month strings (experience, project and certificate dates).

/** "YYYY-MM" for the current month — an open-ended job runs until now. */
export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

/** "2025-08" + localized short month names -> "Aug 2025". */
export function formatMonth(value: string, monthNames: string[]) {
  const { year, month } = parseMonth(value);
  return `${monthNames[month - 1] ?? month} ${year}`;
}

/** "2016-09" -> "09.2016" (month.year, used on certificates). */
export function formatMonthNumeric(value: string) {
  const { year, month } = parseMonth(value);
  return `${String(month).padStart(2, "0")}.${year}`;
}

/** Whole months from start to end, counting both ends (Aug–Jun = 11 months). */
export function monthsBetween(start: string, end: string) {
  const a = parseMonth(start);
  const b = parseMonth(end);
  return Math.max(1, (b.year - a.year) * 12 + (b.month - a.month) + 1);
}

/**
 * Total months covered by several jobs. Overlapping months (two jobs at once, or a job that
 * starts in the month the previous one ended) are counted once. `end: null` means "until now".
 */
export function totalMonths(ranges: { start: string; end: string | null }[]) {
  const index = (value: string) => {
    const { year, month } = parseMonth(value);
    return year * 12 + month - 1;
  };
  const spans = ranges
    .map((r) => [index(r.start), index(r.end ?? currentMonth())] as const)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let current: [number, number] | null = null;
  for (const [s, e] of spans) {
    if (current && s <= current[1]) {
      current[1] = Math.max(current[1], e); // overlaps the running span: extend it
    } else {
      if (current) total += current[1] - current[0] + 1;
      current = [s, e];
    }
  }
  if (current) total += current[1] - current[0] + 1;
  return total;
}

/** 41 -> "3 yrs 5 mos", using the localized `experience.years` / `experience.monthsCount` messages. */
export function formatDuration(
  months: number,
  t: (key: "years" | "monthsCount", values: { count: number }) => string,
) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? t("years", { count: years }) : "", rest ? t("monthsCount", { count: rest }) : ""]
    .filter(Boolean)
    .join(" ");
}
