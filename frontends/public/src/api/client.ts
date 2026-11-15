import axios from "axios";

/**
 * The backend (FastAPI), called from the server only: API_URL is a server-side variable, so the
 * backend's address never reaches the browser. Example: API_URL=http://localhost:8000/api/v1
 */
export const apiClient = axios.create({
  baseURL: process.env.API_URL,
  timeout: 10_000,
  headers: { Accept: "application/json" },
});

/** GET from the backend; a failure throws, so the page shows the error screen instead of wrong content. */
export async function apiGet<T>(url: string, params?: Record<string, string> | URLSearchParams): Promise<T> {
  if (!process.env.API_URL) throw new Error("API_URL isn't set (frontends/public/.env.local)");
  const { data } = await apiClient.get<T>(url, { params });
  return data;
}
