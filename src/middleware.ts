import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/session";

// NOTE: paths here are AFTER Next strips basePath (the single_tenant access
// prefix). So in single_tenant mode the prefix is already enforced by basePath
// (bare paths 404); middleware just stamps the tenant header. In multi_tenant
// mode there is no basePath; the first path segment is the tenant slug and we
// gate on a session cookie.

const PUBLIC_PATHS = ["/login", "/auth", "/api/auth"];

export async function middleware(req: NextRequest) {
  const mode = process.env.APP_MODE === "multi_tenant" ? "multi_tenant" : "single_tenant";
  const { pathname } = req.nextUrl;

  if (mode === "single_tenant") {
    const slug = process.env.DEFAULT_TENANT_SLUG || "ravens";
    const headers = new Headers(req.headers);
    headers.set("x-tenant-slug", slug);
    return NextResponse.next({ request: { headers } });
  }

  // multi_tenant
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const session = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // URL shape: /<tenantSlug>/<rest...>. Strip the slug and stamp headers so the
  // physical routes (/dashboard, /upload, ...) match. Enforce slug == session.
  const segments = pathname.split("/").filter(Boolean);
  const urlSlug = segments[0];
  if (!urlSlug || urlSlug !== session.tenantSlug) {
    const url = req.nextUrl.clone();
    url.pathname = `/${session.tenantSlug}/dashboard`;
    return NextResponse.redirect(url);
  }

  const rest = "/" + segments.slice(1).join("/");
  const rewrite = req.nextUrl.clone();
  rewrite.pathname = rest === "/" ? "/dashboard" : rest;

  const headers = new Headers(req.headers);
  headers.set("x-tenant-slug", session.tenantSlug);
  headers.set("x-user-id", session.userId);
  if (session.divisionId) headers.set("x-division-id", session.divisionId);

  return NextResponse.rewrite(rewrite, { request: { headers } });
}

export const config = {
  // Skip static assets and Next internals; everything else passes through.
  matcher: ["/((?!_next/|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|ico|css|js|woff2?)$).*)"],
};
