import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Server-side trigger of BetterAuth's magic-link flow, bypassing the client
// SDK entirely. If this returns ok:true and the email arrives, the issue is
// in how the browser's @better-auth/react client is posting to the API. If it
// errors here, BetterAuth's server-side magic-link config is the culprit.
//
// Gated to allowlisted emails only.
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: false, error: "missing ?email=" }, { status: 400 });

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(email)) {
    return NextResponse.json({ ok: false, error: "email not in ALLOWED_EMAILS" }, { status: 403 });
  }

  try {
    // BetterAuth's typed API surface for the magic-link sign-in endpoint.
    // The exported name has varied across versions; try both.
    const api = auth.api as unknown as Record<string, (args: unknown) => Promise<unknown>>;
    const fn = api.signInMagicLink ?? api.sendMagicLink ?? api.magicLink;
    if (!fn) {
      return NextResponse.json(
        {
          ok: false,
          error: "BetterAuth has no signInMagicLink / sendMagicLink / magicLink endpoint exposed on auth.api",
          available: Object.keys(api).filter((k) => /magic|sign/i.test(k)),
        },
        { status: 500 },
      );
    }
    const callbackURL = `${process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard`;
    const result = await fn({
      body: { email, callbackURL },
      headers: req.headers,
    });
    return NextResponse.json({ ok: true, callbackURL, result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error_name: err instanceof Error ? err.name : "unknown",
        error_message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
