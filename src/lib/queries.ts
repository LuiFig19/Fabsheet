import { prisma } from "@/lib/db";
import { scopeWhere, type TenantContext } from "@/lib/tenant";

/** Approved decimal hours grouped by jobId. Only approved entries count. */
export async function approvedHoursByJob(ctx: TenantContext): Promise<Map<string, number>> {
  const grouped = await prisma.timesheetEntry.groupBy({
    by: ["jobId"],
    where: { ...scopeWhere(ctx), status: "approved", jobId: { not: null } },
    _sum: { decimalHours: true },
  });
  const m = new Map<string, number>();
  for (const g of grouped) if (g.jobId) m.set(g.jobId, g._sum.decimalHours ?? 0);
  return m;
}

export function weekRange(ref = new Date()) {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  // Monday as week start.
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function rangeFor(preset: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  switch (preset) {
    case "today":
      return { start, end };
    case "week":
      return weekRange(now);
    case "month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start: s, end: e };
    }
    case "year": {
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now.getFullYear() + 1, 0, 1);
      return { start: s, end: e };
    }
    case "custom": {
      const s = customStart ? new Date(customStart) : start;
      const e = customEnd ? new Date(customEnd) : end;
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    default:
      return weekRange(now);
  }
}
