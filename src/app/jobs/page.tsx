import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approvedHoursByJob } from "@/lib/queries";
import { getTenantContext, scopeWhere } from "@/lib/tenant";
import { budgetTier, fmtHours } from "@/lib/utils";
import { AddJob } from "./add-job";

export const dynamic = "force-dynamic";

const TIER_TEXT: Record<string, string> = {
  green: "text-emerald-600",
  yellow: "text-amber-600",
  red: "text-red-600",
  none: "text-muted-foreground",
};

export default async function JobsPage() {
  const ctx = await getTenantContext();
  const [jobs, usedByJob] = await Promise.all([
    prisma.job.findMany({ where: scopeWhere(ctx), orderBy: [{ status: "asc" }, { workOrderNumber: "asc" }] }),
    approvedHoursByJob(ctx),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-muted-foreground">Budgeted vs. used hours. Used hours count approved entries only.</p>
        </div>
        <AddJob />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">All jobs ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Budgeted</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => {
                const used = usedByJob.get(j.id) ?? 0;
                const tier = budgetTier(used, j.budgetedHours);
                const remaining = j.budgetedHours - used;
                return (
                  <TableRow key={j.id}>
                    <TableCell className="font-semibold">
                      <Link href={`/jobs/${j.id}`} className="hover:underline">
                        {j.workOrderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{j.customerName || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{j.description || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{j.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(j.budgetedHours)}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${TIER_TEXT[tier]}`}>{fmtHours(used)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(remaining)}</TableCell>
                    <TableCell>
                      <Badge variant={j.status === "complete" ? "success" : j.status === "on_hold" ? "muted" : "secondary"}>
                        {j.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
