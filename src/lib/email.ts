import { Resend } from "resend";

const FROM = process.env.DEFAULT_FROM_EMAIL || "FabSheet <onboarding@resend.dev>";
const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";

function resend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

/**
 * Send a magic-link sign-in email. Branded, plain enough that it lands in the
 * inbox (no images, simple HTML). With no RESEND_API_KEY the link is logged so
 * local dev keeps working.
 */
export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  const subject = `Your ${PRODUCT} sign-in link`;
  const text = `Click to sign in to ${PRODUCT}:\n\n${url}\n\nThis link expires in 15 minutes. If you didn't ask for it, ignore this email.`;
  const html = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr><td style="background:#0A1929;padding:18px 24px;color:#fff;font-weight:600;font-size:14px;">${PRODUCT}</td></tr>
          <tr><td style="padding:24px;color:#111827;font-size:15px;line-height:1.5;">
            <p style="margin:0 0 16px;">Click the button below to sign in.</p>
            <p style="margin:0 0 24px;"><a href="${url}" style="background:#0A1929;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:500;display:inline-block;">Sign in to ${PRODUCT}</a></p>
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Or paste this URL into your browser:</p>
            <p style="margin:0 0 24px;color:#374151;font-size:12px;word-break:break-all;">${url}</p>
            <p style="margin:0;color:#9ca3af;font-size:12px;">This link expires in 15 minutes. If you did not request it, you can ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  const client = resend();
  if (!client) {
    console.log(`[email] would send magic link to ${email}: ${url}`);
    return;
  }
  try {
    await client.emails.send({ from: FROM, to: [email], subject, text, html });
  } catch (err) {
    console.error("[email] send failed", err);
    throw err;
  }
}
