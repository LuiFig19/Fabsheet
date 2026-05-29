"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn, fmtHours } from "@/lib/utils";
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import type { EmployeeBreakdown, WeekBreakdown } from "@/lib/production";

type SortKey = "shortfall" | "name" | "productive";
type FilterKey = "all" | "under" | "ontrack";

const STATUS_LABEL = { under: "Under target", met: "On target", over: "Over target" } as const;

export function ProductionBreakdownView({
  weeks,
  target,
  singleWeek,
}: {
  weeks: WeekBreakdown[];
  target: number;
  singleWeek: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("shortfall");
  const [filter, setFilter] = useState<FilterKey>("all");

  if (weeks.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No weeks in this range.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Sort by</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-44">
            <option value="shortfall">Biggest shortfall</option>
            <option value="name">Name</option>
            <option value="productive">Productive hours</option>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Show</span>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)} className="w-44">
            <option value="all">Everyone</option>
            <option value="under">Under target</option>
            <option value="ontrack">On / over target</option>
          </Select>
        </label>
      </div>

      {weeks.map((w) => (
        <WeekSection key={w.weekStart} week={w} target={target} sort={sort} filter={filter} showHeader={!singleWeek} />
      ))}
    </div>
  );
}

function WeekSection({
  week,
  target,
  sort,
  filter,
  showHeader,
}: {
  week: WeekBreakdown;
  target: number;
  sort: SortKey;
  filter: FilterKey;
  showHeader: boolean;
}) {
  const employees = useMemo(() => {
    const filtered = week.employees.filter((e) => {
      if (filter === "under") return e.status === "under";
      if (filter === "ontrack") return e.status !== "under";
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "productive") return b.productive - a.productive;
      if (a.shortfall !== b.shortfall) return b.shortfall - a.shortfall;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [week.employees, sort, filter]);

  const underCount = week.employees.filter((e) => e.status === "under").length;

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-navy px-3 py-2 text-sm font-semibold text-navy-foreground">
          <span>Week of {week.weekStart} - {week.weekEndLabel}</span>
          <span className="tabular-nums">
            {fmtHours(week.totalProductive)} h productive . {underCount} under target
          </span>
        </div>
      )}
      {employees.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No employees match this filter.</p>
      ) : (
        <div className="space-y-2">
          {employees.map((e) => (
            <EmployeeRow key={e.employeeId} emp={e} target={target} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeRow({ emp, target }: { emp: EmployeeBreakdown; target: number }) {
  const [open, setOpen] = useState(false);
  const pct = target > 0 ? Math.min(100, Math.max(0, (emp.productive / target) * 100)) : 0;
  const under = emp.status === "under";
  const over = emp.status === "over";
  const bar = under ? "bg-red-500" : "bg-emerald-500";

  return (
    <Card className={cn(under ? "border-red-200" : "border-border")}>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40"
          aria-expanded={open}
        >
          <span className="text-muted-foreground">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{emp.name}</span>
              <Badge variant={under ? "danger" : "success"} className="gap-1">
                {under ? <AlertTriangle className="h-3 w-3" /> : over ? <TrendingUp className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                {STATUS_LABEL[emp.status]}
              </Badge>
              {over && (
                <span className="text-xs text-emerald-700">+{fmtHours(emp.productive - target)} h over (fine)</span>
              )}
              {under && (
                <span className="text-xs font-medium text-red-700">{fmtHours(emp.shortfall)} h short</span>
              )}
            </div>
            <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-lg font-bold tabular-nums">
              {fmtHours(emp.productive)}
              <span className="text-sm font-normal text-muted-foreground"> / {target} h</span>
            </div>
            {emp.nonProductive > 0 && (
              <div className="text-xs text-muted-foreground tabular-nums">+{fmtHours(emp.nonProductive)} h non-prod</div>
            )}
          </div>
        </button>

        {open && (
          <div className="border-t px-4 py-4">
            {under && emp.reasons.length > 0 && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-800">Why under {target} h</div>
                <ul className="space-y-0.5 text-sm text-red-900">
                  {emp.reasons.map((r, i) => (
                    <li key={i}>. {r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              {emp.days.map((d) => (
                <DayDetail key={d.key} day={d} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DayDetail({ day }: { day: import("@/lib/production").DayBreakdown }) {
  const empty = !day.hasEntries;
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="w-9 text-sm font-semibold">{day.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{day.key}</span>
        </div>
        {empty ? (
          <span className={cn("text-xs", day.isWorkday ? "font-medium text-red-700" : "text-muted-foreground")}>
            {day.isWorkday ? "No time submitted" : "-"}
          </span>
        ) : (
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="text-emerald-700">{fmtHours(day.productive)} h prod</span>
            {day.nonProductive > 0 && <span className="text-amber-700">{fmtHours(day.nonProductive)} h non-prod</span>}
          </div>
        )}
      </div>
      {!empty && (
        <ul className="divide-y border-t text-sm">
          {day.entries.map((e, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span
                className={cn(
                  "inline-block h-2 w-2 shrink-0 rounded-full",
                  e.productive ? "bg-emerald-500" : "bg-amber-500",
                )}
                aria-hidden
              />
              <span className="tabular-nums text-muted-foreground">
                {e.start || "??"}-{e.end || "??"}
              </span>
              <span className="font-medium">{e.description || e.code || "(no task)"}</span>
              {e.job && <span className="text-muted-foreground">. {e.job}</span>}
              <span className="ml-auto font-semibold tabular-nums">{fmtHours(e.hours)} h</span>
              {!e.productive && <Badge variant="warning" className="text-[10px]">non-prod</Badge>}
              {e.notes && <span className="w-full text-xs text-muted-foreground">{e.notes}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
