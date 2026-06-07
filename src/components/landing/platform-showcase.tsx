"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const metrics = [
  { label: "Sheets in", value: "23/25", tone: "text-emerald-200", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  { label: "Review", value: "5", tone: "text-amber-200", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { label: "Jobs", value: "18", tone: "text-cyan-200", icon: <Briefcase className="h-3.5 w-3.5" /> },
  { label: "Export", value: "ready", tone: "text-emerald-200", icon: <FileText className="h-3.5 w-3.5" /> },
];

const divisions = [
  { label: "Shop", value: "82%", width: "82%", tone: "from-cyan-300 to-emerald-300" },
  { label: "Field", value: "61%", width: "61%", tone: "from-amber-300 to-orange-300" },
  { label: "Office", value: "96%", width: "96%", tone: "from-cyan-300 to-emerald-300" },
];

const jobs = [
  { label: "WO-2048", customer: "Customer A", hours: "148h", status: "on track" },
  { label: "WO-2051", customer: "Customer B", hours: "73h", status: "watch" },
  { label: "WO-2058", customer: "Customer C", hours: "22h", status: "new" },
];

export function PlatformShowcase({ mode = "hero" }: { mode?: "hero" | "sticky" }) {
  const { scrollYProgress } = useScroll();
  const rotateX = useTransform(scrollYProgress, [0, 0.75], [10, -10]);
  const rotateY = useTransform(scrollYProgress, [0, 0.75], [-16, 14]);
  const y = useTransform(scrollYProgress, [0, 0.75], [0, mode === "sticky" ? -28 : -54]);
  const scale = useTransform(scrollYProgress, [0, 0.55, 1], [1, 1.04, 0.98]);

  return (
    <div className="relative mx-auto w-full max-w-xl [perspective:1400px]">
      <motion.div
        aria-hidden
        style={{ rotateX, rotateY, y, scale }}
        className="absolute -right-4 top-8 hidden h-28 w-28 rounded-3xl border border-cyan-200/20 bg-cyan-300/10 shadow-[0_0_70px_rgba(103,232,249,.22)] backdrop-blur md:block"
      />
      <motion.div
        style={{ rotateX, rotateY, y, scale, transformStyle: "preserve-3d" }}
        className="relative rounded-[30px] border border-white/15 bg-slate-950/75 p-4 shadow-[0_45px_130px_rgba(0,0,0,.55)] backdrop-blur-xl"
      >
        <div className="absolute -inset-1 -z-10 rounded-[30px] bg-gradient-to-br from-cyan-300/25 via-blue-500/10 to-emerald-300/20 blur-xl" />
        <div className="rounded-[22px] border border-white/10 bg-[#071321] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-300" />
            </div>
            <div className="rounded-full border border-white/10 bg-white/[.05] px-3 py-1 text-[11px] text-slate-300">executive view</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[.92fr_1.08fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
              <div className="text-xs font-semibold uppercase tracking-[.18em] text-slate-500">Today</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {metrics.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[.13em] text-slate-500">
                      {item.icon}
                      {item.label}
                    </div>
                    <div className={`mt-2 text-lg font-black ${item.tone}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[.18em] text-slate-500">Division health</div>
                  <div className="mt-1 text-lg font-bold">Company overview</div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/15 text-emerald-200">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {divisions.map((division, i) => (
                  <motion.div key={division.label} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.14 * i, duration: 0.45 }}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{division.label}</span>
                      <span className="text-slate-400">{division.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full bg-gradient-to-r ${division.tone}`} style={{ width: division.width }} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {mode === "sticky" ? (
            <div className="mt-3 rounded-2xl border border-cyan-200/10 bg-cyan-300/[.06] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-200/70">Job costing</div>
                  <div className="mt-1 text-sm font-bold text-white">Work orders, hours, and office handoff</div>
                </div>
                <div className="rounded-full bg-emerald-300/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">export ready</div>
              </div>
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div key={job.label} className="grid grid-cols-[.8fr_1fr_.7fr] items-center gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-xs">
                    <div>
                      <div className="font-bold text-slate-100">{job.label}</div>
                      <div className="text-[10px] text-slate-500">{job.customer}</div>
                    </div>
                    <div className="text-slate-300">{job.hours}</div>
                    <div className="text-right text-[10px] font-semibold uppercase tracking-[.12em] text-cyan-200">{job.status}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-3 gap-3">
            <MiniStat label="Protected" value="routes" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
            <MiniStat label="Encrypted" value="data" icon={<LockKeyhole className="h-3.5 w-3.5" />} />
            <MiniStat label="Custom" value="modules" icon={<TrendingUp className="h-3.5 w-3.5" />} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.04] p-3 text-center">
      <div className="mx-auto mb-1 grid h-6 w-6 place-items-center rounded-lg bg-white/[.06] text-cyan-200">{icon}</div>
      <div className="text-[10px] uppercase tracking-[.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}
