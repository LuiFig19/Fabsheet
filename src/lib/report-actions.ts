"use server";

import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { buildReport } from "@/lib/report";
import { renderReportPdf } from "@/lib/report-pdf";
import { getTenantContext, tenantWhere } from "@/lib/tenant";

function resolveResendKey(company: { resendKeyEnc?: string | null } | null): string {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;
  return decryptSecret(company?.resendKeyEnc);
}

export type EmailResult = { ok: boolean; message: string };

/**
 * Email the report PDF via Resend. If no API key is configured, this does NOT
 * fail. It logs a "would send" notice and returns a clear not-configured
 * message so the UI can show it instead of crashing.
 */
export async function emailReport(formData: FormData): Promise<EmailResult> {
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "Raven's Marine time report").trim();
  const message = String(formData.get("message") ?? "").trim();
  const preset = String(formData.get("preset") ?? "week");
  const group = String(formData.get("group") ?? "job") as "job" | "employee" | "code";
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");

  if (!to) return { ok: false, message: "Add at least one recipient." };

  const ctx = await getTenantContext();
  const company = await prisma.company.findFirst({ where: tenantWhere(ctx) });
  const data = await buildReport(ctx, preset, group, start || undefined, end || undefined);
  const pdf = await renderReportPdf(data, ctx.tenant.displayName || ctx.tenant.name || company?.name || "FabSheet");
  const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);
  const filename = `ravens-time-${data.startLabel}_to_${data.endLabel}.pdf`;

  const apiKey = resolveResendKey(company);
  const from = process.env.RESEND_FROM || company?.resendFrom || "Raven's Marine <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(
      `[email] would send "${subject}" to ${recipients.join(", ")} with attachment ${filename} (${pdf.length} bytes). Set RESEND_API_KEY to actually send.`,
    );
    return { ok: true, message: `Email not configured. Logged a "would send" to ${recipients.join(", ")} (set RESEND_API_KEY to send for real).` };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: recipients,
      subject,
      text: message || `Attached: Time by ${group} detail, ${data.startLabel} to ${data.endLabel}. Total ${data.grandTotal.toFixed(2)} hours.`,
      attachments: [{ filename, content: pdf.toString("base64") }],
    });
    if (error) return { ok: false, message: `Resend error: ${error.message}` };
    return { ok: true, message: `Sent to ${recipients.join(", ")}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to send email." };
  }
}
