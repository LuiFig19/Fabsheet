import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Resend } from "resend";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";

/** Canonical app origin INCLUDING the access-path prefix. Prefers the public
 *  domain (fabsheet.org) over a Vercel preview URL so magic links + cookies all
 *  live on one host even if BETTER_AUTH_URL was never updated in Vercel. */
function resolveBaseURL(): string {
  const prefix = process.env.ACCESS_PATH_PREFIX
    ? `/${process.env.ACCESS_PATH_PREFIX.replace(/^\/+|\/+$/g, "")}`
    : "";
  const candidates = [process.env.NEXT_PUBLIC_APP_URL, process.env.BETTER_AUTH_URL]
    .filter(Boolean)
    .map((c) => (c as string).replace(/\/$/, ""));
  const chosen = candidates.find((c) => !c.includes("vercel.app")) ?? candidates[0] ?? "http://localhost:3000";
  return chosen.endsWith(prefix) || prefix === "" ? chosen : chosen + prefix;
}

export const BASE_URL = resolveBaseURL();

function allowlistOK(email: string): boolean {
  if ((process.env.AUTH_MODE ?? "allowlist") !== "allowlist") return true;
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(email.trim().toLowerCase());
}

/** Send the magic-link email through Resend. Inlined here (no indirection) so
 *  the whole send path is one function. Throws on failure so BetterAuth surfaces
 *  the error to the caller instead of silently swallowing it. */
async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DEFAULT_FROM_EMAIL || `${PRODUCT} <onboarding@resend.dev>`;
  if (!apiKey) {
    console.log(`[auth] RESEND_API_KEY missing. Would send to ${email}: ${url}`);
    return;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: `Sign in to ${PRODUCT}`,
    text: `Sign in to ${PRODUCT}:\n\n${url}\n\nThis link expires in 15 minutes. If you did not request it, ignore this email.`,
    html: `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
        <tr><td align="center">
          <table width="460" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
            <tr><td style="background:#0A1929;padding:16px 24px;color:#fff;font-weight:600;">${PRODUCT}</td></tr>
            <tr><td style="padding:24px;color:#111827;font-size:15px;line-height:1.5;">
              <p style="margin:0 0 20px;">Click to sign in.</p>
              <p style="margin:0 0 24px;"><a href="${url}" style="background:#0A1929;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:500;display:inline-block;">Sign in to ${PRODUCT}</a></p>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Or paste this link:</p>
              <p style="margin:0;color:#374151;font-size:12px;word-break:break-all;">${url}</p>
            </td></tr>
          </table>
        </td></tr>
      </table>`,
  });
  if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
}

// ---------------------------------------------------------------------------
// BetterAuth instance
// ---------------------------------------------------------------------------

export const auth = betterAuth({
  appName: PRODUCT,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: BASE_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Accept requests from the public domain and the preview URL, with or without
  // the access prefix.
  trustedOrigins: Array.from(
    new Set(
      [process.env.NEXT_PUBLIC_APP_URL, process.env.BETTER_AUTH_URL, BASE_URL, "http://localhost:3000"]
        .filter(Boolean)
        .flatMap((c) => {
          const v = (c as string).replace(/\/$/, "");
          try {
            const u = new URL(v);
            return [v, `${u.protocol}//${u.host}`];
          } catch {
            return [v];
          }
        }),
    ),
  ),
  rateLimit: { enabled: false },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24 * 7,
  },
  // Pin cookie Path=/ so the session survives the redirect from
  // /<prefix>/api/auth/... to /<prefix>/dashboard (the basePath gotcha).
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
      expiresIn: 15 * 60,
      sendMagicLink: async ({ email, url }) => {
        if (!allowlistOK(email)) {
          console.log(`[auth] ${email} not allowlisted; skipping send.`);
          return;
        }
        await sendMagicLinkEmail(email, url);
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
