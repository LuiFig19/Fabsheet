import Link from "next/link";
import { ClipboardCheck, FileWarning, Send, Upload, UsersRound, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/access";
import { prisma } from "@/lib/db";
import { easternNow, fmtHours, formatDate, utcDayBounds } from "@/lib/utils";
import { scopeWhere, tenantWhere } from "@/lib/tenant";
import { foremanApproveUpload, submitUploadToHr } from "@/lib/workflow-actions";
import { jobCostingSummary, statusLabel, workflowBadgeTone } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function ForemanPage() {
  const ctx = await requirePermission("foreman.view");
  const today = easternNow();
  const day = utcDayBounds(today.dateIso);
  const scoped = scopeWhere(ctx);

  const [todayUploads, employees, correctionRows, readyUploads, correctionLog, jobSummary] = await Promise.all([
    prisma.timesheetUpload.findMany({
      where: { ...scoped, date: { gte: day.start, lt: day.end } },
      include: { employee: true, entries: { include: { job: true, employee: true }, orderBy: { startTime: "asc" } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.employee.findMany({ where: { ...scoped, active: true }, orderBy: { name: "asc" } }),
    prisma.timesheetEntry.findMany({
      where: { ...scoped, status: { in: ["needs_review", "needs_correction"] } },
      include: { employee: true, upload: true, job: true },
      orderBy: [{ upload: { date: "desc" } }, { createdAt: "desc" }],
      take: 12,
    }),
    prisma.timesheetUpload.findMany({
      where: { ...scoped, status: "foreman_approved" },
      include: { employee: true, entries: true },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { ...tenantWhere(ctx), action: { in: ["request_correction", "foreman_approve", "submit_to_hr", "edit_entry"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    jobCostingSummary(scoped),
  ]);

  const submittedEmployeeIds = new Set(todayUploads.map((u) => u.employeeId).filter(Boolean));
  const missingEmployees = employees.filter((e) => !submittedEmployeeIds.has(e.id));
  const todayHoursByEmployee = new Map<string, number>();
  for (const upload of todayUploads) {
    for (const entry of upload.entries) {
      const key = entry.employee?.name ?? upload.employee?.name ?? "Unknown";
      todayHoursByEmployee.set(key, (todayHoursByEmployee.get(key) ?? 0) + entry.decimalHours);
    }
  }
  const readyHours = readyUploads.reduce((sum, u) => sum + u.entries.reduce((s, e) => s + e.decimalHours, 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Foreman dashboard</h1>
          <p className="text-sm text-muted-foreground">Collect sheets, fix bad rows, total the day, and submit clean production time to HR.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/upload"><Upload className="h-4 w-4" /> Upload sheets</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/review"><ClipboardCheck className="h-4 w-4" /> Review queue</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Upload className="h-4 w-4" />} label="Today's timesheets" value={String(todayUploads.length)} note={`${fmtHours(sumUploadHours(todayUploads))} total hours entered`} />
        <Metric icon={<UsersRound className="h-4 w-4" />} label="Missing sheets" value={String(missingEmployees.length)} note={today.hour >= 18 ? "after 6 PM deadline" : "not submitted yet"} tone={missingEmployees.length ? "red" : "green"} />
        <Metric icon={<FileWarning className="h-4 w-4" />} label="Needs correction" value={String(correctionRows.length)} note="rows waiting on foreman review" tone={correctionRows.length ? "red" : "green"} />
        <Metric icon={<Send className="h-4 w-4" />} label="Ready for HR" value={String(readyUploads.length)} note={`${fmtHours(readyHours)} hours ready to send`} tone={readyUploads.length ? "cyan" : "neutral"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Today's timesheets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayUploads.length === 0 ? (
              <Empty text="No timesheets have been uploaded for today." />
            ) : todayUploads.map((upload) => (
              <div key={upload.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{upload.employee?.name ?? "Unassigned sheet"}</h3>
                      <Badge variant={workflowBadgeTone(upload.status)}>{statusLabel(upload.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(upload.date ?? upload.createdAt)} · {upload.entries.length} rows · {fmtHours(upload.entries.reduce((s, e) => s + e.decimalHours, 0))} hours
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/review?upload=${upload.id}`}>Open</Link></Button>
                    {["needs_review", "extracting", "approved"].includes(upload.status) && (
                      <form action={async () => { "use server"; await foremanApproveUpload(upload.id); }}>
                        <Button size="sm" type="submit"><ClipboardCheck className="h-4 w-4" /> Approve</Button>
                      </form>
                    )}
                    {upload.status === "foreman_approved" && (
                      <form action={async () => { "use server"; await submitUploadToHr(upload.id); }}>
                        <Button size="sm" type="submit"><Send className="h-4 w-4" /> Send to HR</Button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {upload.entries.slice(0, 6).map((entry) => (
                    <div key={entry.id} className="rounded-lg border bg-muted/25 p-3 text-sm">
                      <div className="font-medium">{entry.workOrderNumber || entry.job?.workOrderNumber || "No job"} · {entry.description || "No task"}</div>
                      <div className="mt-1 text-muted-foreground">{entry.startTime}-{entry.endTime} · {fmtHours(entry.decimalHours)}h</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Missing timesheets</CardTitle>
            </CardHeader>
            <CardContent>
              {missingEmployees.length === 0 ? <Empty text="Everyone active has a sheet for today." /> : (
                <div className="space-y-2">
                  {missingEmployees.slice(0, 12).map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-medium">{e.name}</span>
                      <Badge variant={today.hour >= 18 ? "danger" : "secondary"}>{today.hour >= 18 ? "late" : "pending"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ready-to-send batch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {readyUploads.length === 0 ? <Empty text="No foreman-approved sheets waiting for HR." /> : readyUploads.map((upload) => (
                <form key={upload.id} action={async () => { "use server"; await submitUploadToHr(upload.id); }} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{upload.employee?.name ?? "Unassigned"}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(upload.date ?? upload.createdAt)} · {fmtHours(upload.entries.reduce((s, e) => s + e.decimalHours, 0))}h</div>
                  </div>
                  <Button size="sm" type="submit">Send</Button>
                </form>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Entries needing correction</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {correctionRows.length === 0 ? <Empty text="No correction rows are currently open." /> : correctionRows.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{entry.employee?.name ?? "Unknown"}</div>
                  <Badge variant="danger">{statusLabel(entry.status)}</Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{entry.workOrderNumber || "No job"} · {entry.description || "No task"} · {fmtHours(entry.decimalHours)}h</div>
                <Button asChild className="mt-3" size="sm" variant="outline"><Link href={`/review?upload=${entry.uploadId}`}>Fix row</Link></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Employee hour totals today</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {todayHoursByEmployee.size === 0 ? <Empty text="No employee hours entered today." /> : Array.from(todayHoursByEmployee.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, hours]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">{name}</span>
                <span className="font-semibold">{fmtHours(hours)}h</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Correction log</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {correctionLog.length === 0 ? <Empty text="No workflow actions logged yet." /> : correctionLog.map((log) => (
              <div key={log.id} className="rounded-lg border p-3">
                <div className="font-medium">{log.action.replace(/_/g, " ")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{formatDate(log.createdAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Job hours summary</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobSummary.slice(0, 9).map((job) => (
            <div key={job.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{job.workOrderNumber}</h3>
                  <p className="text-sm text-muted-foreground">{job.customerName}</p>
                </div>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-muted-foreground">Actual</div><div className="font-semibold">{fmtHours(job.actualHours)}h</div></div>
                <div><div className="text-muted-foreground">Budget</div><div className="font-semibold">{fmtHours(job.budgetedHours)}h</div></div>
                <div><div className="text-muted-foreground">Cost</div><div className="font-semibold">${Math.round(job.laborCost).toLocaleString()}</div></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function sumUploadHours(uploads: { entries: { decimalHours: number }[] }[]) {
  return uploads.reduce((sum, u) => sum + u.entries.reduce((s, e) => s + e.decimalHours, 0), 0);
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

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
}
