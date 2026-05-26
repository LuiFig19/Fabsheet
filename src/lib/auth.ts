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
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
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
        // Allowlist guard: pretend to send for non-allowed addresses (no email
        // is actually transmitted), to avoid revealing which emails exist.
        if (!isAllowed(email)) {
          console.log(`[auth] denied magic link for non-allowlisted email: ${email}`);
          return;
        }
        await sendMagicLinkEmail(email, url);
      },
      // 15-minute link validity is plenty for "click your email now".
      expiresIn: 15 * 60,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
