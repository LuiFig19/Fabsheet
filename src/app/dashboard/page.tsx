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
  fmtHours,
  formatDate,
  workWeekProgress,
  productiveCodeWhere,
  nonProductiveCodeWhere,
} from "@/lib/utils";
import { Upload, ClipboardCheck, AlertTriangle, ArrowRight, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getTenantContext();
  const s = scopeWhere(ctx);
  const { weekStart, weekEnd, daysRemaining, onWeekend } = workWeekProgress();

  const [jobs, usedByJob, productiveAgg, supportAgg, jobsInProgress, needsReviewCount, recent, company] = await Promise.all([
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
  ]);

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
              <div key={u.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  {u.status === "needs_review" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  <div>
                    <div className="text-sm font-medium">{u.employee?.name ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(u.date)} . {u._count.entries} row{u._count.entries === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="success">approved</Badge>;
  if (status === "extracting") return <Badge variant="muted">extracting</Badge>;
  if (status === "uploaded") return <Badge variant="danger">extract failed</Badge>;
  return <Badge variant="warning">needs review</Badge>;
}

function ProductionGoalCard({
  target, productive, support, pct, remaining, perDay, daysRemaining, onWeekend, onTrack,
}: {
  target: number; productive: number; support: number; pct: number;
  remaining: number; perDay: number; daysRemaining: number; onWeekend: boolean; onTrack: boolean;
}) {
  // Visual tier mirrors the job-progress colors.
  const tier: "green" | "yellow" | "red" =
    onTrack ? "green" : pct >= 75 ? "yellow" : daysRemaining <= 2 ? "red" : "yellow";
  const bar = tier === "green" ? "bg-emerald-500" : tier === "yellow" ? "bg-amber-500" : "bg-red-500";
  const headline = onTrack
    ? `Target hit - ${fmtHours(productive - target)} h over the line.`
    : onWeekend
      ? `Work week is over. ${remaining > 0 ? `Missed by ${fmtHours(remaining)} h.` : "Goal hit."} Next week starts Monday at 0 / ${target}.`
      : daysRemaining === 0
        ? `End of Friday. ${remaining > 0 ? `Short ${fmtHours(remaining)} h on this week.` : "Goal hit."}`
        : `Need ${fmtHours(remaining)} more production hours by Friday - ${fmtHours(perDay)} h/day across ${daysRemaining} working day${daysRemaining === 1 ? "" : "s"} left.`;

  return (
    <Card className={tier === "red" ? "border-red-300" : tier === "yellow" ? "border-amber-300" : "border-emerald-300"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Target className="h-4 w-4" /> Weekly production goal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-2xl font-bold tabular-nums sm:text-3xl">
            {fmtHours(productive)}
            <span className="text-base font-normal text-muted-foreground"> / {target} h</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtHours(support)} h non-production this week (machine repair, forklift, wash, admin)
          </div>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${bar} transition-all`}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={tier === "green" ? "success" : tier === "yellow" ? "warning" : "danger"}>
            {Math.round(pct)}%
          </Badge>
          <span className={tier === "red" ? "font-medium text-red-700" : "text-foreground"}>{headline}</span>
        </div>
      </CardContent>
    </Card>
  );
}
