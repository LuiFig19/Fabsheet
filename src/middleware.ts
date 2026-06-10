import { NextRequest, NextResponse } from "next/server";

// Paths that never require an authenticated session.
const PUBLIC = ["/", "/login", "/magic-login", "/api/auth", "/api/health", "/api/diagnose", "/api/test-send", "/api/test-magic-link", "/api/whoami", "/api/clear-verifications", "/api/cron", "/api/maintenance/tenancy-schema"];

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

const TENANT_PREFIX = "/c";

function tenantSlugFromHost(host: string): string | null {
  const map = process.env.TENANT_HOST_MAP ?? "";
  for (const pair of map.split(/[\s,;]+/).filter(Boolean)) {
    const [hostname, slug] = pair.split("=");
    if (hostname?.toLowerCase() === host.toLowerCase() && slug) return slug;
  }
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const prefixed = pathname.startsWith(`${TENANT_PREFIX}/`);
  const [, , pathTenantSlug, ...rest] = pathname.split("/");
  const strippedPathname = prefixed ? `/${rest.join("/")}` || "/" : pathname;
  const isPublic = PUBLIC.some((p) => strippedPathname === p || (p !== "/" && strippedPathname.startsWith(p + "/")));

  const headers = new Headers(req.headers);
  const hostTenantSlug = tenantSlugFromHost(req.headers.get("host")?.split(":")[0] ?? "");
  const tenantSlug = pathTenantSlug || hostTenantSlug || process.env.DEFAULT_TENANT_SLUG || "ravens";
  headers.set("x-tenant-slug", tenantSlug);

  // Kill switch: set AUTH_DISABLED=true in Vercel to bypass the session check
  // entirely. BetterAuth, routes, and code stay in place — just no redirect.
  // Remove the env var (or set false) to re-enable auth.
  const authDisabled = process.env.AUTH_DISABLED === "true";
  if (authDisabled) return route(req, headers, strippedPathname, prefixed);

  if (isPublic) return route(req, headers, strippedPathname, prefixed);

  const hasSession = SESSION_COOKIE_NAMES.some((n) => req.cookies.get(n)?.value);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = prefixed ? `${TENANT_PREFIX}/${tenantSlug}/login` : "/login";
    url.searchParams.set("next", prefixed ? `${TENANT_PREFIX}/${tenantSlug}${strippedPathname}${req.nextUrl.search}` : strippedPathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return route(req, headers, strippedPathname, prefixed);
}

function route(req: NextRequest, headers: Headers, strippedPathname: string, prefixed: boolean) {
  if (!prefixed) return NextResponse.next({ request: { headers } });
  const url = req.nextUrl.clone();
  url.pathname = strippedPathname;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|manifest.json|icon-.*|robots.txt|.*\\..*).*)"],
};
