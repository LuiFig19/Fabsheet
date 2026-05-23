import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReviewTable } from "./review-table";
import { formatDate } from "@/lib/utils";
import { getTenantContext, scopeWhere, tenantWhere } from "@/lib/tenant";
import { AlertTriangle, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;

  const ctx = await getTenantContext();
  const [upload, company, codes, descs] = await Promise.all([
    prisma.timesheetUpload.findFirst({
      where: { id: uploadId, ...scopeWhere(ctx) },
      include: { employee: true, entries: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.company.findFirst({ where: tenantWhere(ctx) }),
    prisma.laborCode.findMany({ where: { ...tenantWhere(ctx), active: true }, orderBy: { code: "asc" } }),
    prisma.taskDescription.findMany({ where: { ...tenantWhere(ctx), active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!upload) notFound();

  const laborCodeOptions = codes.map((c) => `${c.code} ${c.description}`);
  const descriptionOptions = descs.map((d) => d.name);

  const threshold = company?.ocrThreshold ?? 0.7;
  const warnings = (upload.warnings as string[] | null) ?? [];

  const entries = upload.entries.map((e) => ({
    id: e.id,
    workOrderNumber: e.workOrderNumber,
    customerName: e.customerName,
    partId: e.partId,
    description: e.description,
    laborCode: e.laborCode,
    startTime: e.startTime,
    endTime: e.endTime,
    decimalHours: e.decimalHours,
    hoursOverridden: e.hoursOverridden,
    notes: e.notes,
    status: e.status,
    confidenceByField: (e.confidenceByField as Record<string, number> | null) ?? {},
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review timesheet</h1>
          <p className="text-sm text-muted-foreground">
            Highlighted cells were read with low confidence (below {Math.round(threshold * 100)}%). Fix what looks off, then approve.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/review">Back to queue</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base text-foreground">
              {upload.employee?.name ?? "Unknown"} . {formatDate(upload.date)}
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Shift {upload.shiftStart || "?"} to {upload.shiftEnd || "?"} . read by {upload.extractorName || "n/a"}
            </div>
          </div>
          {upload.status === "approved" ? <Badge variant="success">approved</Badge> : <Badge variant="warning">needs review</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          {warnings.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Extractor flagged {warnings.length} item{warnings.length === 1 ? "" : "s"}
              </div>
              <ul className="ml-6 list-disc text-xs text-amber-900">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <ReviewTable
            uploadId={upload.id}
            entries={entries}
            descriptions={descriptionOptions}
            laborCodes={laborCodeOptions}
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
