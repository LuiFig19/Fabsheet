import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buildProductionBreakdown, resolveProductionRange, PER_EMPLOYEE_WEEKLY_TARGET } from "@/lib/production";
import { getTenantContext } from "@/lib/tenant";
import { fmtHours, formatDate } from "@/lib/utils";
import { ProductionControls } from "./production-controls";
import { ProductionBreakdownView } from "./production-view";
import { ArrowLeft, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getTenantContext();
  const range = resolveProductionRange({ week: sp.week, start: sp.start, end: sp.end });
  const data = await buildProductionBreakdown(ctx, range);

  const rangeMode = Boolean(sp.start && sp.end);
  const weekStart = data.weeks[0]?.weekStart ?? data.startLabel;
  const query = new URLSearchParams(
    rangeMode ? { start: sp.start!, end: sp.end! } : sp.week ? { week: sp.week } : { week: weekStart },
  ).toString();

  // Roll-up across the whole shown range.
  const allEmployees = data.weeks.flatMap((w) => w.employees);
  const underTarget = allEmployees.filter((e) => e.status === "under").length;
  const onOrOver = allEmployees.length - underTarget;
  const totalProductive = data.weeks.reduce((a, w) => a + w.totalProductive, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Production breakdown</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.singleWeek
            ? `Week of ${formatDate(weekStart)}.`
            : `${formatDate(data.startLabel)} to ${formatDate(data.endLabel)}.`}{" "}
          Target {PER_EMPLOYEE_WEEKLY_TARGET} productive hours per employee each week. Approved hours only - nothing estimated.
        </p>
      </div>

      <ProductionControls weekStart={weekStart} start={sp.start ?? ""} end={sp.end ?? ""} query={query} rangeMode={rangeMode} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Employees" value={String(data.employeeCount)} />
        <StatCard label="On / over target" value={String(onOrOver)} tone="good" />
        <StatCard label="Under target" value={String(underTarget)} tone={underTarget > 0 ? "bad" : "good"} />
        <StatCard label="Productive hours" value={fmtHours(totalProductive)} />
      </div>

      <ProductionBreakdownView weeks={data.weeks} target={data.target} singleWeek={data.singleWeek} />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={`mt-1 text-2xl font-bold tabular-nums ${
            tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-600" : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
