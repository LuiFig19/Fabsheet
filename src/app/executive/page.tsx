import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/access";
import { getTenantContext, scopeWhere, tenantWhere } from "@/lib/tenant";
import { fmtHours, nonProductiveCodeWhere, productiveCodeWhere, workWeekProgress } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  LockKeyhole,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

type DivisionRollup = {
  id: string | null;
  name: string;
  subtitle?: string;
  activeJobs: number;
  employees: number;
  needsReview: number;
  productive: number;
  nonProductive: number;
  target: number;
  stage?: string;
};

const HOLDING_COMPANY_NAME = "Tuckahoe Holdings";

export default async function ExecutivePage() {
  await requirePermission("executive.view");
  const ctx = await getTenantContext();
  const tenantScope = tenantWhere(ctx);
  const scoped = scopeWhere(ctx);
  const { weekStart, weekEnd } = workWeekProgress();

  const [company, divisions, activeJobs, needsReview, approvedUploads, employees, productive, nonProductive] = await Promise.all([
    prisma.company.findFirst({ where: tenantScope }),
    prisma.division.findMany({ where: { ...tenantScope, active: true }, orderBy: { name: "asc" } }),
    prisma.job.count({ where: { ...scoped, status: "active" } }),
    prisma.timesheetUpload.count({ where: { ...scoped, status: "needs_review" } }),
    prisma.timesheetUpload.count({ where: { ...scoped, status: "approved", date: { gte: weekStart, lt: weekEnd } } }),
    prisma.employee.count({ where: { ...scoped, active: true } }),
    prisma.timesheetEntry.aggregate({
      where: { ...scoped, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...productiveCodeWhere },
      _sum: { decimalHours: true },
    }),
    prisma.timesheetEntry.aggregate({
      where: { ...scoped, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...nonProductiveCodeWhere },
      _sum: { decimalHours: true },
    }),
  ]);

  const target = company?.weeklyProductionTarget ?? 850;
  const productiveHours = productive._sum.decimalHours ?? 0;
  const nonProductiveHours = nonProductive._sum.decimalHours ?? 0;
  const totalHours = productiveHours + nonProductiveHours;
  const productivePct = target > 0 ? Math.min(100, Math.round((productiveHours / target) * 100)) : 0;
  const pilotDivisionRollups = await buildDivisionRollups({
    tenantId: ctx.tenant.id,
    divisions,
    target,
    weekStart,
    weekEnd,
  });
  const portfolioRollups = buildPortfolioRollups({
    ravenProductive: productiveHours,
    ravenNonProductive: nonProductiveHours,
    ravenActiveJobs: activeJobs,
    ravenEmployees: employees,
    ravenNeedsReview: needsReview,
    ravenTarget: target,
  });

  const reviewHealth = needsReview === 0 ? "clean" : needsReview < 6 ? "watch" : "urgent";
  const coverage = employees > 0 ? Math.min(100, Math.round((approvedUploads / Math.max(1, employees * 5)) * 100)) : 0;
  const portfolioProductive = portfolioRollups.reduce((sum, item) => sum + item.productive, 0);
  const portfolioTarget = portfolioRollups.reduce((sum, item) => sum + item.target, 0);
  const portfolioEmployees = portfolioRollups.reduce((sum, item) => sum + item.employees, 0);
  const portfolioActiveJobs = portfolioRollups.reduce((sum, item) => sum + item.activeJobs, 0);
  const portfolioNeedsReview = portfolioRollups.reduce((sum, item) => sum + item.needsReview, 0);
  const portfolioPct = portfolioTarget > 0 ? Math.min(100, Math.round((portfolioProductive / portfolioTarget) * 100)) : 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-2xl dark:border-slate-800 sm:p-7">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(34,211,238,.24),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(16,185,129,.16),transparent_30%),linear-gradient(135deg,#06111f,#0f172a_62%,#071827)]" />
        <div aria-hidden className="absolute inset-0 opacity-[.06] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:54px_54px]" />

        <div className="relative grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <Badge className="mb-4 border-cyan-200/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">Executive master dashboard</Badge>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {HOLDING_COMPANY_NAME} portfolio command center
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              One leadership view across operating companies: Raven&apos;s as the pilot, then every division with its own workflow, reports, and executive rollups under the same secure platform.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                <Link href="/reports">Open reports <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/[.04] text-white hover:bg-white/10 hover:text-white">
                <Link href="/admin">Manage access</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[.055] p-4 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-200/80">Holdings pulse</p>
                <p className="mt-1 text-sm text-slate-300">Pilot data plus portfolio rollout model</p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-300/15 text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Pulse label="Portfolio progress" value={`${portfolioPct}%`} tone={portfolioPct >= 80 ? "green" : portfolioPct >= 55 ? "orange" : "red"} />
              <Pulse label="Pilot review queue" value={`${needsReview}`} tone={reviewHealth === "clean" ? "green" : reviewHealth === "watch" ? "orange" : "red"} />
              <Pulse label="Raven's coverage" value={`${coverage}%`} tone={coverage >= 85 ? "green" : coverage >= 55 ? "orange" : "red"} />
              <Pulse label="Holding data" value="segmented" tone="green" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Portfolio productive hours" value={`${fmtHours(portfolioProductive)} / ${portfolioTarget}`} sub="mock portfolio rollup, Raven's uses live tenant data" />
        <Stat icon={<Briefcase className="h-4 w-4" />} label="Portfolio active jobs" value={String(portfolioActiveJobs)} sub="across operating companies" />
        <Stat icon={<ClipboardCheck className="h-4 w-4" />} label="Items needing review" value={String(portfolioNeedsReview)} sub="rolls up local division queues" />
        <Stat icon={<Users className="h-4 w-4" />} label="Tracked employees" value={String(portfolioEmployees)} sub={`${fmtHours(totalHours)} approved in pilot tenant`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight">Operating company performance</h2>
              <p className="text-sm text-muted-foreground">Raven&apos;s Marine is the low-cost pilot. The other operating companies represent the premium rollout opportunity.</p>
            </div>
            <Badge variant="muted">{portfolioRollups.length} operating companies</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {portfolioRollups.map((division) => (
              <DivisionCard key={division.id ?? "company-wide"} division={division} />
            ))}
          </div>
          <div className="mt-5 rounded-2xl border bg-muted/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-black">Pilot drilldown: Raven&apos;s Marine</h3>
                <p className="mt-1 text-sm text-muted-foreground">Live tenant data can still break Raven&apos;s into its configured departments/divisions below the portfolio view.</p>
              </div>
              <Badge variant="muted">pilot pricing</Badge>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {pilotDivisionRollups.map((division) => (
                <DivisionCard key={division.id ?? "raven-company-wide"} division={{ ...division, subtitle: "Raven's Marine pilot" }} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <Panel title="Leadership alerts" icon={<AlertTriangle className="h-4 w-4" />}>
            <AlertLine tone={needsReview ? "orange" : "green"} title={needsReview ? `Raven's pilot has ${needsReview} uploads needing review` : "Raven's pilot review queue clear"} body={needsReview ? "Approve or correct flagged submissions before office exports." : "No review bottleneck is currently visible in the pilot tenant."} />
            <AlertLine tone={coverage >= 75 ? "green" : "red"} title={`${coverage}% submission coverage`} body="Coverage is calculated from approved uploads this week against active employees." />
            <AlertLine tone={productivePct >= 70 ? "green" : "orange"} title={`Raven's pilot is ${productivePct}% of weekly target`} body="Use the pilot to prove the workflow, then quote premium rollouts for the other Tuckahoe operating companies." />
          </Panel>

          <Panel title="Data protection" icon={<LockKeyhole className="h-4 w-4" />}>
            <SecurityLine title="Portfolio separation" body="Each operating company can keep its own data, users, exports, and rules while leadership sees the rollup." />
            <SecurityLine title="Encrypted sensitive configuration" body="Provider keys and secrets stay server-side and are encrypted when stored in company settings." />
            <SecurityLine title="Role-based leadership access" body="Only leadership-approved users can open the holdings dashboard." />
          </Panel>

          <Panel title="Office readiness" icon={<FileSpreadsheet className="h-4 w-4" />}>
            <SecurityLine title="Reports" body="CSV/PDF exports remain available from the reports module." />
            <SecurityLine title="Payroll support" body="Approved time, non-production reasons, and review status stay linked to source uploads." />
          </Panel>
        </div>
      </section>
    </div>
  );
}

async function buildDivisionRollups({
  tenantId,
  divisions,
  target,
  weekStart,
  weekEnd,
}: {
  tenantId: string;
  divisions: Array<{ id: string; name: string }>;
  target: number;
  weekStart: Date;
  weekEnd: Date;
}): Promise<DivisionRollup[]> {
  const visible = divisions.length ? divisions : [{ id: null, name: "Company-wide" }];
  const targetShare = Math.max(1, Math.round(target / Math.max(1, visible.length)));

  return Promise.all(
    visible.map(async (division) => {
      const where = division.id ? { tenantId, divisionId: division.id } : { tenantId };
      const [activeJobs, employees, needsReview, productive, nonProductive] = await Promise.all([
        prisma.job.count({ where: { ...where, status: "active" } }),
        prisma.employee.count({ where: { ...where, active: true } }),
        prisma.timesheetUpload.count({ where: { ...where, status: "needs_review" } }),
        prisma.timesheetEntry.aggregate({
          where: { ...where, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...productiveCodeWhere },
          _sum: { decimalHours: true },
        }),
        prisma.timesheetEntry.aggregate({
          where: { ...where, status: "approved", upload: { date: { gte: weekStart, lt: weekEnd } }, ...nonProductiveCodeWhere },
          _sum: { decimalHours: true },
        }),
      ]);
      return {
        id: division.id,
        name: division.name,
        activeJobs,
        employees,
        needsReview,
        productive: productive._sum.decimalHours ?? 0,
        nonProductive: nonProductive._sum.decimalHours ?? 0,
        target: divisions.length ? targetShare : target,
      };
    }),
  );
}

function buildPortfolioRollups({
  ravenProductive,
  ravenNonProductive,
  ravenActiveJobs,
  ravenEmployees,
  ravenNeedsReview,
  ravenTarget,
}: {
  ravenProductive: number;
  ravenNonProductive: number;
  ravenActiveJobs: number;
  ravenEmployees: number;
  ravenNeedsReview: number;
  ravenTarget: number;
}): DivisionRollup[] {
  return [
    {
      id: "ravens-marine",
      name: "Raven's Marine",
      subtitle: "Pilot operating company",
      activeJobs: ravenActiveJobs,
      employees: ravenEmployees,
      needsReview: ravenNeedsReview,
      productive: ravenProductive,
      nonProductive: ravenNonProductive,
      target: ravenTarget,
      stage: "pilot",
    },
    {
      id: "gateway-dealer-network",
      name: "Gateway Dealer Network",
      subtitle: "Industrial equipment network",
      activeJobs: 64,
      employees: 428,
      needsReview: 11,
      productive: 1580,
      nonProductive: 224,
      target: 1900,
      stage: "premium rollout",
    },
    {
      id: "meeco-sullivan",
      name: "Meeco Sullivan",
      subtitle: "Dock systems operating company",
      activeJobs: 32,
      employees: 146,
      needsReview: 6,
      productive: 612,
      nonProductive: 88,
      target: 760,
      stage: "premium rollout",
    },
    {
      id: "wahoo-docks",
      name: "Wahoo Docks",
      subtitle: "Residential dock operations",
      activeJobs: 27,
      employees: 92,
      needsReview: 3,
      productive: 438,
      nonProductive: 52,
      target: 520,
      stage: "premium rollout",
    },
    {
      id: "shared-services",
      name: "Shared Services",
      subtitle: "Accounting, HR, executive reporting",
      activeJobs: 14,
      employees: 38,
      needsReview: 2,
      productive: 148,
      nonProductive: 36,
      target: 180,
      stage: "portfolio layer",
    },
  ];
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">{icon}{label}</div>
      <div className="mt-3 text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function DivisionCard({ division }: { division: DivisionRollup }) {
  const pct = division.target > 0 ? Math.min(100, Math.round((division.productive / division.target) * 100)) : 0;
  const tone = pct >= 80 ? "green" : pct >= 55 ? "orange" : "red";
  return (
    <div className="group overflow-hidden rounded-2xl border bg-background p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            <h3 className="font-black">{division.name}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {division.subtitle ? `${division.subtitle} · ` : ""}{division.employees} employees · {division.activeJobs} active jobs
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={toneBadge(tone)}>{pct}%</Badge>
          {division.stage ? <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{division.stage}</span> : null}
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${toneBar(tone)}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini label="Productive" value={fmtHours(division.productive)} tone="text-emerald-600 dark:text-emerald-300" />
        <Mini label="Support" value={fmtHours(division.nonProductive)} tone="text-amber-600 dark:text-amber-300" />
        <Mini label="Review" value={String(division.needsReview)} tone={division.needsReview ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"} />
      </div>
    </div>
  );
}

function Pulse({ label, value, tone }: { label: string; value: string; tone: "green" | "orange" | "red" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
      <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-black ${toneText(tone)}`}>{value}</div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-black">{icon}{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function AlertLine({ tone, title, body }: { tone: "green" | "orange" | "red"; title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-background p-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${toneDot(tone)}`} />
        <div className="text-sm font-bold">{title}</div>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

function SecurityLine({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-background p-3">
      <div className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{title}</div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2">
      <div className={`text-sm font-black ${tone}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</div>
    </div>
  );
}

function toneBar(tone: string) {
  if (tone === "green") return "bg-gradient-to-r from-cyan-400 to-emerald-400";
  if (tone === "orange") return "bg-gradient-to-r from-amber-300 to-orange-400";
  return "bg-gradient-to-r from-red-400 to-rose-400";
}

function toneBadge(tone: string) {
  if (tone === "green") return "bg-emerald-500 text-white hover:bg-emerald-500";
  if (tone === "orange") return "bg-amber-500 text-white hover:bg-amber-500";
  return "bg-red-500 text-white hover:bg-red-500";
}

function toneDot(tone: string) {
  if (tone === "green") return "bg-emerald-400";
  if (tone === "orange") return "bg-amber-400";
  return "bg-red-400";
}

function toneText(tone: string) {
  if (tone === "green") return "text-emerald-200";
  if (tone === "orange") return "text-amber-200";
  return "text-red-200";
}
