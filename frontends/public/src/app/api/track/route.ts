import { headers } from "next/headers";
import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { visitorHeaders } from "@/api/visitor-headers";

/**
 * Visit statistics: the browser reports a page view or résumé download here (its own site), and this
 * server passes it to the backend with what only the server knows: the visitor's country (from Vercel)
 * and browser name (for leaving out bots). The visitor's IP is used by the backend only to stop
 * flooding and is never stored. The browser gets no answer worth reading.
 */
export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  if (!process.env.API_URL || typeof body !== "object" || body === null) return new Response(null, { status: 204 });

  const incoming = await headers();
  const event = {
    kind: body.kind,
    path: body.path,
    locale: body.locale,
    device: body.device,
    referrer: typeof body.referrer === "string" && body.referrer ? body.referrer : null,
    visitor_id: typeof body.visitorId === "string" ? body.visitorId : null,
    country: incoming.get("x-vercel-ip-country") || null,
    user_agent: (incoming.get("user-agent") ?? "").slice(0, 1000),
  };
  try {
    await apiClient.post(endpoints.events, event, { headers: visitorHeaders(incoming) });
  } catch {
    // Statistics must never break the site: a failed report is simply lost.
  }
  return new Response(null, { status: 204 });
}
