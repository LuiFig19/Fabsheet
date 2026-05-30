import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/lib/db";
import { approvedHoursByJob } from "@/lib/queries";
import { getTenantContext, scopeWhere, tenantWhere } from "@/lib/tenant";
import {
  budgetTier,
  easternNow,
  fmtHours,
  formatDate,
  utcDayBounds,
  workWeekProgress,
  productiveCodeWhere,
  nonProductiveCodeWhere,
} from "@/lib/utils";
import { ProductionGoalCard } from "@/components/production-goal-card";
import { EmailToOfficeDropdown, type RosterMember } from "./email-to-office-dropdown";
import { Upload, ClipboardCheck, AlertTriangle, ArrowRight, CalendarCheck, CalendarX } from "lucide-react";

const HR_CUTOFF_HOUR = 18; // 6 PM Eastern

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getTenantContext();
  const s = scopeWhere(ctx);
  const { weekStart, weekEnd, daysRemaining, onWeekend } = workWeekProgress();
  const today = easternNow();
  const todayBounds = utcDayBounds(today.dateIso);

  const [jobs, usedByJob, productiveAgg, supportAgg, jobsInProgress, needsReviewCount, recent, company, multiUnitEntries, activeEmployees, todayUploads] = await Promise.all([
    prisma.job.findMany({ where: { ...s, status: "active" }, orderBy: { workOrderNumber: "asc" } }),
    approvedHoursByJob(ctx),
    // Productive = direct fab work (see PRODUCTIVE_CODES in lib/utils).
    prisma.timesheetEntry.aggregate({
      where: { ...s, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...productiveCodeWhere },
      _sum: { decimalHours: true },
    }),
    // Non-production = everything else (machine repair, forklift, wash, admin, etc).
    prisma.timesheetEntry.aggregate({
      where: { ...s, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...nonProductiveCodeWhere },
      _sum: { decimalHours: true },
    }),
    prisma.job.count({ where: { ...s, status: "active" } }),
    prisma.timesheetEntry.count({ where: { ...s, status: "needs_review" } }),
    prisma.timesheetUpload.findMany({
      where: s,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { employee: true, _count: { select: { entries: true } } },
    }),
    prisma.company.findFirst({ where: tenantWhere(ctx) }),
    // Approved entry hours per (jobId, unitNumber) for multi-unit jobs only,
    // so the dashboard job cards can render mini per-unit bars.
    prisma.timesheetEntry.findMany({
      where: { ...s, status: "approved", jobId: { not: null }, unitNumber: { not: null }, job: { quantity: { gt: 1 } } },
      select: { jobId: true, unitNumber: true, decimalHours: true },
    }),
    // For the "Today's submissions" card + the EmailToOffice roster.
    prisma.employee.findMany({
      where: { ...s, active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.timesheetUpload.findMany({
      where: { ...s, date: { gte: todayBounds.start, lt: todayBounds.end } },
      select: { id: true, employeeId: true },
    }),
  ]);

  const submittedToday = new Set(todayUploads.map((u) => u.employeeId).filter((id): id is string => !!id));
  const missingToday = activeEmployees.filter((e) => !submittedToday.has(e.id));
  const submittedCount = activeEmployees.length - missingToday.length;
  const afterCutoff = today.hour >= HR_CUTOFF_HOUR;
  const roster: RosterMember[] = activeEmployees.map((e) => ({ id: e.id, name: e.name, hasEmail: e.email.trim().length > 0 }));
  const officeReady = (company?.defaultEmailTo ?? "").trim().length > 0;

  // Build a per-job, per-unit hours map for the multi-unit cards.
  const unitHoursByJob = new Map<string, Map<number, number>>();
  for (const e of multiUnitEntries) {
    if (!e.jobId || e.unitNumber == null) continue;
    if (!unitHoursByJob.has(e.jobId)) unitHoursByJob.set(e.jobId, new Map());
    const m = unitHoursByJob.get(e.jobId)!;
    m.set(e.unitNumber, (m.get(e.unitNumber) ?? 0) + e.decimalHours);
  }

  const productiveThisWeek = productiveAgg._sum.decimalHours ?? 0;
  const supportThisWeek = supportAgg._sum.decimalHours ?? 0;
  const productionTarget = company?.weeklyProductionTarget ?? 850;
  const productivePct = productionTarget > 0 ? (productiveThisWeek / productionTarget) * 100 : 0;
  const remainingHours = Math.max(0, productionTarget - productiveThisWeek);
  const perDay = daysRemaining > 0 ? remainingHours / daysRemaining : 0;
  const onTrack = productivePct >= 100;

  const overBudget = jobs.filter((j) => budgetTier(usedByJob.get(j.id) ?? 0, j.budgetedHours) === "red").length;
  const uploadsNeedingReview = await prisma.timesheetUpload.count({ where: { ...s, status: "needs_review" } });

  const stats = [
    {
      label: "Productive hours this week",
      value: `${fmtHours(productiveThisWeek)} / ${productionTarget}`,
      sub: `+${fmtHours(supportThisWeek)} h support`,
      warn: !onTrack && !onWeekend && daysRemaining <= 2,
    },
    { label: "Jobs in progress", value: String(jobsInProgress) },
    { label: "Jobs over budget", value: String(overBudget), danger: overBudget > 0 },
    { label: "Uploads needing review", value: String(uploadsNeedingReview), warn: uploadsNeedingReview > 0 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Week of {formatDate(weekStart)}. {needsReviewCount} row{needsReviewCount === 1 ? "" : "s"} waiting on review.
          </p>
        </div>
        <Button asChild size="lg" className="min-h-[44px]">
          <Link href="/upload">
            <Upload className="h-4 w-4" /> Upload Timesheet
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle>{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold tabular-nums sm:text-3xl ${
                  s.danger ? "text-red-600" : s.warn ? "text-amber-600" : ""
                }`}
              >
                {s.value}
              </div>
              {s.sub && <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Link href="/production" className="block">
        <ProductionGoalCard
          target={productionTarget}
          productive={productiveThisWeek}
          support={supportThisWeek}
          pct={productivePct}
          remaining={remainingHours}
          perDay={perDay}
          daysRemaining={daysRemaining}
          onWeekend={onWeekend}
          onTrack={onTrack}
        />
      </Link>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Job progress</h2>
          <Link href="/jobs" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            All jobs <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => {
            const used = usedByJob.get(j.id) ?? 0;
            const tier = budgetTier(used, j.budgetedHours);
            const pct = j.budgetedHours > 0 ? (used / j.budgetedHours) * 100 : 0;
            return (
              <Link key={j.id} href={`/jobs/${j.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{j.workOrderNumber}</div>
                        <div className="text-sm text-muted-foreground">{j.customerName || j.description}</div>
                      </div>
                      <Badge variant={tier === "red" ? "danger" : tier === "yellow" ? "warning" : "success"}>
                        {Math.round(pct)}%
                      </Badge>
                    </div>
                    <Progress pct={pct} tier={tier} />
                    <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                      <span>{fmtHours(used)} h used</span>
                      <span>{fmtHours(j.budgetedHours)} h budget</span>
                    </div>
                    {j.quantity > 1 && (() => {
                      const perUnitBudget = j.budgetedHours / j.quantity;
                      const m = unitHoursByJob.get(j.id) ?? new Map<number, number>();
                      return (
                        <div className="space-y-1.5 border-t pt-2">
                          {Array.from({ length: j.quantity }, (_, i) => {
                            const n = i + 1;
                            const u = m.get(n) ?? 0;
                            const uTier = budgetTier(u, perUnitBudget);
                            const uPct = perUnitBudget > 0 ? (u / perUnitBudget) * 100 : 0;
                            return (
                              <div key={n} className="space-y-0.5">
                                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                                  <span>Unit {n}/{j.quantity}</span>
                                  <span>{fmtHours(u)} / {fmtHours(perUnitBudget)} h</span>
                                </div>
                                <Progress pct={uPct} tier={uTier} />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-foreground">Recent uploads</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/review">
              <ClipboardCheck className="h-4 w-4" /> Review queue
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No uploads yet.</p>
          ) : (
            recent.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  {u.status === "needs_review" && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u.employee?.name ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(u.date)} . {u._count.entries} row{u._count.entries === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <StatusBadge status={u.status} />
                  {u.status !== "extracting" && (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/review/${u.id}`}>Open</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <TodaySubmissionsCard
        dateIso={today.dateIso}
        hour={today.hour}
        afterCutoff={afterCutoff}
        totalActive={activeEmployees.length}
        submittedCount={submittedCount}
        missing={missingToday}
        roster={roster}
        officeReady={officeReady}
      />
    </div>
  );
}

function TodaySubmissionsCard({
  dateIso,
  hour,
  afterCutoff,
  totalActive,
  submittedCount,
  missing,
  roster,
  officeReady,
}: {
  dateIso: string;
  hour: number;
  afterCutoff: boolean;
  totalActive: number;
  submittedCount: number;
  missing: { id: string; name: string }[];
  roster: RosterMember[];
  officeReady: boolean;
}) {
  const allIn = missing.length === 0 && totalActive > 0;
  const alarm = afterCutoff && missing.length > 0;
  const borderTone = allIn ? "border-emerald-300" : alarm ? "border-red-300" : "border-amber-300";
  const Icon = allIn ? CalendarCheck : CalendarX;
  const iconTone = allIn ? "text-emerald-600" : alarm ? "text-red-600" : "text-amber-600";

  return (
    <Card className={borderTone}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-foreground">
          <Icon className={`h-4 w-4 shrink-0 ${iconTone}`} />
          <span className="truncate">Today&apos;s submissions . {dateIso}</span>
        </CardTitle>
        <div className="shrink-0">
          <EmailToOfficeDropdown roster={roster} officeReady={officeReady} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
          <span className="text-2xl font-bold tabular-nums">
            {submittedCount}
            <span className="text-base font-normal text-muted-foreground"> / {totalActive} submitted</span>
          </span>
          {missing.length > 0 ? (
            <span className={`font-medium ${alarm ? "text-red-700" : "text-amber-700"}`}>{missing.length} missing</span>
          ) : (
            totalActive > 0 && <span className="font-medium text-emerald-700">Everyone in.</span>
          )}
        </div>

        {missing.length > 0 && (
          <div className="text-sm">
            <span className="text-muted-foreground">Missing today: </span>
            <span className={alarm ? "font-medium text-red-800" : "text-foreground"}>
              {missing.map((m) => m.name).join(", ")}
            </span>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {afterCutoff
            ? `Past the 6 PM Eastern cutoff (now ${formatHour(hour)}). Anyone listed above did not turn in a sheet for today.`
            : `6 PM Eastern cutoff has not passed yet (now ${formatHour(hour)}). Some welders may still be turning in sheets.`}
        </div>
      </CardContent>
    </Card>
  );
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${ampm}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="success">approved</Badge>;
  if (status === "extracting") return <Badge variant="muted">extracting</Badge>;
  if (status === "uploaded") return <Badge variant="danger">extract failed</Badge>;
  return <Badge variant="warning">needs review</Badge>;
}

