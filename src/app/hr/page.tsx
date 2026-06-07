import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ShieldCheck, Timer, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/access";
import { prisma } from "@/lib/db";
import { markEnteredInQuickBooks, markPayrollReady, verifyTimeClockAgainstProduction } from "@/lib/workflow-actions";
import { jobCostingSummary, statusLabel, workflowBadgeTone } from "@/lib/workflow";
import { easternNow, fmtHours, formatDate, toDateInputValue, utcDayBounds } from "@/lib/utils";
import { scopeWhere, tenantWhere } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  const ctx = await requirePermission("hr.view");
  const scoped = scopeWhere(ctx);
  const today = easternNow();
  const todayBounds = utcDayBounds(today.dateIso);

  const [submittedBatches, qbBatches, payrollReady, employees, verificationLogs, todayEntries, jobSummary] = await Promise.all([
    prisma.timesheetUpload.findMany({
      where: { ...scoped, status: "sent_to_hr" },
      include: { employee: true, entries: { include: { employee: true, job: true } } },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.timesheetUpload.findMany({
      where: { ...scoped, status: "entered_in_quickbooks" },
      include: { employee: true, entries: { include: { employee: true, job: true } } },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.timesheetUpload.findMany({
      where: { ...scoped, status: "payroll_ready" },
      include: { employee: true, entries: true },
      orderBy: { date: "desc" },
      take: 12,
    }),
    prisma.employee.findMany({ where: { ...scoped, active: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({
      where: { ...tenantWhere(ctx), entityType: "TimeClockVerification" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.timesheetEntry.findMany({
      where: {
        ...scoped,
        upload: { date: { gte: todayBounds.start, lt: todayBounds.end } },
        status: { in: ["sent_to_hr", "entered_in_quickbooks", "payroll_ready", "approved", "foreman_approved"] },
      },
      include: { employee: true, job: true },
      orderBy: [{ employee: { name: "asc" } }, { startTime: "asc" }],
    }),
    jobCostingSummary(scoped),
  ]);

  const approvedHoursAwaitingQb = submittedBatches.reduce((sum, upload) => sum + sumEntries(upload.entries), 0);
  const qbHours = qbBatches.reduce((sum, upload) => sum + sumEntries(upload.entries), 0);
  const payrollReadyHours = payrollReady.reduce((sum, upload) => sum + sumEntries(upload.entries), 0);
  const employeeToday = summarizeEmployeeHours(todayEntries);
  const mismatchLogs = verificationLogs.filter((log) => {
    const detail = log.after as Record<string, unknown> | null;
    return detail?.status === "mismatch" || detail?.status === "warning";
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HR / Payroll dashboard</h1>
          <p className="text-sm text-muted-foreground">Receive foreman-approved summaries, export QuickBooks-ready CSVs, verify clock time, and close payroll batches.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/api/report/payroll-csv?preset=week"><Download className="h-4 w-4" /> Payroll CSV</Link></Button>
          <Button asChild variant="outline"><Link href="/api/report/csv?preset=week"><FileSpreadsheet className="h-4 w-4" /> Job CSV</Link></Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<WalletCards className="h-4 w-4" />} label="Awaiting QuickBooks" value={String(submittedBatches.length)} note={`${fmtHours(approvedHoursAwaitingQb)} foreman-approved hours`} tone={submittedBatches.length ? "orange" : "green"} />
        <Metric icon={<FileSpreadsheet className="h-4 w-4" />} label="Entered in QuickBooks" value={String(qbBatches.length)} note={`${fmtHours(qbHours)} hours need verification`} tone={qbBatches.length ? "cyan" : "neutral"} />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Payroll ready" value={String(payrollReady.length)} note={`${fmtHours(payrollReadyHours)} verified hours`} tone="green" />
        <Metric icon={<AlertTriangle className="h-4 w-4" />} label="Clock mismatches" value={String(mismatchLogs.length)} note="latest Jose verification flags" tone={mismatchLogs.length ? "red" : "green"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Foreman-submitted batches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {submittedBatches.length === 0 ? <Empty text="No foreman-approved batches are waiting on QuickBooks entry." /> : submittedBatches.map((upload) => (
              <div key={upload.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{upload.employee?.name ?? "Unassigned sheet"}</h3>
                      <Badge variant={workflowBadgeTone(upload.status)}>{statusLabel(upload.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(upload.date ?? upload.createdAt)} · {upload.entries.length} rows · {fmtHours(sumEntries(upload.entries))} hours</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/review?upload=${upload.id}`}>Open</Link></Button>
                    <form action={async () => { "use server"; await markEnteredInQuickBooks(upload.id); }}>
                      <Button size="sm" type="submit"><CheckCircle2 className="h-4 w-4" /> Mark entered</Button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time clock verification</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={async (formData) => { "use server"; await verifyTimeClockAgainstProduction(formData); }} className="space-y-3">
              <label className="block text-sm font-medium">
                Employee
                <select name="employeeId" required className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Select employee</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Date
                <Input name="date" type="date" defaultValue={toDateInputValue(new Date())} required className="mt-1" />
              </label>
              <label className="block text-sm font-medium">
                Time clock hours
                <Input name="clockHours" type="number" step="0.01" min="0" placeholder="9.00" required className="mt-1" />
              </label>
              <label className="block text-sm font-medium">
                Notes
                <Input name="notes" placeholder="time clock file, PTO note, manual correction..." className="mt-1" />
              </label>
              <Button type="submit" className="w-full"><Timer className="h-4 w-4" /> Verify against production hours</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Entered in QuickBooks, awaiting verification</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {qbBatches.length === 0 ? <Empty text="No QuickBooks-entered batches are waiting for payroll-ready status." /> : qbBatches.map((upload) => (
              <form key={upload.id} action={async () => { "use server"; await markPayrollReady(upload.id); }} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{upload.employee?.name ?? "Unassigned"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(upload.date ?? upload.createdAt)} · {fmtHours(sumEntries(upload.entries))}h</div>
                </div>
                <Button type="submit" size="sm">Payroll ready</Button>
              </form>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mismatch report</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {mismatchLogs.length === 0 ? <Empty text="No clock mismatches or warnings in the latest checks." /> : mismatchLogs.map((log) => {
              const detail = (log.after ?? {}) as Record<string, unknown>;
              return (
                <div key={log.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{String(detail.employeeName ?? "Employee")}</div>
                    <Badge variant={detail.status === "mismatch" ? "danger" : "warning"}>{String(detail.status)}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Clock {fmtHours(Number(detail.clockHours ?? 0))}h · Production {fmtHours(Number(detail.productionHours ?? 0))}h · Diff {fmtHours(Number(detail.difference ?? 0))}h
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(log.createdAt)}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Employee payroll summary today</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {employeeToday.length === 0 ? <Empty text="No approved or submitted hours are ready for today's payroll summary." /> : employeeToday.map((row) => (
              <div key={row.name} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">{row.name}</span>
                <span className="font-semibold">{fmtHours(row.hours)}h</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Job production summary this week</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {jobSummary.slice(0, 8).map((job) => (
            <div key={job.id} className="rounded-xl border p-4">
              <div className="font-semibold">{job.workOrderNumber}</div>
              <div className="text-sm text-muted-foreground">{job.customerName}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-muted-foreground">Actual</div><div className="font-semibold">{fmtHours(job.actualHours)}h</div></div>
                <div><div className="text-muted-foreground">Budget</div><div className="font-semibold">{fmtHours(job.budgetedHours)}h</div></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function sumEntries(entries: { decimalHours: number }[]) {
  return entries.reduce((sum, entry) => sum + entry.decimalHours, 0);
}

function summarizeEmployeeHours(entries: { employee: { name: string } | null; decimalHours: number }[]) {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const name = entry.employee?.name ?? "Unknown";
    map.set(name, (map.get(name) ?? 0) + entry.decimalHours);
  }
  return Array.from(map.entries()).map(([name, hours]) => ({ name, hours })).sort((a, b) => a.name.localeCompare(b.name));
}

function Metric({ icon, label, value, note, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; note: string; tone?: "neutral" | "green" | "red" | "orange" | "cyan" }) {
  const color = tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-600" : tone === "orange" ? "text-amber-600" : tone === "cyan" ? "text-cyan-600" : "text-foreground";
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

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
}
