import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { detectAnomalies } from "@/lib/anomalies";
import { getTenantContext, scopeWhere, tenantWhere } from "@/lib/tenant";
import {
  fmtHours,
  formatDate,
  nonProductiveCodeWhere,
  productiveCodeWhere,
  workWeekProgress,
} from "@/lib/utils";
import { ProductionGoalCard } from "@/components/production-goal-card";
import { AlertTriangle, BarChart3, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export default async function AttentionPage() {
  const ctx = await getTenantContext();
  const s = scopeWhere(ctx);
  const { weekStart, weekEnd, daysRemaining, onWeekend } = workWeekProgress();

  const [company, productiveAgg, supportAgg, weekProductiveEntries, anomalies] = await Promise.all([
    prisma.company.findFirst({ where: tenantWhere(ctx) }),
    prisma.timesheetEntry.aggregate({
      where: { ...s, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...productiveCodeWhere },
      _sum: { decimalHours: true },
    }),
    prisma.timesheetEntry.aggregate({
      where: { ...s, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...nonProductiveCodeWhere },
      _sum: { decimalHours: true },
    }),
    // Per-day productive hours for the chart. One row per entry; bucketing in
    // memory is cheaper than five aggregate queries at this volume.
    prisma.timesheetEntry.findMany({
      where: { ...s, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...productiveCodeWhere },
      select: { decimalHours: true, upload: { select: { date: true } } },
    }),
    detectAnomalies(ctx),
  ]);

  const productionTarget = company?.weeklyProductionTarget ?? 850;
  const productiveThisWeek = productiveAgg._sum.decimalHours ?? 0;
  const supportThisWeek = supportAgg._sum.decimalHours ?? 0;
  const productivePct = productionTarget > 0 ? (productiveThisWeek / productionTarget) * 100 : 0;
  const remainingHours = Math.max(0, productionTarget - productiveThisWeek);
  const perDay = daysRemaining > 0 ? remainingHours / daysRemaining : 0;
  const onTrack = productivePct >= 100;

  // Build the Mon-Fri productive-hours buckets in UTC (matches how dates are
  // stored — noon UTC by parseHeaderDate).
  const dailyTotals = [0, 0, 0, 0, 0]; // Mon..Fri
  const weekStartUtcMs = Date.UTC(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate(),
  );
  for (const e of weekProductiveEntries) {
    const d = e.upload.date;
    const dayUtcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const idx = Math.floor((dayUtcMs - weekStartUtcMs) / (24 * 60 * 60 * 1000));
    if (idx >= 0 && idx <= 4) dailyTotals[idx] += e.decimalHours;
  }
  const dailyTarget = productionTarget / 5;
  const chartMax = Math.max(dailyTarget * 1.2, ...dailyTotals, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Needs Attention</h1>
        <p className="text-sm text-muted-foreground">
          Week of {formatDate(weekStart)}. Where the shop stands against this week&apos;s production goal, plus anything flagged for follow-up.
        </p>
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <BarChart3 className="h-4 w-4" /> Productivity this week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Approved productive hours per day. Target {fmtHours(dailyTarget)} h/day ({productionTarget} h spread Mon-Fri).
          </p>
          <ul className="space-y-2">
            {DAY_LABELS.map((label, i) => {
              const value = dailyTotals[i];
              const pct = Math.min(100, (value / chartMax) * 100);
              const targetPct = Math.min(100, (dailyTarget / chartMax) * 100);
              const hitTarget = value >= dailyTarget;
              const barColor = hitTarget ? "bg-emerald-500" : value > 0 ? "bg-amber-500" : "bg-muted";
              return (
                <li key={label} className="grid grid-cols-[2.5rem_1fr_4.5rem] items-center gap-3">
                  <span className="text-sm font-medium tabular-nums">{label}</span>
                  <div className="relative h-3 overflow-visible rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                    <div
                      className="absolute top-[-3px] h-[18px] w-0.5 bg-foreground/40"
                      style={{ left: `${targetPct}%` }}
                      aria-label={`Target ${fmtHours(dailyTarget)} h`}
                    />
                  </div>
                  <span className="text-right text-sm tabular-nums">
                    {fmtHours(value)} h
                    {value > 0 && (
                      <span className={`ml-1 text-xs ${hitTarget ? "text-emerald-600" : "text-amber-700"}`}>
                        {hitTarget ? "" : `(-${fmtHours(dailyTarget - value)})`}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className={anomalies.length > 0 ? "border-amber-300" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-foreground">
            {anomalies.length > 0 ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            Notices ({anomalies.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {anomalies.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">All clear. Nothing flagged this week.</p>
          ) : (
            anomalies.map((a, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm">
                <Badge variant={a.severity === "warn" ? "warning" : "muted"}>
                  {a.kind.replace("_", " ")}
                </Badge>
                <span className="text-amber-950">{a.message}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
