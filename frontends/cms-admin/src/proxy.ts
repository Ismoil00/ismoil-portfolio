import { NextResponse, type NextRequest } from "next/server";

/** Cookie names the backend uses (with the __Host- prefix when served over https). */
const SESSION_COOKIES = ["__Host-session", "session"];

/**
 * No session cookie → straight to the login page. This is only the fast path: whether the session
 * is still valid is decided by the backend (the panel layout asks it on every page).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Not for the forwarded API and files (big uploads must not be buffered here), nor static assets.
  matcher: ["/((?!api/|media/|_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};
