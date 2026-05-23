"use server";

import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { signToken } from "@/lib/session";

export type LoginResult = { ok: boolean; message: string; devLink?: string };

/**
 * Magic-link request (multi_tenant mode). Finds the user by email, signs a
 * short-lived token, and emails a sign-in link via Resend. With no Resend key,
 * it logs a "would send" notice and returns the link for local testing.
 * Always returns a generic success so we do not leak which emails exist.
 */
export async function requestMagicLink(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Enter your email." };

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, active: true },
    include: { tenant: true },
  });

  const generic = { ok: true, message: "If that email has access, a sign-in link is on its way." };
  if (!user) return generic;

  const token = await signToken({
    userId: user.id,
    tenantSlug: user.tenant.slug,
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  });
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const link = `${base}/auth/verify?token=${encodeURIComponent(token)}`;

  const company = await prisma.company.findFirst({ where: { tenantId: user.tenantId } });
  const apiKey = process.env.RESEND_API_KEY || decryptSecret(company?.resendKeyEnc);
  const from = process.env.DEFAULT_FROM_EMAIL || company?.resendFrom || "FabSheet <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[auth] would send magic link to ${email}: ${link}`);
    return { ok: true, message: "Email not configured. Use the development link below.", devLink: link };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: [email],
      subject: "Your FabSheet sign-in link",
      text: `Sign in to ${user.tenant.displayName || user.tenant.name}: ${link}\n\nThis link expires in 15 minutes.`,
    });
  } catch (err) {
    console.error("[auth] send failed", err);
    return { ok: false, message: "Could not send the sign-in email. Try again." };
  }
  return generic;
}
