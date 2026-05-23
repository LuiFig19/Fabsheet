import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/lib/db";
import { approvedHoursByJob, weekRange } from "@/lib/queries";
import { getTenantContext, scopeWhere } from "@/lib/tenant";
import { budgetTier, fmtHours, formatDate } from "@/lib/utils";
import { Upload, ClipboardCheck, AlertTriangle, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getTenantContext();
  const s = scopeWhere(ctx);
  const { start, end } = weekRange();

  const [jobs, usedByJob, weekAgg, jobsInProgress, needsReviewCount, recent] = await Promise.all([
    prisma.job.findMany({ where: { ...s, status: "active" }, orderBy: { workOrderNumber: "asc" } }),
    approvedHoursByJob(ctx),
    prisma.timesheetEntry.aggregate({
      where: { ...s, status: "approved", upload: { date: { gte: start, lt: end } } },
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
  ]);

  const hoursThisWeek = weekAgg._sum.decimalHours ?? 0;
  const overBudget = jobs.filter((j) => budgetTier(usedByJob.get(j.id) ?? 0, j.budgetedHours) === "red").length;
  const uploadsNeedingReview = await prisma.timesheetUpload.count({ where: { ...s, status: "needs_review" } });

  const stats = [
    { label: "Hours this week", value: fmtHours(hoursThisWeek) },
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
            Week of {formatDate(start)}. {needsReviewCount} row{needsReviewCount === 1 ? "" : "s"} waiting on review.
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
                className={`text-3xl font-bold tabular-nums ${
                  s.danger ? "text-red-600" : s.warn ? "text-amber-600" : ""
                }`}
              >
                {s.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
