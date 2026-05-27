import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { fmtHours } from "@/lib/utils";

export const dynamic = "force-dynamic";
// Vercel cron is allowed up to 60s on Pro.
export const maxDuration = 60;

/**
 * Daily digest: for each tenant, send today's summary to Company.defaultEmailTo.
 * Triggered by Vercel cron (vercel.json) at 22:00 UTC daily. The endpoint is
 * also callable directly with header `Authorization: Bearer <CRON_SECRET>` for
 * manual testing.
 *
 * Each tenant gets one email containing:
 *  - Hours logged today, by job
 *  - Uploads still needing review
 *  - Any jobs that crossed 100% budget today
 *  - Anomaly count
 */
export async function GET(req: NextRequest) {
  // Vercel auto-adds `Authorization: Bearer <CRON_SECRET>` if you set CRON_SECRET
  // in env. Accept that, or allow direct calls when CRON_SECRET isn't set.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DEFAULT_FROM_EMAIL || "FabSheet <onboarding@resend.dev>";
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY not set" }, { status: 500 });
  }
  const resend = new Resend(apiKey);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const tenants = await prisma.tenant.findMany();
  const sent: string[] = [];
  const skipped: string[] = [];

  for (const t of tenants) {
    const company = await prisma.company.findFirst({ where: { tenantId: t.id } });
    const recipients = (company?.defaultEmailTo ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      skipped.push(`${t.slug} (no recipients)`);
      continue;
    }

    const tw = { tenantId: t.id };

    const [todayEntries, needsReview, jobs] = await Promise.all([
      prisma.timesheetEntry.findMany({
        where: { ...tw, status: "approved", upload: { date: { gte: dayStart, lt: dayEnd } } },
        include: { job: true, employee: true },
      }),
      prisma.timesheetUpload.count({ where: { ...tw, status: "needs_review" } }),
      prisma.job.findMany({
        where: { ...tw, status: "active" },
        include: {
          entries: { where: { status: "approved" }, select: { decimalHours: true, approvedAt: true } },
        },
      }),
    ]);

    const totalHoursToday = todayEntries.reduce((s, e) => s + e.decimalHours, 0);
    const byJob = new Map<string, number>();
    for (const e of todayEntries) {
      const k = e.job ? `${e.job.workOrderNumber} ${e.job.customerName || ""}`.trim() : "Unassigned";
      byJob.set(k, (byJob.get(k) ?? 0) + e.decimalHours);
    }
    const jobLines = Array.from(byJob.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `  ${k}: ${fmtHours(v)} h`);

    const budgetAlerts: string[] = [];
    for (const j of jobs) {
      const used = j.entries.reduce((s, e) => s + e.decimalHours, 0);
      const todayShare = j.entries
        .filter((e) => e.approvedAt && e.approvedAt >= dayStart)
        .reduce((s, e) => s + e.decimalHours, 0);
      if (j.budgetedHours > 0 && used > j.budgetedHours && todayShare > 0) {
        budgetAlerts.push(`  ${j.workOrderNumber} ${j.customerName}: ${fmtHours(used)} / ${fmtHours(j.budgetedHours)} h (over budget)`);
      }
    }

    const subject = `${t.displayName || t.name} - daily summary - ${dayStart.toISOString().slice(0, 10)}`;
    const lines = [
      `Daily summary for ${t.displayName || t.name}`,
      dayStart.toISOString().slice(0, 10),
      "",
      `Total approved hours today: ${fmtHours(totalHoursToday)}`,
      `Uploads needing review: ${needsReview}`,
      "",
      "Hours by job:",
      ...(jobLines.length > 0 ? jobLines : ["  (no approved entries today)"]),
    ];
    if (budgetAlerts.length > 0) {
      lines.push("", "Jobs over budget:", ...budgetAlerts);
    }
    const text = lines.join("\n");
    const html = `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
            <tr><td style="background:#0A1929;padding:18px 24px;color:#fff;font-weight:600;">${t.displayName || t.name} . daily summary</td></tr>
            <tr><td style="padding:24px;color:#111827;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${dayStart.toISOString().slice(0, 10)}</p>
              <p style="margin:0 0 16px;"><strong>${fmtHours(totalHoursToday)} h</strong> approved today. <strong>${needsReview}</strong> upload${needsReview === 1 ? "" : "s"} still needing review.</p>
              <h3 style="margin:0 0 8px;font-size:14px;">Hours by job</h3>
              <pre style="margin:0 0 16px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px;white-space:pre-wrap;">${(jobLines.length > 0 ? jobLines : ["(no approved entries today)"]).join("\n")}</pre>
              ${budgetAlerts.length > 0 ? `<h3 style="margin:0 0 8px;font-size:14px;color:#b91c1c;">Jobs over budget</h3><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px;white-space:pre-wrap;color:#7f1d1d;">${budgetAlerts.join("\n")}</pre>` : ""}
            </td></tr>
          </table>
        </td></tr>
      </table>`;

    try {
      await resend.emails.send({ from, to: recipients, subject, text, html });
      sent.push(`${t.slug} -> ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skipped.push(`${t.slug} (send failed: ${msg})`);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, ranAt: new Date().toISOString() });
}
