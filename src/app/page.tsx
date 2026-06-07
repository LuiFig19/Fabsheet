import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlatformShowcase } from "@/components/landing/platform-showcase";
import { Reveal } from "@/components/landing/reveal";
import { ArrowRight, BadgeCheck, Building2, ChevronRight, ClipboardCheck, FileSpreadsheet, KeyRound, Layers3, LockKeyhole, PackageSearch, ScanLine, ShieldCheck, Sparkles, Timer, UsersRound, WalletCards } from "lucide-react";

const heroModules = [
  "Timesheets",
  "OCR review",
  "Job costing",
  "Production goals",
  "Inventory",
  "Clock in / out",
  "Purchase tracking",
  "Payroll exports",
  "Employee records",
  "Equipment logs",
  "Approvals",
  "Executive dashboard",
];

const managerSignals = [
  { name: "Today's sheets received", level: 92, tone: "green", note: "on track", value: "23 / 25" },
  { name: "Production hours", level: 68, tone: "orange", note: "needs push", value: "612h" },
  { name: "Review queue", level: 18, tone: "red", note: "action needed", value: "5 flags" },
  { name: "Payroll export", level: 100, tone: "green", note: "ready", value: "CSV + Excel" },
  { name: "Missing submissions", level: 28, tone: "red", note: "after 6 PM", value: "2 people" },
  { name: "Job costing coverage", level: 84, tone: "green", note: "mapped", value: "18 jobs" },
  { name: "Non-production time", level: 42, tone: "orange", note: "explained", value: "36.5h" },
  { name: "Office summary", level: 100, tone: "green", note: "sendable", value: "1 click" },
];

