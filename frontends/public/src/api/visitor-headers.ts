import "server-only";

/**
 * Headers that tell the backend who the visitor is, so its per-visitor limits work (contact form, visit
 * statistics, AI assistant). Locally the backend trusts this server's X-Forwarded-For. On Vercel it can't
 * (Vercel overwrites that header), so the visitor's IP goes in X-Visitor-IP with the shared
 * INTERNAL_API_TOKEN.
 */
export function visitorHeaders(incoming: Pick<Headers, "get">): Record<string, string> {
  const forwarded = incoming.get("x-forwarded-for");
  const result: Record<string, string> = forwarded ? { "X-Forwarded-For": forwarded } : {};
  const visitor = forwarded?.split(",")[0].trim();
  const token = process.env.INTERNAL_API_TOKEN;
  if (token && visitor) Object.assign(result, { "X-Internal-Token": token, "X-Visitor-IP": visitor });
  return result;
}
