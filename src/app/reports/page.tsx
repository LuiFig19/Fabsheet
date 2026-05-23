import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildReport } from "@/lib/report";
import { prisma } from "@/lib/db";
import { fmtHours } from "@/lib/utils";
import { getTenantContext, tenantWhere } from "@/lib/tenant";
import { ReportControls } from "./report-controls";

export const dynamic = "force-dynamic";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; group?: string; start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const preset = sp.preset ?? "week";
  const group = (sp.group ?? "job") as "job" | "employee" | "code";

  const ctx = await getTenantContext();
  const [data, company] = await Promise.all([
    buildReport(ctx, preset, group, sp.start, sp.end),
    prisma.company.findFirst({ where: tenantWhere(ctx) }),
  ]);

  const query = new URLSearchParams({ preset, group, ...(sp.start ? { start: sp.start } : {}), ...(sp.end ? { end: sp.end } : {}) }).toString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Approved hours only. {data.startLabel} to {data.endLabel}. {data.rowCount} rows, {fmtHours(data.grandTotal)} hours.
        </p>
      </div>

      <ReportControls
        presets={PRESETS}
        preset={preset}
        group={group}
        start={sp.start ?? ""}
        end={sp.end ?? ""}
        query={query}
        defaultEmailTo={company?.defaultEmailTo ?? ""}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">
            Time by {group === "job" ? "Job" : group === "employee" ? "Employee" : "Labor Code"} Detail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No approved hours in this range.</p>
          ) : (
            data.groups.map((g) => (
              <div key={g.key}>
                <div className="mb-1 flex items-center justify-between rounded bg-navy px-3 py-1.5 text-sm font-semibold text-navy-foreground">
                  <span>{g.label}</span>
                  <span className="tabular-nums">{fmtHours(g.subtotal)} h</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Work order</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums">{r.date}</TableCell>
                        <TableCell className="font-medium">{r.employee}</TableCell>
                        <TableCell>{r.workOrder || "—"}</TableCell>
                        <TableCell>{r.code || "—"}</TableCell>
                        <TableCell>{r.description || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtHours(r.hours)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
          {data.groups.length > 0 && (
            <div className="flex justify-end border-t pt-3 text-base font-bold">
              Grand total: <span className="ml-2 tabular-nums">{fmtHours(data.grandTotal)} h</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
