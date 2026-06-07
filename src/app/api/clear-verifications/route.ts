import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAllowedEmail } from "@/lib/platform-emails";

export const dynamic = "force-dynamic";

/**
 * Manual escape hatch: wipe BetterAuth's Verification table for an allowlisted
 * email. Useful when a previous attempt left a token in flight that's blocking
 * a new magic-link send. Allowlist-gated so random visitors can't kill
 * legitimate pending tokens.
 */
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: false, error: "missing ?email=" }, { status: 400 });
  if (!isAllowedEmail(email)) {
    return NextResponse.json({ ok: false, error: "email is not approved for sign-in" }, { status: 403 });
  }
  const r = await prisma.verification.deleteMany({ where: { identifier: email } });
  return NextResponse.json({ ok: true, deleted: r.count, email });
}
