import Link from "next/link";
import { AlertTriangle, BriefcaseBusiness, Download, FileSpreadsheet, Gauge, ShieldCheck, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/access";
import { prisma } from "@/lib/db";
import { jobCostingSummary, workflowCounts } from "@/lib/workflow";
import { fmtHours, fmtMoney, formatDate, isProductiveCode, workWeekProgress } from "@/lib/utils";
import { scopeWhere, tenantWhere } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function BigHonchoPage() {
  const ctx = await requirePermission("big_honcho.view");
  const scoped = scopeWhere(ctx);
  const week = workWeekProgress();

  const [entries, jobs, counts, audits, users] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: {
        ...scoped,
        upload: { date: { gte: week.weekStart, lt: week.weekEnd } },
        status: { in: ["approved", "foreman_approved", "sent_to_hr", "entered_in_quickbooks", "payroll_ready"] },
      },
      include: { employee: true, job: true, upload: true },
      orderBy: [{ upload: { date: "desc" } }, { employee: { name: "asc" } }],
    }),
    jobCostingSummary(scoped),
    workflowCounts(scoped),
    prisma.auditLog.findMany({
      where: { ...tenantWhere(ctx), action: { in: ["request_correction", "foreman_approve", "submit_to_hr", "entered_in_quickbooks", "verify_time_clock", "mark_payroll_ready"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.user.findMany({ where: { tenantId: ctx.tenant.id, active: true }, orderBy: { name: "asc" } }),
  ]);

  const totalHours = entries.reduce((sum, entry) => sum + entry.decimalHours, 0);
  const productiveHours = entries.filter((entry) => isProductiveCode(entry.laborCode)).reduce((sum, entry) => sum + entry.decimalHours, 0);
  const supportHours = totalHours - productiveHours;
  const laborCost = totalHours * 45;
  const overBudgetJobs = jobs.filter((job) => job.overBudget);
  const mismatchAudits = audits.filter((log) => {
    const detail = log.after as Record<string, unknown> | null;
    return log.entityType === "TimeClockVerification" && (detail?.status === "mismatch" || detail?.status === "warning");
  });
  const employeeSummary = employeeHours(entries);
  const jobRows = jobs.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Big Honcho dashboard</h1>
          <p className="text-sm text-muted-foreground">Deep Raven's access: labor, payroll status, job costing, mismatch alerts, and drilldowns without waiting on office summaries.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/api/report/pdf?preset=week"><Download className="h-4 w-4" /> Weekly PDF</Link></Button>
          <Button asChild variant="outline"><Link href="/api/report/csv?preset=week"><FileSpreadsheet className="h-4 w-4" /> Weekly CSV</Link></Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Gauge className="h-4 w-4" />} label="Raven's labor this week" value={`${fmtHours(totalHours)}h`} note={`${fmtHours(productiveHours)} production · ${fmtHours(supportHours)} support`} tone="cyan" />
        <Metric icon={<BriefcaseBusiness className="h-4 w-4" />} label="Labor cost by jobs" value={fmtMoney(laborCost)} note="using current default shop labor rate" />
        <Metric icon={<AlertTriangle className="h-4 w-4" />} label="Over-budget jobs" value={String(overBudgetJobs.length)} note="actual hours above estimated hours" tone={overBudgetJobs.length ? "red" : "green"} />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Payroll-ready batches" value={String(counts.payrollReady)} note={`${counts.sentToHr} sent to HR · ${counts.enteredInQuickBooks} in QuickBooks`} tone="green" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader><CardTitle>Job costing and production summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {jobRows.map((job) => (
              <div key={job.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold">{job.workOrderNumber} · {job.customerName}</h3>
                    <p className="text-sm text-muted-foreground">{job.description || "No description"}</p>
                  </div>
                  <Badge variant={job.overBudget ? "danger" : job.pct >= 75 ? "warning" : "success"}>{job.pct}% used</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                  <SmallStat label="Actual" value={`${fmtHours(job.actualHours)}h`} />
                  <SmallStat label="Budget" value={`${fmtHours(job.budgetedHours)}h`} />
                  <SmallStat label="Production" value={`${fmtHours(job.productiveHours)}h`} />
                  <SmallStat label="Support" value={`${fmtHours(job.supportHours)}h`} />
                  <SmallStat label="Labor cost" value={fmtMoney(job.laborCost)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>QuickBooks and payroll status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <StatusRow label="Foreman review" value={counts.needsReview} tone={counts.needsReview ? "warning" : "success"} />
              <StatusRow label="Foreman approved" value={counts.foremanApproved} tone="warning" />
              <StatusRow label="Sent to HR" value={counts.sentToHr} tone="warning" />
              <StatusRow label="Entered in QuickBooks" value={counts.enteredInQuickBooks} tone="warning" />
              <StatusRow label="Payroll ready" value={counts.payrollReady} tone="success" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mismatch alerts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {mismatchAudits.length === 0 ? <Empty text="No current time-clock mismatch alerts." /> : mismatchAudits.slice(0, 6).map((log) => {
                const detail = (log.after ?? {}) as Record<string, unknown>;
                return (
                  <div key={log.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{String(detail.employeeName ?? "Employee")}</span>
                      <Badge variant={detail.status === "mismatch" ? "danger" : "warning"}>{String(detail.status)}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Diff {fmtHours(Number(detail.difference ?? 0))}h · {formatDate(log.createdAt)}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Employee hours summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {employeeSummary.map((employee) => (
              <div key={employee.name} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{employee.name}</span>
                  <span className="font-semibold">{fmtHours(employee.total)}h</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{fmtHours(employee.productive)} production · {fmtHours(employee.support)} support</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Foreman / HR activity</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {audits.length === 0 ? <Empty text="No workflow activity logged yet." /> : audits.slice(0, 10).map((log) => (
              <div key={log.id} className="rounded-lg border p-3">
                <div className="font-medium">{log.action.replace(/_/g, " ")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{log.entityType} · {formatDate(log.createdAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Internal admin controls</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 font-medium"><UsersRound className="h-4 w-4" /> Active users</div>
              <div className="mt-1 text-sm text-muted-foreground">{users.length} users can access this tenant.</div>
            </div>
            <Button asChild className="w-full" variant="outline"><Link href="/settings">Company settings</Link></Button>
            <Button asChild className="w-full" variant="outline"><Link href="/admin">User administration</Link></Button>
            <Button asChild className="w-full" variant="outline"><Link href="/reports">Run reports</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function employeeHours(entries: { employee: { name: string } | null; laborCode: string; decimalHours: number }[]) {
  const map = new Map<string, { name: string; total: number; productive: number; support: number }>();
  for (const entry of entries) {
    const name = entry.employee?.name ?? "Unknown";
    const row = map.get(name) ?? { name, total: 0, productive: 0, support: 0 };
    row.total += entry.decimalHours;
    if (isProductiveCode(entry.laborCode)) row.productive += entry.decimalHours;
    else row.support += entry.decimalHours;
    map.set(name, row);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function Metric({ icon, label, value, note, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; note: string; tone?: "neutral" | "green" | "red" | "cyan" }) {
  const color = tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-600" : tone === "cyan" ? "text-cyan-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 text-muted-foreground">
          <span className="text-sm font-medium">{label}</span>
          {icon}
        </div>
        <div className={`mt-3 text-3xl font-bold ${color}`}>{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div>;
}

function StatusRow({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="font-medium">{label}</span>
      <Badge variant={tone}>{value}</Badge>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
}
