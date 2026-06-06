import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/access";
import { getTenantContext, scopeWhere, tenantWhere } from "@/lib/tenant";
import { fmtHours, productiveCodeWhere, workWeekProgress } from "@/lib/utils";
import { Crown, Briefcase, ClipboardCheck, FileText, Settings } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExecutivePage() {
  await requirePermission("executive.view");
  const ctx = await getTenantContext();
  const s = scopeWhere(ctx);
  const { weekStart, weekEnd } = workWeekProgress();
  const [company, activeJobs, needsReview, productive, users] = await Promise.all([
    prisma.company.findFirst({ where: tenantWhere(ctx) }),
    prisma.job.count({ where: { ...s, status: "active" } }),
    prisma.timesheetUpload.count({ where: { ...s, status: "needs_review" } }),
    prisma.timesheetEntry.aggregate({
      where: { ...s, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...productiveCodeWhere },
      _sum: { decimalHours: true },
    }),
    prisma.user.count({ where: tenantWhere(ctx) }),
  ]);

  const target = company?.weeklyProductionTarget ?? 850;
  const prod = productive._sum.decimalHours ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="muted" className="mb-2">Leadership view</Badge>
          <h1 className="text-2xl font-bold">Executive dashboard</h1>
          <p className="text-sm text-muted-foreground">Company-wide access, business metrics, and the foundation for future admin modules.</p>
        </div>
        <Button asChild><Link href="/admin"><Settings className="h-4 w-4" /> Admin</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Crown className="h-4 w-4" />} label="Production this week" value={`${fmtHours(prod)} / ${target}`} />
        <Stat icon={<Briefcase className="h-4 w-4" />} label="Active jobs" value={String(activeJobs)} />
        <Stat icon={<ClipboardCheck className="h-4 w-4" />} label="Needs review" value={String(needsReview)} />
        <Stat icon={<FileText className="h-4 w-4" />} label="Platform users" value={String(users)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Action href="/dashboard" title="Raven's operations dashboard" body="The existing Raven's Marine dashboard remains intact and keeps the shop workflow stable." />
        <Action href="/production" title="Production accountability" body="Per-employee productive and non-productive breakdowns against weekly targets." />
        <Action href="/reports" title="Reports and exports" body="Payroll, job-costing, CSV/PDF exports, and historical reporting." />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2">{icon}{label}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>;
}

function Action({ href, title, body }: { href: string; title: string; body: string }) {
  return <Card><CardHeader><CardTitle className="text-foreground">{title}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{body}</p><Button asChild variant="outline"><Link href={href}>Open</Link></Button></CardContent></Card>;
}
