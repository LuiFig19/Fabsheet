import { prisma } from "@/lib/db";

/**
 * Fixed-window rate limiting backed by Postgres (the DB we already run) — no
 * paid Redis required. Per the security spec:
 *   - magic-link requests: 5 per email per 10 minutes
 *   - uploads:            30 per user per 10 minutes
 *
 * A DB hiccup never blocks a legitimate action (fails open). Concurrency races
 * at this scale (a couple of office users) are irrelevant — the window resets
 * cleanly and the cap is approximate by design.
 */
export type LimitResult = { ok: true } | { ok: false; retryAfterSec: number };

const WINDOW_MS = 10 * 60 * 1000;

async function check(prefix: string, id: string, limit: number): Promise<LimitResult> {
  const key = `${prefix}:${id}`;
  const now = new Date();
  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });
    if (!existing || existing.expiresAt < now) {
      // New or expired window: start fresh at 1.
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date(now.getTime() + WINDOW_MS) },
        update: { count: 1, expiresAt: new Date(now.getTime() + WINDOW_MS) },
      });
      return { ok: true };
    }
    if (existing.count >= limit) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000)) };
    }
    await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { ok: true };
  } catch {
    return { ok: true }; // fail open
  }
}

export function limitMagicLink(email: string): Promise<LimitResult> {
  return check("magiclink", email.trim().toLowerCase(), 5);
}

export function limitUpload(userKey: string): Promise<LimitResult> {
  return check("upload", userKey, 30);
}
