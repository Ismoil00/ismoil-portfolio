// Typing and picking dates: "YYYY-MM" months and "YYYY-MM-DD" days.
// The same file is in both apps (cms-admin and public), so every date field behaves the same.

export type DateMode = "month" | "day";

const ENGLISH_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export const pad = (n: number) => String(n).padStart(2, "0");

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function splitDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day: day || 1 };
}

export const monthKey = (year: number, month: number) => `${year}-${pad(month)}`;
export const dayKey = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

/** "2024-03" → "Mar 2024"; "2024-03-15" → "15 Mar 2024" (what the field shows). */
export function displayDate(value: string, mode: DateMode, monthNames: string[]) {
  const { year, month, day } = splitDate(value);
  const name = monthNames[month - 1] ?? pad(month);
  return mode === "day" ? `${day} ${name} ${year}` : `${name} ${year}`;
}

/** The typing format shown as a hint: "MM.YYYY" or "DD.MM.YYYY". */
export const typedFormat = (mode: DateMode) => (mode === "day" ? "DD.MM.YYYY" : "MM.YYYY");

/** A month word ("mar", "March", "мар.", "март") → 1–12, or 0. At least 3 letters must match. */
function monthFromWord(word: string, monthNames: string[]) {
  const w = word.replace(/\.$/, "");
  if (w.length < 3) return 0;
  const names = [...monthNames.map((n) => n.toLowerCase().replace(/\.$/, "")), ...ENGLISH_MONTHS];
  const index = names.findIndex((name) => name.length >= 3 && (name.startsWith(w) || w.startsWith(name)));
  return index < 0 ? 0 : (index % 12) + 1;
}

const realYear = (y: number) => y >= 1900 && y <= 2100;

/**
 * What was typed → "YYYY-MM" (month mode) or "YYYY-MM-DD" (day mode), or null when it isn't a
 * real date. Accepted, in any language's month names:
 *   months: 03.2024 · 3/2024 · 03-2024 · 2024-03 · 032024 · Mar 2024 · март 2024
 *   days:   15.03.2024 · 15/3/2024 · 2024-03-15 · 15032024 · 15 Mar 2024 · Mar 15 2024
 */
export function parseTyped(text: string, mode: DateMode, monthNames: string[] = []): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  // Digits only: MMYYYY / DDMMYYYY.
  if (/^\d+$/.test(t)) {
    if (mode === "month" && t.length === 6) return build(mode, +t.slice(2), +t.slice(0, 2));
    if (mode === "day" && t.length === 8) return build(mode, +t.slice(4), +t.slice(2, 4), +t.slice(0, 2));
    return null;
  }

  const parts = t.split(/[\s./,-]+/).filter(Boolean);
  const numbers = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  const word = parts.findIndex((p) => !/^\d+$/.test(p));
  const named = word >= 0 ? monthFromWord(parts[word], monthNames) : 0;
  if (word >= 0 && (!named || parts.filter((p) => !/^\d+$/.test(p)).length > 1)) return null;
  const rest = numbers.filter((n, i) => i !== word);
  const yearFirst = parts[0].length === 4;

  if (mode === "month") {
    if (parts.length !== 2) return null;
    if (named) return build(mode, rest[0], named);
    return yearFirst ? build(mode, numbers[0], numbers[1]) : build(mode, numbers[1], numbers[0]);
  }

  if (parts.length !== 3) return null;
  if (named) {
    // "15 Mar 2024", "Mar 15 2024", "2024 Mar 15"
    const year = rest.find((n) => String(n).length === 4);
    const day = rest.find((n) => n !== year);
    return year === undefined || day === undefined ? null : build(mode, year, named, day);
  }
  return yearFirst ? build(mode, numbers[0], numbers[1], numbers[2]) : build(mode, numbers[2], numbers[1], numbers[0]);
}

function build(mode: DateMode, year: number, month: number, day = 1): string | null {
  if (!Number.isInteger(year) || !realYear(year) || !(month >= 1 && month <= 12)) return null;
  if (mode === "month") return monthKey(year, month);
  if (!(day >= 1 && day <= daysInMonth(year, month))) return null;
  return dayKey(year, month, day);
}

/** Whether a value (same mode as min/max) lies in [min, max]; both bounds are optional. */
export function inRange(value: string, min?: string | null, max?: string | null) {
  return !(min && value < min) && !(max && value > max);
}
