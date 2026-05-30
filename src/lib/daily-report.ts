import { isProductiveCode } from "@/lib/utils";

export type DailyEntry = {
  date: string; // YYYY-MM-DD
  employee: string;
  workOrder: string;
  customer: string;
  laborCode: string;
  description: string;
  startTime: string;
  endTime: string;
  hours: number;
  status: string;
  notes: string;
};

function cell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoToUsDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
}

/**
 * QuickBooks-importable CSV. Columns match the QuickBooks Online Time
 * Activities import (and are compatible with the common QB-bridge tools that
 * read time CSVs). Only APPROVED entries are emitted — sending unapproved
 * hours to payroll is a bigger mistake than sending none.
 */
export function buildQuickbooksCsv(entries: DailyEntry[]): string {
  const header = [
    "Date",
    "Employee",
    "Customer:Job",
    "Service Item",
    "Class",
    "Hours",
    "Description",
    "Billable",
  ];
  const lines = [header.join(",")];
  for (const e of entries) {
    if (e.status !== "approved") continue;
    const customerJob = [e.workOrder, e.customer].filter(Boolean).join(":");
    const desc = [e.description, e.notes].filter(Boolean).join(" - ");
    lines.push(
      [
        isoToUsDate(e.date),
        e.employee,
        customerJob,
        e.laborCode,
        "", // Class blank by default
        e.hours.toFixed(2),
        desc,
        "Yes",
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

type Totals = { productive: number; nonProductive: number; total: number; entryCount: number };

/**
 * Human-readable daily summary CSV (opens directly in Excel). Two sections:
 *  1) per-employee productive vs non-productive vs total
 *  2) every entry from the day with status, so a manager can reconcile
 */
export function buildDailySummaryCsv(entries: DailyEntry[], dateIso: string, companyName: string): string {
  const byEmp = new Map<string, Totals>();
  for (const e of entries) {
    if (!byEmp.has(e.employee)) byEmp.set(e.employee, { productive: 0, nonProductive: 0, total: 0, entryCount: 0 });
    const t = byEmp.get(e.employee)!;
    const isProd = isProductiveCode(e.laborCode);
    if (isProd) t.productive += e.hours;
    else t.nonProductive += e.hours;
    t.total += e.hours;
    t.entryCount += 1;
  }

  const lines: string[] = [];
  lines.push(`Daily summary,${cell(companyName)},${dateIso}`);
  lines.push("");
  lines.push("PER-EMPLOYEE TOTALS");
  lines.push(["Employee", "Productive Hours", "Non-Productive Hours", "Total Hours", "Entries"].join(","));
  const sortedEmps = [...byEmp.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let totalProductive = 0;
  let totalNonProductive = 0;
  for (const [emp, t] of sortedEmps) {
    totalProductive += t.productive;
    totalNonProductive += t.nonProductive;
    lines.push(
      [emp, t.productive.toFixed(2), t.nonProductive.toFixed(2), t.total.toFixed(2), String(t.entryCount)]
        .map(cell)
        .join(","),
    );
  }
  lines.push(
    [
      "GRAND TOTAL",
      totalProductive.toFixed(2),
      totalNonProductive.toFixed(2),
      (totalProductive + totalNonProductive).toFixed(2),
      String(entries.length),
    ]
      .map(cell)
      .join(","),
  );

  lines.push("");
  lines.push("DETAIL");
  lines.push(
    ["Employee", "Date", "Work Order", "Customer", "Code", "Description", "Start", "End", "Hours", "Status", "Notes"].join(","),
  );
  const sortedEntries = [...entries].sort((a, b) => {
    const e = a.employee.localeCompare(b.employee);
    return e !== 0 ? e : a.startTime.localeCompare(b.startTime);
  });
  for (const e of sortedEntries) {
    lines.push(
      [
        e.employee,
        e.date,
        e.workOrder,
        e.customer,
        e.laborCode,
        e.description,
        e.startTime,
        e.endTime,
        e.hours.toFixed(2),
        e.status,
        e.notes,
      ]
        .map(cell)
        .join(","),
    );
  }

  return lines.join("\r\n");
}
