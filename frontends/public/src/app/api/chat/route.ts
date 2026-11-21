import { cookies, headers } from "next/headers";
import { checkBotId } from "botid/server";
import { endpoints } from "@/api/endpoints";
import { visitorHeaders } from "@/api/visitor-headers";
import { CHAT_COOKIE, CONSENT_COOKIE, parseConsent } from "@/lib/consent";

/**
 * The AI assistant: the chat panel sends each question here (its own site), and this server passes it to
 * the backend with what only the server knows: the visitor's IP (for the limits), the `chat` cookie (a
 * random id, the limits' other key) and whether analytics cookies are allowed (only then is the question
 * kept, masked, for the admin's "Top questions"). The backend's answer streams straight through.
 */

const DAY = 60 * 60 * 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LOCALES = new Set(["en", "ru", "tg"]);

const refuse = (code: string, status: number) =>
  Response.json({ code }, { status, headers: { "Cache-Control": "no-store" } });

/** Only what the backend accepts, cut to size: nothing from the browser is trusted as is. */
function cleanBody(body: unknown) {
  if (typeof body !== "object" || body === null) return null;
  const { messages, locale, page } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || typeof locale !== "string" || !LOCALES.has(locale)) return null;
  return {
    messages: messages.slice(-60).map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: typeof m?.content === "string" ? m.content.slice(0, 4000) : "",
    })),
    locale,
    page: typeof page === "string" && page.startsWith("/") ? page.slice(0, 300) : null,
  };
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.API_URL) return refuse("chat_off", 503);
  if (process.env.NEXT_PUBLIC_BOTID === "1") {
    const verdict = await checkBotId({ advancedOptions: { checkLevel: "basic" } });
    if (verdict.isBot) return refuse("chat_bot", 403);
  }

  let body: ReturnType<typeof cleanBody>;
  try {
    body = cleanBody(await request.json());
  } catch {
    body = null;
  }
  if (!body) return refuse("invalid", 422);

  const jar = await cookies();
  const saved = jar.get(CHAT_COOKIE)?.value;
  const session = saved && UUID.test(saved) ? saved : crypto.randomUUID();
  const consent = parseConsent(jar.get(CONSENT_COOKIE)?.value);

  let upstream: Response;
  try {
    upstream = await fetch(`${process.env.API_URL}${endpoints.chat}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...visitorHeaders(await headers()) },
      body: JSON.stringify({ ...body, session_id: session, save_question: consent?.analytics ?? false }),
      signal: request.signal, // "Stop" in the panel stops the answer at the backend too
      cache: "no-store",
    });
  } catch {
    return refuse("chat_failed", 502);
  }

  jar.set(CHAT_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    maxAge: DAY,
    path: "/",
  });
  const retry = upstream.headers.get("retry-after");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
      ...(retry ? { "Retry-After": retry } : {}),
    },
  });
}
