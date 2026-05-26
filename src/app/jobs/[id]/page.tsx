import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { budgetTier, fmtHours, formatDate } from "@/lib/utils";
import { getTenantContext, scopeWhere } from "@/lib/tenant";
import { JobControls } from "./job-controls";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  const job = await prisma.job.findFirst({
    where: { id, ...scopeWhere(ctx) },
    include: {
      entries: {
        where: { status: "approved" },
        include: { employee: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!job) notFound();

  const used = job.entries.reduce((s, e) => s + e.decimalHours, 0);
  const tier = budgetTier(used, job.budgetedHours);
  const pct = job.budgetedHours > 0 ? (used / job.budgetedHours) * 100 : 0;
  const remaining = job.budgetedHours - used;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
            ← All jobs
          </Link>
          <h1 className="text-2xl font-bold">
            {job.workOrderNumber} <span className="text-muted-foreground">. {job.customerName}</span>
          </h1>
          <p className="text-sm text-muted-foreground">{job.description}</p>
        </div>
        <Badge variant={job.status === "complete" ? "success" : job.status === "on_hold" ? "muted" : "secondary"}>
          {job.status.replace("_", " ")}
        </Badge>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Budgeted</div>
              <div className="text-2xl font-bold tabular-nums">{fmtHours(job.budgetedHours)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Used (approved)</div>
              <div className={`text-2xl font-bold tabular-nums ${tier === "red" ? "text-red-600" : tier === "yellow" ? "text-amber-600" : "text-emerald-600"}`}>
                {fmtHours(used)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Remaining</div>
              <div className="text-2xl font-bold tabular-nums">{fmtHours(remaining)}</div>
            </div>
          </div>
          <Progress pct={pct} tier={tier} />
          <div className="text-center text-xs text-muted-foreground">{Math.round(pct)}% of budget used</div>
        </CardContent>
      </Card>

      <JobControls jobId={job.id} budgetedHours={job.budgetedHours} status={job.status} />

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Approved entries ({job.entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {job.entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No approved entries yet for this job.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.createdAt)}</TableCell>
                    <TableCell className="font-medium">{e.employee?.name ?? "-"}</TableCell>
                    <TableCell>{e.laborCode || "-"}</TableCell>
                    <TableCell>{e.description || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(e.decimalHours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
