import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Read the current session via BetterAuth + show cookie-presence diagnostics.
 * After clicking a magic-link email, open this URL in the same browser. If
 * `signed_in: true` -> the cookie was set and is being sent; the bug is in
 * the post-click redirect target. If `signed_in: false` but cookies show
 * "better-auth.session_token" -> cookie is being sent but BetterAuth can't
 * read it (config mismatch). If no cookie at all -> the verify step never
 * set one.
 */
export async function GET(req: NextRequest) {
  const cookieNames = Array.from(req.cookies.getAll()).map((c) => c.name);
  let session: unknown = null;
  let error: string | null = null;
  try {
    session = await auth.api.getSession({ headers: req.headers });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    signed_in: Boolean(session),
    session,
    cookies_present: cookieNames,
    has_better_auth_cookie: cookieNames.some((n) => n.includes("better-auth.session_token")),
    error,
    request_origin: req.headers.get("origin") ?? null,
    request_host: req.headers.get("host") ?? null,
  });
}
