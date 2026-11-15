import { isAxiosError } from "axios";

interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
}

/**
 * Field errors from a 422 response, keyed by form path ("title.ru", "tech_ids.2").
 * Both schema checks and business rules come back in this shape (see backend core/errors.py).
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isAxiosError(error) || error.response?.status !== 422) return {};
  const detail = error.response.data?.detail;
  if (!Array.isArray(detail)) return {};
  const result: Record<string, string> = {};
  for (const issue of detail as ValidationIssue[]) {
    const path = issue.loc.filter((part, i) => !(i === 0 && part === "body")).join(".");
    result[path || "_form"] ??= issue.msg.replace(/^Value error, /, "");
  }
  return result;
}

/** One human-readable sentence for a failed request. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (!isAxiosError(error)) return fallback;
  if (!error.response) return "Can't reach the server. Check that the backend is running.";
  const { status, data } = error.response;
  if (typeof data?.detail === "string") return data.detail;
  if (status === 422) return "Some fields need attention.";
  if (status === 413) return "The file is too large.";
  if (status === 429) return "Too many attempts. Wait a little and try again.";
  return fallback;
}
