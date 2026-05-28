import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email";

const allowlistMode = (process.env.AUTH_MODE ?? "allowlist") === "allowlist";

function isAllowed(email: string): boolean {
  if (!allowlistMode) return true;
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/**
 * Pick the canonical app origin. Strongly prefers the public app URL
 * (fabsheet.org) over a Vercel preview URL so cookies and magic-link redirects
 * stay on one host. Falls back through env vars and finally to localhost for
 * dev. Defensive against the case where BETTER_AUTH_URL hasn't been updated
 * in Vercel yet — the magic-link domain still resolves correctly.
 */
function resolveBaseURL(): string {
  const prefix = process.env.ACCESS_PATH_PREFIX
    ? `/${process.env.ACCESS_PATH_PREFIX.replace(/^\/+|\/+$/g, "")}`
    : "";
  const pub = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const better = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");

  // Pick the value that doesn't smell like a Vercel preview (which protects
  // the magic-link domain even if env vars are stale).
  const candidates = [pub, better].filter(Boolean) as string[];
  const nonPreview = candidates.find((c) => !c.includes("vercel.app"));

  if (nonPreview) {
    // If the chosen URL doesn't already contain the prefix, append it.
    return nonPreview.endsWith(prefix) ? nonPreview : nonPreview + prefix;
  }
  // Last resort: whichever env var we have, or localhost for dev.
  return candidates[0] ?? `http://localhost:3000${prefix}`;
}

const BASE_URL = resolveBaseURL();

function buildTrustedOrigins(): string[] {
  const out = new Set<string>([BASE_URL]);
  for (const c of [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!c) continue;
    try {
      const u = new URL(c);
      out.add(`${u.protocol}//${u.host}`);
      out.add(c.replace(/\/$/, ""));
    } catch {
      /* ignore */
    }
  }
  try {
    const u = new URL(BASE_URL);
    out.add(`${u.protocol}//${u.host}`);
  } catch {
    /* ignore */
  }
  out.add("http://localhost:3000");
  out.add("http://localhost:3000/r/8h3kd92ksjf");
  return Array.from(out);
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: BASE_URL,
  trustedOrigins: buildTrustedOrigins(),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Disable BetterAuth's built-in rate limiter entirely. The magic-link plugin
  // was silently throttling repeat sends to the same email, making the login
  // form look successful (200) while actually skipping the email send. For
  // a single-tenant Raven's deploy this is the right call. For multi-tenant
  // we'll re-enable with sensible per-IP limits.
  rateLimit: { enabled: false },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24 * 7, // refresh weekly
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  // CRITICAL: pin cookie attributes explicitly. With Next.js basePath in play,
  // the verify endpoint lives at /r/<prefix>/api/auth/... — if Path isn't set
  // to "/", the browser scopes the session cookie to that directory and it
  // never reaches /r/<prefix>/dashboard. That's why post-click redirects keep
  // landing on /login. A custom prefix also gives middleware a deterministic
  // cookie name to look for.
  advanced: {
    cookiePrefix: "fabsheet",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  },
  user: {
    additionalFields: {
      tenantId: { type: "string", required: false },
      role: { type: "string", required: false, defaultValue: "manager" },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const log = async (action: string, after: Record<string, unknown>) => {
          try {
            await prisma.auditLog.create({
              data: { entityType: "Auth", entityId: email, action, after: after as object },
            });
          } catch { /* never block sign-in on logging */ }
        };
        await log("magic_link_invoked", { email, base: BASE_URL });
        // Sweep any verification rows older than 30s for this email so future
        // requests can never be blocked by stale tokens. We give BetterAuth's
        // just-created row a 30s grace window so we don't nuke our own token.
        try {
          await prisma.verification.deleteMany({
            where: { identifier: email, createdAt: { lt: new Date(Date.now() - 30_000) } },
          });
        } catch { /* never block sign-in */ }
        if (!isAllowed(email)) {
          console.log(`[auth] denied magic link for non-allowlisted email: ${email}`);
          await log("magic_link_denied_allowlist", { email });
          return;
        }
        try {
          await sendMagicLinkEmail(email, url);
          await log("magic_link_sent", { email, url_host: new URL(url).host });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await log("magic_link_send_failed", { email, message });
          throw err;
        }
      },
      expiresIn: 15 * 60,
      // Allow re-requesting a magic link without waiting for the previous one
      // to expire. Cleaner UX, no "you must wait" silent failures.
      disableSignUp: false,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
