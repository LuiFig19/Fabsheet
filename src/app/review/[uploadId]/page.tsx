import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReviewTable } from "./review-table";
import { HeaderEdit } from "./header-edit";
import { formatDate } from "@/lib/utils";
import { getTenantContext, scopeWhere, tenantWhere } from "@/lib/tenant";
import { TASK_BUBBLES, ACTION_BUBBLES } from "@/lib/extractors/types";
import { AlertTriangle, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;

  const ctx = await getTenantContext();
  const [upload, company, employees, jobs] = await Promise.all([
    prisma.timesheetUpload.findFirst({
      where: { id: uploadId, ...scopeWhere(ctx) },
      include: { employee: true, entries: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.company.findFirst({ where: tenantWhere(ctx) }),
    prisma.employee.findMany({ where: { ...scopeWhere(ctx), active: true }, orderBy: { name: "asc" } }),
    prisma.job.findMany({
      where: scopeWhere(ctx),
      select: { id: true, workOrderNumber: true, customerName: true, quantity: true },
      orderBy: { workOrderNumber: "asc" },
    }),
  ]);
  if (!upload) notFound();

  const threshold = company?.ocrThreshold ?? 0.7;
  const warnings = (upload.warnings as string[] | null) ?? [];

  // Bubble options for the Review dropdown: tasks first, then actions. The
  // welder picks one, the system derives the code.
  const bubbleOptions = [...TASK_BUBBLES, ...ACTION_BUBBLES] as readonly string[];

  // Build per-row context: derive customer + code from the linked job + bubble
  // so the manager never re-enters them. Pull per-row warnings out of the
  // confidenceByField blob (the upload action stashes them under _warnings).
  const jobByWO = new Map(jobs.map((j) => [j.workOrderNumber, j]));
  const entries = upload.entries.map((e) => {
    const job = jobByWO.get(e.workOrderNumber);
    const cby = (e.confidenceByField as Record<string, unknown> | null) ?? {};
    const rowWarnings = Array.isArray(cby._warnings) ? (cby._warnings as string[]) : [];
    return {
      id: e.id,
      workOrderNumber: e.workOrderNumber,
      // Derived (read-only on the Review UI):
      derivedCustomer: job?.customerName ?? "",
      derivedCode: e.laborCode, // already derived server-side from the bubble
      jobQuantity: job?.quantity ?? null,
      unitNumber: e.unitNumber,
      unitTotal: e.unitTotal,
      description: e.description, // the bubble selection
      notes: e.notes,
      startTime: e.startTime,
      endTime: e.endTime,
      decimalHours: e.decimalHours,
      hoursOverridden: e.hoursOverridden,
      status: e.status,
      confidenceByField: cby as Record<string, number>,
      rowWarnings,
      jobMissing: Boolean(e.workOrderNumber && !job),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Review timesheet</h1>
          <p className="text-sm text-muted-foreground">
            Only the things that actually need a manager are flagged. Customer and code are filled in for you.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/review">Back to queue</Link>
        </Button>
      </div>

      <HeaderEdit
        uploadId={upload.id}
        employeeId={upload.employeeId}
        employeeName={upload.employee?.name ?? null}
        date={upload.date.toISOString().slice(0, 10)}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base text-foreground">
              {upload.employee?.name ?? "Unknown employee"} . {formatDate(upload.date)}
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Read by {upload.extractorName || "n/a"} . threshold {Math.round(threshold * 100)}%
            </div>
          </div>
          {upload.status === "approved" ? <Badge variant="success">approved</Badge> : <Badge variant="warning">needs review</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          {warnings.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" /> {warnings.length} thing{warnings.length === 1 ? "" : "s"} to check
              </div>
              <ul className="ml-6 list-disc text-xs text-amber-900">
                {warnings.map((w, i) => (<li key={i}>{w}</li>))}
              </ul>
            </div>
          )}

          <ReviewTable
            uploadId={upload.id}
            entries={entries}
            bubbleOptions={bubbleOptions}
            threshold={threshold}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/reports">
            <FileText className="h-4 w-4" /> Go to reports
          </Link>
        </Button>
      </div>
    </div>
  );
}
