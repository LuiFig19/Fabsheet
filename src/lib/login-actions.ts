"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type MagicLinkResult = { ok: boolean; error?: string };

/**
 * Request a magic link via BetterAuth's SERVER-SIDE API. This is the same code
 * path as /api/test-magic-link, which is confirmed working — unlike the
 * @better-auth/react client SDK, which silently no-ops in this deploy (returns
 * "sent" to the browser but never dispatches the email). Routing the login
 * form through this server action makes the real login work identically to the
 * test endpoint.
 */
export async function requestMagicLink(email: string, callbackURL: string): Promise<MagicLinkResult> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, error: "Enter your email." };
  try {
    // BetterAuth's API surface name has varied across versions; prefer the
    // documented one and fall back if needed.
    const api = auth.api as unknown as Record<string, (args: unknown) => Promise<unknown>>;
    const fn = api.signInMagicLink ?? api.sendMagicLink ?? api.magicLink;
    if (!fn) return { ok: false, error: "Magic-link endpoint unavailable." };
    await fn({ body: { email: clean, callbackURL }, headers: await headers() });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not send the link." };
  }
}
