import { prisma } from "@/lib/db";
import { scopeWhere, type TenantContext } from "@/lib/tenant";

export type Anomaly = {
  kind: "long_day" | "silence" | "job_jump" | "overlap";
  severity: "warn" | "info";
  message: string;
};

function toMin(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Lightweight anomaly checks. Cheap to compute every dashboard load. None of
 * these block anything; they surface as small badges + a "Needs attention"
 * list. The thresholds are intentionally lenient so the list stays useful.
 */
export async function detectAnomalies(ctx: TenantContext): Promise<Anomaly[]> {
  const s = scopeWhere(ctx);
  const now = new Date();
  const out: Anomaly[] = [];

  // ---- Long days: any employee logging >12 approved hours in a single day,
  //      in the last 14 days.
  const sinceTwoWeeks = new Date(now);
  sinceTwoWeeks.setDate(sinceTwoWeeks.getDate() - 14);
  const recentEntries = await prisma.timesheetEntry.findMany({
    where: { ...s, status: "approved", upload: { date: { gte: sinceTwoWeeks } } },
    select: {
      decimalHours: true,
      startTime: true,
      endTime: true,
      employee: { select: { name: true } },
      upload: { select: { date: true } },
    },
  });
  const byEmpDay = new Map<string, number>();
  for (const e of recentEntries) {
    const name = e.employee?.name ?? "Unknown";
    const day = e.upload.date.toISOString().slice(0, 10);
    const key = `${name}|${day}`;
    byEmpDay.set(key, (byEmpDay.get(key) ?? 0) + e.decimalHours);
  }
  for (const [key, hours] of byEmpDay) {
    if (hours > 12) {
      const [name, day] = key.split("|");
      out.push({
        kind: "long_day",
        severity: "warn",
        message: `${name} logged ${hours.toFixed(1)} h on ${day}. Confirm the start/end times.`,
      });
    }
  }

  // ---- Silence: an employee who logged in the past 14 days but not in the
  //      last 5. Catches someone who stopped submitting sheets.
  const empLastEntry = new Map<string, { name: string; last: Date }>();
  for (const e of recentEntries) {
    const empName = e.employee?.name ?? "Unknown";
    const last = empLastEntry.get(empName);
    if (!last || e.upload.date > last.last) empLastEntry.set(empName, { name: empName, last: e.upload.date });
  }
  const fiveDaysAgo = new Date(now);
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  for (const { name, last } of empLastEntry.values()) {
    if (last < fiveDaysAgo) {
      const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      out.push({
        kind: "silence",
        severity: "info",
        message: `${name} has not submitted a sheet in ${days} day${days === 1 ? "" : "s"} (last on ${last.toISOString().slice(0, 10)}).`,
      });
    }
  }

  // ---- Job jump: any job whose approved hours grew by >25% in the last 24h.
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const jobs = await prisma.job.findMany({
    where: { ...s, status: "active" },
    select: { id: true, workOrderNumber: true, customerName: true },
  });
  for (const j of jobs) {
    const total = await prisma.timesheetEntry.aggregate({
      where: { ...s, status: "approved", jobId: j.id },
      _sum: { decimalHours: true },
    });
    const recent = await prisma.timesheetEntry.aggregate({
      where: { ...s, status: "approved", jobId: j.id, approvedAt: { gte: yesterday } },
      _sum: { decimalHours: true },
    });
    const t = total._sum.decimalHours ?? 0;
    const r = recent._sum.decimalHours ?? 0;
    const baseline = t - r; // hours that existed BEFORE the last 24h
    // Need a real baseline (>10h) or this just lights up every new job at 100%.
    if (baseline > 10 && r / baseline > 0.25) {
      out.push({
        kind: "job_jump",
        severity: "info",
        message: `Job ${j.workOrderNumber} (${j.customerName || "?"}) added ${r.toFixed(1)} h in the last 24h, +${Math.round((r / baseline) * 100)}% over prior ${baseline.toFixed(1)} h.`,
      });
    }
  }

  // ---- Overlapping times: same employee, same day, two entries whose
  //      start/end ranges overlap (double-logged hours). Pure data-integrity
  //      check, no surveillance angle.
  const byEmpDayEntries = new Map<string, { start: number; end: number }[]>();
  for (const e of recentEntries) {
    const start = toMin(e.startTime);
    const end = toMin(e.endTime);
    if (start == null || end == null || end <= start) continue;
    const name = e.employee?.name ?? "Unknown";
    const day = e.upload.date.toISOString().slice(0, 10);
    const key = `${name}|${day}`;
    if (!byEmpDayEntries.has(key)) byEmpDayEntries.set(key, []);
    byEmpDayEntries.get(key)!.push({ start, end });
  }
  for (const [key, ranges] of byEmpDayEntries) {
    ranges.sort((a, b) => a.start - b.start);
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i]!.start < ranges[i - 1]!.end) {
        const [name, day] = key.split("|");
        out.push({
          kind: "overlap",
          severity: "warn",
          message: `${name} has overlapping time entries on ${day}. Two tasks share the same hours.`,
        });
        break; // one flag per employee-day is enough
      }
    }
  }

  return out;
}
