import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/access";
import { HardHat, Upload, ClipboardCheck, Briefcase, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ForemanPage() {
  await requirePermission("foreman.view");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Foreman dashboard</h1>
        <p className="text-sm text-muted-foreground">Fast shop-floor tools without HR, billing, or permission-management access.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile href="/upload" icon={<Upload className="h-5 w-5" />} title="Upload sheets" body="Submit today's paper sheets from the floor." />
        <Tile href="/review" icon={<ClipboardCheck className="h-5 w-5" />} title="Review rows" body="Approve or fix only what needs attention." />
        <Tile href="/jobs" icon={<Briefcase className="h-5 w-5" />} title="Jobs in progress" body="Check job progress, units, and budget status." />
        <Tile href="/quality" icon={<ShieldCheck className="h-5 w-5" />} title="QC checklists" body="Placeholder module ready for future paid add-on." />
      </div>
    </div>
  );
}

function Tile({ href, icon, title, body }: { href: string; icon: React.ReactNode; title: string; body: string }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-foreground">{icon}{title}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{body}</p><Button asChild variant="outline"><Link href={href}>Open</Link></Button></CardContent></Card>;
}
