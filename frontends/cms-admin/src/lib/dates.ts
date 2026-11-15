const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024-03" → "Mar 2024" */
export function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/** "Mar 2024 — Present" */
export function formatPeriod(start: string, end: string | null) {
  return `${formatMonth(start)} — ${end ? formatMonth(end) : "Present"}`;
}

/** Whole months from start to end, both included (the public site counts the same way). */
export function monthsBetween(start: string, end: string | null) {
  const now = new Date();
  const [y1, m1] = start.split("-").map(Number);
  const [y2, m2] = end ? end.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
}

/** 41 → "3 yrs 5 mos" */
export function formatDuration(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} yr${years > 1 ? "s" : ""}` : "", rest ? `${rest} mo${rest > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ");
}

/** 1 → "1 technology", 3 → "3 technologies" */
export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
