"use server";

import { isAxiosError } from "axios";
import { headers } from "next/headers";
import type { ContactPayload } from "@/types/content";
import { apiClient } from "./client";
import { endpoints } from "./endpoints";

export type SendResult = "sent" | "invalid" | "rate-limited" | "error";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

/**
 * The contact form's Server Action: the browser never talks to the backend directly. The visitor's
 * address is passed on (X-Forwarded-For) so the backend's per-visitor limit works.
 */
export async function sendContactMessage(payload: ContactPayload): Promise<SendResult> {
  const body = {
    name: text(payload?.name, 500),
    contact: text(payload?.contact, 500),
    message: text(payload?.message, 10_000),
    website: text(payload?.website, 500),
  };
  const forwarded = (await headers()).get("x-forwarded-for");
  try {
    await apiClient.post(endpoints.contact, body, { headers: forwarded ? { "X-Forwarded-For": forwarded } : {} });
    return "sent";
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 422) return "invalid";
    if (isAxiosError(error) && error.response?.status === 429) return "rate-limited";
    return "error";
  }
}
