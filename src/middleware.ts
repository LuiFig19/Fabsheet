import { NextRequest, NextResponse } from "next/server";

// Paths that never require an authenticated session.
const PUBLIC = ["/login", "/api/auth", "/api/health", "/api/diagnose", "/api/test-send", "/api/test-magic-link", "/api/whoami", "/api/clear-verifications", "/api/cron"];

// Middleware after basePath has been stripped. In single_tenant mode the
// access prefix is enforced by basePath (Next 404s bare paths), so here we:
//   1. Stamp x-tenant-slug header so getTenantContext() resolves cleanly.
//   2. Gate every non-public route on a BetterAuth session cookie.
// We do NOT do the DB lookup in middleware (Edge runtime, no Prisma). Cookie
// presence is enough for the redirect decision; the page+action layer does the
// real auth check via auth.api.getSession().
// Possible BetterAuth session-cookie names. We pinned the prefix to "fabsheet"
// in lib/auth.ts, but keep the legacy "better-auth" variant so sessions from
// older builds keep working through a redeploy.
const SESSION_COOKIE_NAMES = [
  "fabsheet.session_token",
  "__Secure-fabsheet.session_token",
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

export function middleware(req: NextRequest) {
  const mode = process.env.APP_MODE === "multi_tenant" ? "multi_tenant" : "single_tenant";
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const headers = new Headers(req.headers);
  if (mode === "single_tenant") headers.set("x-tenant-slug", process.env.DEFAULT_TENANT_SLUG || "ravens");

  // Kill switch: set AUTH_DISABLED=true in Vercel to bypass the session check
  // entirely. BetterAuth, routes, and code stay in place — just no redirect.
  // Remove the env var (or set false) to re-enable auth.
  const authDisabled = process.env.AUTH_DISABLED === "true";
  if (authDisabled) return NextResponse.next({ request: { headers } });

  if (isPublic) return NextResponse.next({ request: { headers } });

  const hasSession = SESSION_COOKIE_NAMES.some((n) => req.cookies.get(n)?.value);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|manifest.json|icon-.*|robots.txt|.*\\..*).*)"],
};
