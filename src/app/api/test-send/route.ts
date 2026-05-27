import { NextRequest, NextResponse } from "next/server";
import { sendMagicLinkEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Bypass BetterAuth and call our email helper directly. Confirms whether the
// Resend integration (key + From + verified domain) works in isolation, so we
// can tell if a stuck magic-link flow is "Resend broken" vs "BetterAuth broken".
//
// Gated: the target email MUST be in the allowlist. Anonymous random-email
// triggering is blocked.
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: "missing ?email=..." }, { status: 400 });
  }

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(email)) {
    return NextResponse.json({ ok: false, error: "email not in ALLOWED_EMAILS" }, { status: 403 });
  }

  const fakeUrl = `${process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/api/auth/test-link`;
  try {
    await sendMagicLinkEmail(email, fakeUrl);
    return NextResponse.json({
      ok: true,
      sent_to: email,
      from: process.env.DEFAULT_FROM_EMAIL ?? null,
      note: "If Resend Logs still show nothing after this, RESEND_API_KEY is wrong or the Resend SDK threw before reaching their API.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        from: process.env.DEFAULT_FROM_EMAIL ?? null,
        error_name: err instanceof Error ? err.name : "unknown",
        error_message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
