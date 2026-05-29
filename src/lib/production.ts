import { prisma } from "@/lib/db";
import { scopeWhere, type TenantContext } from "@/lib/tenant";
import { isProductiveCode } from "@/lib/utils";

/**
 * Per-employee weekly productive-hours target. The dashboard's shop-wide goal
 * (Company.weeklyProductionTarget, default 850) is the sum across the crew;
 * this is the per-head line each employee is measured against.
 */
export const PER_EMPLOYEE_WEEKLY_TARGET = 40;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// Dates are stored at noon UTC (see parseHeaderDate in lib/mapping). Bucketing
// in UTC keeps day/week boundaries stable regardless of the server timezone.
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function mondayOfUtc(d: Date): Date {
  const day = startOfUtcDay(d);
  const dow = (day.getUTCDay() + 6) % 7; // 0=Mon .. 6=Sun
  day.setUTCDate(day.getUTCDate() - dow);
  return day;
}
function addDaysUtc(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
/** A date string "YYYY-MM-DD" -> Date at noon UTC (avoids tz drift). */
function parseDateParam(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ProdEntry = {
  productive: boolean;
  code: string; // labor code label, e.g. "240 Welding Machine Repair"
  description: string; // bubble label, e.g. "Forklift" / "Frame"
  job: string; // "4354 Acme Marine" or ""
  start: string; // HH:MM
  end: string;
  hours: number;
  notes: string;
};

export type DayBreakdown = {
  key: string; // YYYY-MM-DD
  label: string; // "Mon"
  weekday: number; // 0=Mon .. 6=Sun
  isWorkday: boolean; // Mon-Fri
  hasEntries: boolean; // false => "no time submitted"
  productive: number;
  nonProductive: number;
  entries: ProdEntry[];
};

export type EmployeeBreakdown = {
  employeeId: string;
  name: string;
  productive: number;
  nonProductive: number;
  total: number;
  status: "under" | "met" | "over";
  shortfall: number; // hours below target, 0 when on/over
  /** Human reasons assembled from real data: non-productive time + days with
   *  no submission. Never invented. */
  reasons: string[];
  days: DayBreakdown[]; // always 7, Mon..Sun
};

export type WeekBreakdown = {
  weekStart: string; // Monday YYYY-MM-DD
  weekEndLabel: string; // Sunday YYYY-MM-DD
  employees: EmployeeBreakdown[];
  totalProductive: number;
  totalNonProductive: number;
};

export type ProductionBreakdown = {
  target: number;
  startLabel: string; // first Monday
  endLabel: string; // last Sunday
  singleWeek: boolean;
  weeks: WeekBreakdown[];
  employeeCount: number;
};

export type ProductionRange = { start: Date; end: Date; singleWeek: boolean };

/**
 * Resolve query params to a whole-week range [start, end). `week` selects one
 * week (snapped to its Monday). `start`+`end` select a custom span, expanded
 * outward to whole Mon-Sun weeks so every section uses the same layout. No
 * params -> the current week.
 */
export function resolveProductionRange(p: { week?: string; start?: string; end?: string }): ProductionRange {
  const customStart = parseDateParam(p.start);
  const customEnd = parseDateParam(p.end);
  if (customStart && customEnd) {
    const start = mondayOfUtc(customStart);
    const end = addDaysUtc(mondayOfUtc(customEnd), 7); // include the end date's full week
    if (end <= start) return { start, end: addDaysUtc(start, 7), singleWeek: true };
    const singleWeek = (end.getTime() - start.getTime()) / (7 * 86400000) <= 1;
    return { start, end, singleWeek };
  }
  const ref = parseDateParam(p.week) ?? new Date();
  const start = mondayOfUtc(ref);
  return { start, end: addDaysUtc(start, 7), singleWeek: true };
}

function jobLabel(workOrder: string, customer: string): string {
  const wo = (workOrder ?? "").trim();
  const c = (customer ?? "").trim();
  if (wo && c) return `${wo} ${c}`;
  return wo || c || "";
}

/** Build the per-employee, per-week, per-day breakdown from APPROVED entries
 *  in the range. Approved-only mirrors the dashboard production goal so the
 *  totals reconcile. */
export async function buildProductionBreakdown(
  ctx: TenantContext,
  range: ProductionRange,
): Promise<ProductionBreakdown> {
  const s = scopeWhere(ctx);

  const [employees, entries] = await Promise.all([
    prisma.employee.findMany({
      where: s,
      select: { id: true, name: true, active: true, createdAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.timesheetEntry.findMany({
      where: { ...s, status: "approved", upload: { date: { gte: range.start, lt: range.end } } },
      select: {
        decimalHours: true,
        laborCode: true,
        description: true,
        startTime: true,
        endTime: true,
        notes: true,
        workOrderNumber: true,
        employeeId: true,
        upload: { select: { date: true } },
        job: { select: { workOrderNumber: true, customerName: true } },
      },
    }),
  ]);

  // Index entries by weekStart -> employeeId -> dayKey.
  type Bucket = { entries: ProdEntry[]; date: Date };
  const byWeek = new Map<string, Map<string, Map<string, Bucket>>>();
  const empHadEntryInWeek = new Map<string, Set<string>>(); // weekKey -> Set(empId)

  for (const e of entries) {
    const d = startOfUtcDay(e.upload.date);
    const wk = dayKey(mondayOfUtc(d));
    const dk = dayKey(d);
    const empId = e.employeeId ?? "__unassigned__";

    if (!byWeek.has(wk)) byWeek.set(wk, new Map());
    const wkMap = byWeek.get(wk)!;
    if (!wkMap.has(empId)) wkMap.set(empId, new Map());
    const empMap = wkMap.get(empId)!;
    if (!empMap.has(dk)) empMap.set(dk, { entries: [], date: d });

    const productive = isProductiveCode(e.laborCode);
    empMap.get(dk)!.entries.push({
      productive,
      code: e.laborCode,
      description: e.description,
      job: jobLabel(e.job?.workOrderNumber ?? e.workOrderNumber, e.job?.customerName ?? ""),
      start: e.startTime,
      end: e.endTime,
      hours: e.decimalHours,
      notes: e.notes,
    });

    if (!empHadEntryInWeek.has(wk)) empHadEntryInWeek.set(wk, new Set());
    empHadEntryInWeek.get(wk)!.add(empId);
  }

  // Walk every whole week in the range, in order.
  const weekStarts: Date[] = [];
  for (let d = new Date(range.start); d < range.end; d = addDaysUtc(d, 7)) {
    weekStarts.push(new Date(d));
  }

  const empById = new Map(employees.map((e) => [e.id, e]));
  const weeks: WeekBreakdown[] = weekStarts.map((weekStartDate) => {
    const wk = dayKey(weekStartDate);
    const weekEnd = addDaysUtc(weekStartDate, 7);
    const wkMap = byWeek.get(wk) ?? new Map<string, Map<string, Bucket>>();
    const hadEntry = empHadEntryInWeek.get(wk) ?? new Set<string>();

    // Which employees to show this week: anyone active and already created by
    // the week's end, plus anyone who logged time (covers since-deactivated).
    const showIds = new Set<string>();
    for (const emp of employees) {
      if (emp.active && emp.createdAt < weekEnd) showIds.add(emp.id);
    }
    for (const id of hadEntry) if (id !== "__unassigned__") showIds.add(id);

    const empBreakdowns: EmployeeBreakdown[] = [...showIds].map((empId) => {
      const emp = empById.get(empId);
      const empMap = wkMap.get(empId) ?? new Map<string, Bucket>();

      const days: DayBreakdown[] = DAY_LABELS.map((label, i) => {
        const dayDate = addDaysUtc(weekStartDate, i);
        const dk = dayKey(dayDate);
        const bucket = empMap.get(dk);
        const dayEntries = bucket?.entries ?? [];
        const productive = dayEntries.reduce((a, e) => a + (e.productive ? e.hours : 0), 0);
        const nonProductive = dayEntries.reduce((a, e) => a + (e.productive ? 0 : e.hours), 0);
        return {
          key: dk,
          label,
          weekday: i,
          isWorkday: i <= 4,
          hasEntries: dayEntries.length > 0,
          productive: round2(productive),
          nonProductive: round2(nonProductive),
          entries: dayEntries,
        };
      });

      const productive = round2(days.reduce((a, d) => a + d.productive, 0));
      const nonProductive = round2(days.reduce((a, d) => a + d.nonProductive, 0));
      const total = round2(productive + nonProductive);
      const status: EmployeeBreakdown["status"] =
        productive < PER_EMPLOYEE_WEEKLY_TARGET ? "under" : productive > PER_EMPLOYEE_WEEKLY_TARGET ? "over" : "met";
      const shortfall = round2(Math.max(0, PER_EMPLOYEE_WEEKLY_TARGET - productive));

      return {
        employeeId: empId,
        name: emp?.name ?? "Unassigned",
        productive,
        nonProductive,
        total,
        status,
        shortfall,
        reasons: buildReasons(days),
        days,
      };
    });

    // Default order: under-target first (most shortfall), then by name.
    empBreakdowns.sort((a, b) => {
      if (a.shortfall !== b.shortfall) return b.shortfall - a.shortfall;
      return a.name.localeCompare(b.name);
    });

    return {
      weekStart: wk,
      weekEndLabel: dayKey(addDaysUtc(weekStartDate, 6)),
      employees: empBreakdowns,
      totalProductive: round2(empBreakdowns.reduce((a, e) => a + e.productive, 0)),
      totalNonProductive: round2(empBreakdowns.reduce((a, e) => a + e.nonProductive, 0)),
    };
  });

  return {
    target: PER_EMPLOYEE_WEEKLY_TARGET,
    startLabel: dayKey(range.start),
    endLabel: dayKey(addDaysUtc(range.end, -1)),
    singleWeek: range.singleWeek,
    weeks,
    employeeCount: employees.length,
  };
}

/**
 * Why an employee fell short, assembled only from data that exists:
 *  - non-productive time, grouped by its labor reason (with hours + notes)
 *  - working days (Mon-Fri) with no submission at all
 * Weekend gaps are normal at a day-shift shop and are not listed as reasons.
 */
function buildReasons(days: DayBreakdown[]): string[] {
  const reasons: string[] = [];

  // Group non-productive entries by reason label.
  const byReason = new Map<string, { hours: number; notes: Set<string> }>();
  for (const d of days) {
    for (const e of d.entries) {
      if (e.productive) continue;
      const label = (e.description || e.code || "Other / unspecified").trim();
      if (!byReason.has(label)) byReason.set(label, { hours: 0, notes: new Set() });
      const r = byReason.get(label)!;
      r.hours += e.hours;
      if (e.notes.trim()) r.notes.add(e.notes.trim());
    }
  }
  for (const [label, r] of [...byReason.entries()].sort((a, b) => b[1].hours - a[1].hours)) {
    const note = r.notes.size ? ` - ${[...r.notes].join("; ")}` : "";
    reasons.push(`${label}: ${round2(r.hours).toFixed(2)} h${note}`);
  }

  // Missing working days.
  const missing = days.filter((d) => d.isWorkday && !d.hasEntries).map((d) => d.label);
  if (missing.length) reasons.push(`No time submitted: ${missing.join(", ")}`);

  return reasons;
}

function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100;
}

/**
 * Entry-level CSV. One row per timesheet entry, plus an explicit "No time
 * submitted" row for each Mon-Fri an employee logged nothing. Per-employee
 * weekly totals/status repeat on every row so the file pivots cleanly.
 */
export function productionToCsv(data: ProductionBreakdown): string {
  const cell = (v: string | number) => {
    const str = String(v ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = [
    "Week Start", "Employee", "Date", "Day", "Type", "Code", "Description", "Job",
    "Start", "End", "Hours", "Notes", "Weekly Productive", "Weekly Target", "Weekly Status",
  ];
  const lines = [header.join(",")];
  const statusWord = { under: "Under target", met: "On target", over: "Over target" } as const;

  for (const w of data.weeks) {
    for (const emp of w.employees) {
      const weekly = [emp.productive.toFixed(2), String(data.target), statusWord[emp.status]];
      for (const d of emp.days) {
        if (d.entries.length === 0) {
          if (d.isWorkday) {
            lines.push([
              w.weekStart, emp.name, d.key, d.label, "No time submitted", "", "", "",
              "", "", "0.00", "", ...weekly,
            ].map(cell).join(","));
          }
          continue;
        }
        for (const e of d.entries) {
          lines.push([
            w.weekStart, emp.name, d.key, d.label, e.productive ? "Productive" : "Non-productive",
            e.code, e.description, e.job, e.start, e.end, e.hours.toFixed(2), e.notes, ...weekly,
          ].map(cell).join(","));
        }
      }
    }
  }
  return lines.join("\r\n");
}
