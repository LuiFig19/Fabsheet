import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { rangeFor } from "@/lib/queries";
import { getTenantContext, scopeWhere } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Payroll-ready CSV: approved hours per employee per day for a date range,
 * shaped for a QuickBooks "Time by Employee" import (Employee, Date, Hours),
 * plus a per-employee total row. This is the last manual re-keying step HR
 * does today; this kills it.
 */
export async function GET(req: NextRequest) {
  const ctx = await getTenantContext();
  const sp = req.nextUrl.searchParams;
  const { start, end } = rangeFor(sp.get("preset") ?? "week", sp.get("start") ?? undefined, sp.get("end") ?? undefined);

  const entries = await prisma.timesheetEntry.findMany({
    where: { ...scopeWhere(ctx), status: "approved", upload: { date: { gte: start, lt: end } } },
    include: { employee: true, upload: { select: { date: true } } },
  });

  // employee -> day -> hours
  const map = new Map<string, Map<string, number>>();
  for (const e of entries) {
    const name = e.employee?.name ?? "Unknown";
    const day = e.upload.date.toISOString().slice(0, 10);
    if (!map.has(name)) map.set(name, new Map());
    const m = map.get(name)!;
    m.set(day, (m.get(day) ?? 0) + e.decimalHours);
  }

  const rows: string[] = [["Employee", "Date", "Hours"].join(",")];
  for (const [name, days] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let total = 0;
    for (const [day, hours] of [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      total += hours;
      rows.push([csvCell(name), day, hours.toFixed(2)].join(","));
    }
    rows.push([csvCell(name), "TOTAL", total.toFixed(2)].join(","));
  }

  const csv = rows.join("\r\n");
  const fname = `payroll-${start.toISOString().slice(0, 10)}_to_${new Date(end.getTime() - 1).toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