const workflow = [
  {
    eyebrow: "1. Capture",
    title: "Paper timesheets become structured data.",
    body: "Upload one sheet or a batch. FabSheet reads employee names, dates, work numbers, labor bubbles, notes, units, and odd handwritten time formats before sending anything to review.",
    metric: "double scan",
    icon: <ScanLine className="h-5 w-5" />,
  },
  {
    eyebrow: "2. Review",
    title: "Managers only handle the exceptions.",
    body: "The system links work orders to customers, keeps known employees and labor codes out of the correction queue, and flags the fields that actually need human eyes.",
    metric: "less re-entry",
    icon: <ClipboardCheck className="h-5 w-5" />,
  },
  {
    eyebrow: "3. Report",
    title: "Daily office exports are already broken down.",
    body: "QuickBooks-ready files, Excel summaries, production versus non-production hours, missing submissions after 6 PM, and weekly progress targets stay tied to the original uploads.",
    metric: "office ready",
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
];

const clientRules = [
  ["Fabrication shop", "weekly production targets, labor code rules, paper OCR, job quantity tracking, shop-floor review"],
  ["Steel shop", "piece-rate units, material pulls, foreman approvals, rework reasons, payroll-ready exports"],
  ["Service company", "truck routes, field photos, customer sign-off, office dispatch, technician payroll"],
  ["Manufacturer", "quality checkpoints, defect reasons, incentives, shift performance, production dashboards"],
];

const buildSteps = [
  ["Discovery week", "We watch the current workflow, collect forms, learn the words your team already uses, and define exactly what the software needs to do."],
  ["Custom setup", "Your dashboard, employees, jobs, codes, exports, rules, alerts, and permissions are configured around your company instead of a generic template."],
  ["Training handoff", "One person on your team gets trained to run the system, manage settings, handle reviews, and request changes clearly."],
  ["Included refinement", "For two weeks after launch, reasonable workflow changes and polish are included so the first version fits the real floor."],
];

const pricing = [
  {
    title: "Typical custom build",
    price: "$25k-$100k+",
    note: "common agency or internal software range",
    body: "Most companies pay heavily because the team starts from scratch: auth, storage, dashboards, exports, permissions, hosting, and every workflow screen.",
    accent: "cyan",
  },
  {
    title: "FabSheet launch",
    price: "Request a quote",
    note: "priced after discovery and module selection",
    body: "FabSheet reuses the secure platform foundation, then customizes the company-specific dashboard, rules, data, exports, and training for a fraction of a ground-up build.",
    accent: "emerald",
  },
  {
    title: "Add-on menu",
    price: "Pick modules",
    note: "extra tools are priced separately",
    body: "Inventory, quality, incentives, equipment, purchasing, field tools, clock-in/out, service tickets, or deeper accounting integrations can be added to the client's specific dashboard.",
    accent: "amber",
  },
];

export default function RootIndex() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#06111f] text-white">
      <section className="relative min-h-screen">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(14,165,233,.28),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(16,185,129,.18),transparent_28%),linear-gradient(135deg,#06111f_0%,#0A1929_48%,#071827_100%)]" />
          <div className="absolute inset-0 opacity-[.08] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:64px_64px]" />
          <div className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-sm font-black tracking-tight text-[#06111f] shadow-[0_10px_30px_rgba(14,165,233,.25)] transition-transform group-hover:scale-105">FS</span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">FabSheet</span>
              <span className="block text-[11px] uppercase tracking-[.22em] text-slate-400">custom admin platform</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="bg-white text-[#06111f] hover:bg-slate-100">
              <Link href="/login">Create account <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-84px)] max-w-7xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.02fr_.98fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1 text-xs font-medium text-cyan-100 shadow-2xl backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Built around the way your company actually works
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[.96] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Stop chasing paper.
              <span className="block bg-gradient-to-r from-cyan-200 via-blue-200 to-emerald-200 bg-clip-text text-transparent">
                Turn timesheets into job-costing data.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              FabSheet moves labor hours from foreman review to HR, QuickBooks-ready exports, time-clock verification, owner reporting, and executive rollups in one secure workflow.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 bg-cyan-300 px-5 text-[#06111f] hover:bg-cyan-200">
                <Link href="/login">Open secure access <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-white/15 bg-white/[.04] px-5 text-white hover:bg-white/10 hover:text-white">
                <Link href="#platform">See the platform</Link>
              </Button>
            </div>
            <div className="mt-9 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {heroModules.map((m) => (
                <div key={m} className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-medium text-slate-300 backdrop-blur">{m}</div>
              ))}
            </div>
          </div>

          <PlatformShowcase />
        </div>
      </section>

      <section id="platform" className="relative border-y border-white/10 bg-white/[.03] py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-3">
          <Reveal>
            <Capability icon={<Building2 className="h-5 w-5" />} title="Built with the company" body="We sit down with the team, learn the existing process, and configure the software around the way work already moves." />
          </Reveal>
          <Reveal delay={0.08}>
            <Capability icon={<LockKeyhole className="h-5 w-5" />} title="Private and encrypted" body="Each company gets isolated data, controlled users, encrypted secrets, protected uploads, and permission checks around every sensitive workflow." />
          </Reveal>
          <Reveal delay={0.16}>
            <Capability icon={<Sparkles className="h-5 w-5" />} title="Custom without enterprise pricing" body="The platform foundation is reusable, so clients get a tailored system without paying agency-level custom software prices." />
          </Reveal>
        </div>
      </section>

      <section className="relative border-b border-white/10 bg-[#071827] py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">Real shop workflow</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Paper timesheets to payroll-ready operations data.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Built for shops that still run on paper, spreadsheets, and manual approvals. FabSheet keeps the process familiar while removing the repeated math, re-entry, and “who has the sheet?” chasing.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {["Paper timesheets", "Foreman review", "HR payroll entry", "QuickBooks-ready export", "Time clock verification", "Boss summaries"].map((step, index) => (
              <Reveal key={step} delay={index * 0.04}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[.04] p-4">
                  <div className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">0{index + 1}</div>
                  <div className="mt-3 text-sm font-black">{step}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 lg:py-32">
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,17,31,0)_0%,rgba(14,165,233,.06)_44%,rgba(6,17,31,0)_100%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[.92fr_1.08fr]">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">Show the platform</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Software shaped around your process, not the other way around.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">
              We sit down with your team, map the real workflow, configure the modules, import the starting data, and train the person who will run it day to day.
            </p>
            <div className="mt-8">
              <PlatformShowcase mode="sticky" />
            </div>
          </div>

          <div className="space-y-5">
            {workflow.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.07}>
                <div
                key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[.045] p-5 shadow-2xl shadow-black/10 backdrop-blur transition duration-500 hover:-translate-y-1 hover:border-cyan-300/35 hover:bg-white/[.075] sm:p-6"
              >
                <div aria-hidden className="absolute right-0 top-0 h-28 w-28 translate-x-10 -translate-y-10 rounded-full bg-cyan-300/10 blur-2xl transition duration-500 group-hover:bg-emerald-300/15" />
                <div className="relative flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-200/20">
                    {item.icon}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{item.eyebrow}</p>
                      <span className="rounded-full border border-white/10 bg-white/[.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300">{item.metric}</span>
                    </div>
                    <h3 className="mt-3 text-2xl font-black tracking-tight">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{item.body}</p>
                    <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-cyan-200">
                      <span>Step {index + 1} in the live workflow</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </div>
              </Reveal>
            ))}

            <div className="grid gap-4 sm:grid-cols-3">
              <Signal icon={<Layers3 className="h-4 w-4" />} label="Schedule rules" value="any shift, any day" />
              <Signal icon={<UsersRound className="h-4 w-4" />} label="Submission alerts" value="client-set deadlines" />
              <Signal icon={<BadgeCheck className="h-4 w-4" />} label="Company targets" value="client-specific goals" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">What the customer sees</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A command center for the work that actually moves the company.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Managers see what is healthy, what needs attention, what is ready for the office, and where the company is losing time.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {managerSignals.map((m, index) => (
              <Reveal key={m.name} delay={(index % 4) * 0.04}>
              <div key={m.name} className="group rounded-xl border border-white/10 bg-white/[.04] p-4 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[.07]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{m.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{m.value}</div>
                  </div>
                  <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${tonePill(m.tone)}`}>{m.note}</div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full transition-all duration-500 group-hover:brightness-125 ${toneBar(m.tone)}`} style={{ width: `${m.level}%` }} />
                </div>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-[#071827] py-20">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.12),transparent_28%),radial-gradient(circle_at_88%_78%,rgba(16,185,129,.12),transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">Administration capabilities</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">More than timesheets: the admin system around the whole operation.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Every company starts with different pain. FabSheet can be configured around the modules they need first, then expanded as the business wants more control.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminCapability icon={<Timer className="h-5 w-5" />} title="Clock in / out" body="Employee time capture, shift records, exceptions, missed punches, and manager review." />
            <AdminCapability icon={<PackageSearch className="h-5 w-5" />} title="Inventory" body="Track parts, materials, tool usage, reorder points, and job-linked inventory movement." />
            <AdminCapability icon={<FileSpreadsheet className="h-5 w-5" />} title="Office exports" body="Payroll files, daily summaries, accounting handoff, CSV/PDF packets, and HR reports." />
            <AdminCapability icon={<UsersRound className="h-5 w-5" />} title="People admin" body="Roles, divisions, employee records, contact info, permissions, and training handoff." />
            <AdminCapability icon={<ClipboardCheck className="h-5 w-5" />} title="Approvals" body="Review queues, supervisor approvals, correction trails, notes, and audit-safe decisions." />
            <AdminCapability icon={<Building2 className="h-5 w-5" />} title="Divisions" body="Separate departments, crews, locations, or branches while leadership sees the whole company." />
            <AdminCapability icon={<ShieldCheck className="h-5 w-5" />} title="Secure storage" body="Tenant-scoped records, protected uploads, encrypted configuration, and role-limited access." />
            <AdminCapability icon={<Layers3 className="h-5 w-5" />} title="Custom modules" body="Quality, incentives, equipment, purchasing, field work, service tickets, or client-specific workflows." />
          </div>
        </div>
      </section>

      <section className="relative py-20">
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,165,233,.08),transparent_38%,rgba(16,185,129,.08))]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[.85fr_1.15fr]">
          <Reveal>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.25em] text-emerald-300">Security built in</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Leadership can see the business without exposing the wrong data.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                FabSheet is designed for holding companies with multiple operating companies and divisions under one platform. Access is tenant-scoped, secrets are encrypted, routes are protected, and leadership views summarize performance without turning every employee record into an open file.
              </p>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            <Reveal delay={0.05}>
              <SecurityTile icon={<ShieldCheck className="h-5 w-5" />} title="Tenant isolation" body="Company data stays scoped to the company account and never blends with another client." />
            </Reveal>
            <Reveal delay={0.12}>
              <SecurityTile icon={<KeyRound className="h-5 w-5" />} title="Encrypted secrets" body="API keys and sensitive configuration are stored server-side and encrypted where supported." />
            </Reveal>
            <Reveal delay={0.19}>
              <SecurityTile icon={<LockKeyhole className="h-5 w-5" />} title="Role control" body="Owners, managers, HR, office staff, and foremen only see the tools their role allows." />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-white/[.03] py-20">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(16,185,129,.14),transparent_28%),radial-gradient(circle_at_18%_80%,rgba(14,165,233,.12),transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">Pricing approach</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Custom operations software at a fraction of the usual build cost.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              The exact price depends on the company, modules, integrations, and how much custom workflow mapping is needed. We quote after discovery so the client pays for the version they actually need, not a bloated package.
            </p>
            <Button asChild className="mt-6 bg-cyan-300 text-[#06111f] hover:bg-cyan-200">
              <Link href="/login">Request a quote <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </Reveal>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {pricing.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.08}>
                <div className={`relative h-full overflow-hidden rounded-2xl border border-white/10 bg-[#091b2d]/85 p-6 shadow-2xl shadow-black/20 transition duration-300 hover:-translate-y-1 ${pricingBorder(item.accent)}`}>
                  <div aria-hidden className={`absolute right-0 top-0 h-28 w-28 translate-x-10 -translate-y-10 rounded-full blur-2xl ${pricingGlow(item.accent)}`} />
                  <div className="relative">
                    <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-white/[.06] text-cyan-200 ring-1 ring-white/10">
                      <WalletCards className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-black">{item.title}</h3>
                    <div className="mt-4 text-4xl font-black tracking-tight">{item.price}</div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[.14em] text-cyan-200">{item.note}</p>
                    <p className="mt-5 text-sm leading-7 text-slate-400">{item.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {buildSteps.map(([title, body], index) => (
              <Reveal key={title} delay={index * 0.06}>
                <div className="h-full rounded-2xl border border-white/10 bg-slate-950/35 p-5">
                  <div className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">0{index + 1}</div>
                  <h3 className="mt-3 text-base font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#071827] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-emerald-300">Same roof, different company rules</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Every client gets a version that sounds like them, works like them, and protects their data.</h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {clientRules.map(([name, rules]) => (
              <div key={name} className="rounded-2xl border border-white/10 bg-white/[.04] p-5 transition duration-300 hover:border-emerald-300/35 hover:bg-white/[.065]">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-black">{name}</h3>
                  <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-emerald-200">tenant</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-400">{rules}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function AdminCapability({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Reveal>
      <div className="h-full rounded-2xl border border-white/10 bg-white/[.045] p-5 shadow-2xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:bg-white/[.07]">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/12 text-cyan-200 ring-1 ring-cyan-200/20">{icon}</div>
        <h3 className="mt-4 text-base font-black">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
      </div>
    </Reveal>
  );
}

function toneBar(tone: string) {
  if (tone === "green") return "bg-gradient-to-r from-cyan-300 to-emerald-300";
  if (tone === "orange") return "bg-gradient-to-r from-amber-300 to-orange-300";
  return "bg-gradient-to-r from-red-400 to-rose-300";
}

function pricingBorder(accent: string) {
  if (accent === "emerald") return "hover:border-emerald-300/40";
  if (accent === "amber") return "hover:border-amber-300/40";
  return "hover:border-cyan-300/40";
}

function pricingGlow(accent: string) {
  if (accent === "emerald") return "bg-emerald-300/15";
  if (accent === "amber") return "bg-amber-300/15";
  return "bg-cyan-300/15";
}

function tonePill(tone: string) {
  if (tone === "green") return "bg-emerald-300/10 text-emerald-200";
  if (tone === "orange") return "bg-amber-300/10 text-amber-200";
  return "bg-red-400/10 text-red-200";
}

function Capability({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#091b2d]/80 p-6 shadow-2xl shadow-black/20 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/15 text-cyan-200 ring-1 ring-cyan-200/20">{icon}</div>
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function Signal({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <div className="flex items-center gap-2 text-cyan-200">
        {icon}
        <span className="text-xs font-bold uppercase tracking-[.16em]">{label}</span>
      </div>
      <div className="mt-3 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function SecurityTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="h-full rounded-2xl border border-white/10 bg-white/[.045] p-5 shadow-2xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/35">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-300/12 text-emerald-200 ring-1 ring-emerald-200/20">{icon}</div>
      <h3 className="mt-4 text-base font-black">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}
