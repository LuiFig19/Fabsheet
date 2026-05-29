import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting via Upstash Redis. If the Upstash env vars are not set, every
 * check returns ok (no-op) so local dev and partially-configured deploys keep
 * working. Sliding-window limits per the security spec:
 *   - magic-link requests: 5 per email per 10 minutes
 *   - uploads:            30 per user per 10 minutes
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const rateLimitEnabled = redis !== null;

const magicLinkLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "10 m"), prefix: "rl:magiclink", analytics: false })
  : null;

const uploadLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "10 m"), prefix: "rl:upload", analytics: false })
  : null;

export type LimitResult = { ok: true } | { ok: false; retryAfterSec: number };

async function check(limiter: Ratelimit | null, key: string): Promise<LimitResult> {
  if (!limiter) return { ok: true };
  try {
    const r = await limiter.limit(key);
    if (r.success) return { ok: true };
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
  } catch {
    // Never block a legitimate action if Redis is briefly unreachable.
    return { ok: true };
  }
}

export function limitMagicLink(email: string): Promise<LimitResult> {
  return check(magicLinkLimiter, email.trim().toLowerCase());
}

export function limitUpload(userKey: string): Promise<LimitResult> {
  return check(uploadLimiter, userKey);
}
