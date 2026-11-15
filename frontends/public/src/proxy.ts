import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed `middleware.ts` to `proxy.ts`.
// Redirects "/" to "/en" (or the visitor's browser language) and keeps the locale in the URL.
export default createMiddleware(routing);

export const config = {
  // Skip API, Next internals, static files, the CV, and the generated icons.
  matcher: "/((?!api|_next|_vercel|cv|icon|apple-icon|.*\\..*).*)",
};
