import { prisma } from "@/lib/db";
import { rangeFor } from "@/lib/queries";
import { scopeWhere, type TenantContext } from "@/lib/tenant";

export type ReportRow = {
  date: string; // YYYY-MM-DD
  employee: string;
  workOrder: string;
  customer: string;
  unit: string; // "1/2" or ""
  description: string;
  code: string;
  hours: number;
  notes: string;
};

export type ReportGroup = {
  key: string;
  label: string;
  rows: ReportRow[];
  subtotal: number;
};

export type ReportData = {
  preset: string;
  groupBy: "job" | "employee" | "code";
  startLabel: string;
  endLabel: string;
  groups: ReportGroup[];
  grandTotal: number;
  rowCount: number;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Build a Time-by-X report from APPROVED entries only, within a date range. */
export async function buildReport(
  ctx: TenantContext,
  preset: string,
  groupBy: "job" | "employee" | "code",
  customStart?: string,
  customEnd?: string,
): Promise<ReportData> {
  const { start, end } = rangeFor(preset, customStart, customEnd);

  const entries = await prisma.timesheetEntry.findMany({
    where: { ...scopeWhere(ctx), status: "approved", upload: { date: { gte: start, lt: end } } },
    include: { employee: true, upload: true, job: true },
    orderBy: { upload: { date: "asc" } },
  });

  const rows: ReportRow[] = entries.map((e) => ({
    date: iso(e.upload.date),
    employee: e.employee?.name ?? "Unknown",
    workOrder: e.workOrderNumber,
    // Always prefer the live Job.customerName (the snapshot on the entry can
    // be stale if the job's customer was renamed later).
    customer: e.job?.customerName || e.customerName || "",
    unit: e.unitNumber != null ? `${e.unitNumber}${e.unitTotal != null ? `/${e.unitTotal}` : ""}` : "",
    description: e.description,
    code: e.laborCode,
    hours: e.decimalHours,
    notes: e.notes,
  }));

  const keyFor = (r: ReportRow) =>
    groupBy === "job"
      ? `${r.workOrder} ${r.customer}`.trim() || "Unassigned"
      : groupBy === "employee"
        ? r.employee
        : r.code || "No code";

  const map = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const k = keyFor(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }

  const groups: ReportGroup[] = [...map.entries()]
    .map(([key, rs]) => ({
      key,
      label: key,
      rows: rs,
      subtotal: rs.reduce((s, r) => s + r.hours, 0),
    }))
    .sort((a, b) => b.subtotal - a.subtotal);

  return {
    preset,
    groupBy,
    startLabel: iso(start),
    endLabel: iso(new Date(end.getTime() - 1)),
    groups,
    grandTotal: rows.reduce((s, r) => s + r.hours, 0),
    rowCount: rows.length,
  };
}

/** Flat CSV: Date, Employee, Work Order, Customer, Unit, Description, Code, Decimal Hours, Notes, Approved. */
export function reportToCsv(data: ReportData): string {
  const cell = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Date", "Employee", "Work Order", "Customer", "Unit", "Description", "Code", "Decimal Hours", "Notes", "Approved"];
  const lines = [header.join(",")];
  for (const g of data.groups) {
    for (const r of g.rows) {
      lines.push(
        [r.date, r.employee, r.workOrder, r.customer, r.unit, r.description, r.code, r.hours.toFixed(2), r.notes, "Yes"]
          .map(cell)
          .join(","),
      );
    }
  }
  return lines.join("\r\n");
}
