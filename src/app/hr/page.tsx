import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/access";
import { Users, FileText, ClipboardCheck, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  await requirePermission("hr.view");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HR / Payroll dashboard</h1>
        <p className="text-sm text-muted-foreground">Payroll review, exports, QuickBooks files, and historical timesheet cleanup.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile href="/review" icon={<ClipboardCheck className="h-5 w-5" />} title="Review timesheets" body="Check pending rows before payroll or exports." />
        <Tile href="/reports" icon={<FileText className="h-5 w-5" />} title="Reports" body="Employee, job, and labor-code rollups by date range." />
        <Tile href="/api/report/payroll-csv?preset=week" icon={<Download className="h-5 w-5" />} title="Payroll CSV" body="Download this week's approved hours by employee." />
      </div>
    </div>
  );
}

function Tile({ href, icon, title, body }: { href: string; icon: React.ReactNode; title: string; body: string }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-foreground">{icon}{title}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{body}</p><Button asChild variant="outline"><Link href={href}>Open</Link></Button></CardContent></Card>;
}
