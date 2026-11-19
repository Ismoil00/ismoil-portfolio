"use server";

import { isAxiosError } from "axios";
import { headers } from "next/headers";
import type { ContactPayload } from "@/types/content";
import { apiClient } from "./client";
import { endpoints } from "./endpoints";

export type SendResult = "sent" | "invalid" | "rate-limited" | "error";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

/**
 * Headers that tell the backend who the visitor is, so its per-visitor limit works. Locally the
 * backend trusts this server's X-Forwarded-For. On Vercel it can't (Vercel overwrites that header),
 * so the visitor's IP goes in X-Visitor-IP with the shared INTERNAL_API_TOKEN.
 */
function visitorHeaders(incoming: Pick<Headers, "get">): Record<string, string> {
  const forwarded = incoming.get("x-forwarded-for");
  const result: Record<string, string> = forwarded ? { "X-Forwarded-For": forwarded } : {};
  const visitor = forwarded?.split(",")[0].trim();
  const token = process.env.INTERNAL_API_TOKEN;
  if (token && visitor) Object.assign(result, { "X-Internal-Token": token, "X-Visitor-IP": visitor });
  return result;
}

/** The contact form's Server Action: the browser never talks to the backend directly. */
export async function sendContactMessage(payload: ContactPayload): Promise<SendResult> {
  const body = {
    name: text(payload?.name, 500),
    contact: text(payload?.contact, 500),
    message: text(payload?.message, 10_000),
    website: text(payload?.website, 500),
  };
  try {
    await apiClient.post(endpoints.contact, body, { headers: visitorHeaders(await headers()) });
    return "sent";
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 422) return "invalid";
    if (isAxiosError(error) && error.response?.status === 429) return "rate-limited";
    return "error";
  }
}
