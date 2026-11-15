import "server-only";

// Validation for list queries coming from the browser through Server Actions
// (actions are public endpoints, so nothing from the client is trusted).

const MAX_LIMIT = 30;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** offset/limit as safe integers (limit capped at 30). */
export function cleanPaging(query: { offset?: unknown; limit?: unknown } | undefined) {
  return {
    offset: Math.max(0, Math.floor(Number(query?.offset) || 0)),
    limit: Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(query?.limit) || 10))),
  };
}

/** A list of short strings, or undefined when empty/invalid. */
export function cleanList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 100).slice(0, 50);
  return list.length ? list : undefined;
}

/** A "YYYY-MM" month, or undefined. */
export function cleanMonth(value: unknown): string | undefined {
  return typeof value === "string" && MONTH.test(value) ? value : undefined;
}
