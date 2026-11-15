// The admin API, used only to prepare or clean up data around a test (e.g. "add 11 projects" before
// checking "Show more"). What a test checks is always done through the pages, like a real visitor.

import { readFileSync } from "node:fs";
import { request, type APIRequestContext } from "@playwright/test";
import { ADMIN_STATE, ADMIN_URL } from "./env";

type StoredCookie = { name: string; value: string };

/** An API client signed in as the E2E admin (same session as the browser tests, CSRF header set). */
export async function adminApi(): Promise<AdminApi> {
  const state = JSON.parse(readFileSync(ADMIN_STATE, "utf-8")) as { cookies: StoredCookie[] };
  const csrf = state.cookies.find((c) => c.name === "csrf" || c.name === "__Host-csrf")?.value ?? "";
  const context = await request.newContext({
    baseURL: `${ADMIN_URL}/api/v1/admin/`,
    storageState: ADMIN_STATE,
    extraHTTPHeaders: { Origin: ADMIN_URL, "X-CSRF-Token": csrf },
  });
  return new AdminApi(context);
}

export const i18n = (text: string) => ({ en: text, ru: `${text} (ru)`, tg: `${text} (tg)` });

export class AdminApi {
  constructor(private readonly context: APIRequestContext) {}

  async get<T>(path: string): Promise<T> {
    const response = await this.context.get(path);
    if (!response.ok()) throw new Error(`GET ${path} → ${response.status()} ${await response.text()}`);
    return (await response.json()) as T;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.context.post(path, { data: body });
    if (!response.ok()) throw new Error(`POST ${path} → ${response.status()} ${await response.text()}`);
    return (await response.json()) as T;
  }

  async delete(path: string): Promise<void> {
    const response = await this.context.delete(path);
    if (!response.ok()) throw new Error(`DELETE ${path} → ${response.status()} ${await response.text()}`);
  }

  /** The first item of a selector list whose English name matches. */
  async selector(kind: string, englishName: string): Promise<{ id: string }> {
    const items = await this.get<{ id: string; name: { en: string } | string }[]>(`selectors/${kind}`);
    const found = items.find((item) => (typeof item.name === "string" ? item.name : item.name.en) === englishName);
    if (!found) throw new Error(`No ${kind} named ${englishName}`);
    return found;
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}