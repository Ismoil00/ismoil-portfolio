import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { errorMessage, fieldErrors } from "@/api/errors";

/**
 * Puts a failed save's field errors on the form's fields (backend path → form path via `mapPath`)
 * and returns a sentence for the save bar — or null when every error found its field.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  mapPath: (path: string) => string = (path) => path,
): string | null {
  const found = Object.entries(fieldErrors(error));
  for (const [path, message] of found) {
    if (path !== "_form") setError(mapPath(path) as Path<T>, { type: "server", message });
  }
  const general = found.find(([path]) => path === "_form");
  if (general) return general[1];
  return found.length ? "Some fields need attention." : errorMessage(error, "Couldn't save. Try again.");
}
