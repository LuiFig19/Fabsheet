import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, verifyToken, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

// Magic-link landing. Verifies the short-lived token, sets a 30-day session
// cookie, and sends the user to their tenant dashboard.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const payload = await verifyToken(token);
  if (!payload) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=expired";
    return NextResponse.redirect(url);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { tenant: true } });
  if (!user || !user.active) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const session = await signToken({
    userId: user.id,
    tenantSlug: user.tenant.slug,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });

  const dest = req.nextUrl.clone();
  dest.pathname = `/${user.tenant.slug}/dashboard`;
  dest.search = "";
  const res = NextResponse.redirect(dest);
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
