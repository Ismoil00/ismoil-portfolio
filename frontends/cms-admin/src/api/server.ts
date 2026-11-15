import "server-only";
import axios, { isAxiosError } from "axios";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

/**
 * Server-side API client for server components: calls the backend directly and passes the
 * visitor's cookies along, so the backend sees the admin's session.
 */
const backend = axios.create({ baseURL: `${process.env.API_URL ?? "http://localhost:8000"}/api/v1`, timeout: 15_000 });

export async function serverGet<T>(url: string, params?: Record<string, string>): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  try {
    const { data } = await backend.get<T>(url, { params, headers: { cookie: cookieHeader } });
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) redirect("/login");
    // 422 = a malformed id in the URL: the same "not found" for the visitor.
    if (isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 422)) notFound();
    throw error;
  }
}
