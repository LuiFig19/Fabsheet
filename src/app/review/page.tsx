import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { getTenantContext, scopeWhere } from "@/lib/tenant";
import { BulkApprove } from "./bulk-approve";
import { AlertTriangle, ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const ctx = await getTenantContext();
  const uploads = await prisma.timesheetUpload.findMany({
    where: { ...scopeWhere(ctx), status: { in: ["needs_review", "approved", "uploaded"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { employee: true, _count: { select: { entries: true } } },
    take: 50,
  });

  const needsReview = uploads.filter((u) => u.status === "needs_review");
  const others = uploads.filter((u) => u.status !== "needs_review");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          Open a sheet to check the extracted rows. Only approved rows count toward job totals and exports.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs review ({needsReview.length})
          </CardTitle>
          <BulkApprove disabled={needsReview.length === 0} />
        </CardHeader>
        <CardContent className="space-y-2">
          {needsReview.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nothing waiting. Good.</p>
          ) : (
            needsReview.map((u) => <Row key={u.id} u={u} />)
          )}
        </CardContent>
      </Card>

      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Recently handled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{others.map((u) => <Row key={u.id} u={u} />)}</CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ u }: { u: { id: string; status: string; date: Date; employee: { name: string } | null; _count: { entries: number } } }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <div className="text-sm font-medium">{u.employee?.name ?? "Unknown"}</div>
        <div className="text-xs text-muted-foreground">
          {formatDate(u.date)} . {u._count.entries} row{u._count.entries === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {u.status === "approved" ? (
          <Badge variant="success">approved</Badge>
        ) : u.status === "uploaded" ? (
          <Badge variant="danger">extract failed</Badge>
        ) : (
          <Badge variant="warning">needs review</Badge>
        )}
        <Button asChild size="sm" variant={u.status === "needs_review" ? "default" : "ghost"}>
          <Link href={`/review/${u.id}`}>
            <ClipboardCheck className="h-4 w-4" /> Open
          </Link>
        </Button>
      </div>
    </div>
  );
}
