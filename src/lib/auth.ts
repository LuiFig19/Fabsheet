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
 * BetterAuth instance - self-hosted, talks to our Postgres via the Prisma
 * adapter. Magic link only (no passwords), Resend as the transport. Allowlist
 * mode silently no-ops for non-listed emails so we don't leak which addresses
 * exist on Raven's deploy.
 */
// Build the list of origins BetterAuth should accept requests from. Includes
// both the bare deploy origin (vercel.app, fabsheet.org) AND the prefixed
// origin in case path-prefixed URLs are submitted as origins. Vercel preview
// URLs are also covered via a wildcard so PR previews don't blow up.
function buildTrustedOrigins(): string[] {
  const out = new Set<string>();
  const candidates = [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      const u = new URL(c);
      out.add(`${u.protocol}//${u.host}`);
      out.add(c.replace(/\/$/, ""));
    } catch {
      // ignore malformed URLs
    }
  }
  // Local dev
  out.add("http://localhost:3000");
  out.add("http://localhost:3000/r/8h3kd92ksjf");
  return Array.from(out);
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: buildTrustedOrigins(),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24 * 7, // refresh weekly
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5-min cookie cache for hot reads
  },
  user: {
    // Skip BetterAuth's own email-verification flow - the magic-link click IS
    // the verification. We want zero clicks beyond "click email link".
    additionalFields: {
      tenantId: { type: "string", required: false },
      role: { type: "string", required: false, defaultValue: "manager" },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Audit each step so /api/diagnose can show us whether BetterAuth is
        // even reaching the callback. Same store as the rest of the app.
        const log = async (action: string, after: Record<string, unknown>) => {
          try {
            await prisma.auditLog.create({
              data: { entityType: "Auth", entityId: email, action, after: after as object },
            });
          } catch {
            /* never block sign-in on logging */
          }
        };
        await log("magic_link_invoked", { email });
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
      // 15-minute link validity is plenty for "click your email now".
      expiresIn: 15 * 60,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
