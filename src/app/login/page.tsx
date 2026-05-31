import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTenantContextSafe } from "@/lib/tenant";
import { LoginForm } from "./login-form";
import { Camera, Clock, FileSpreadsheet, ShieldCheck, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";
// "FabSheet" -> "FS"
const INITIALS = (PRODUCT.replace(/[^A-Z]/g, "") || PRODUCT.slice(0, 2)).slice(0, 2).toUpperCase();

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // If already signed in, bounce straight to the dashboard.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  const ctx = await getTenantContextSafe();
  const company = ctx?.tenant.displayName || ctx?.tenant.name || null;

  const { next, error } = await searchParams;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0A1929] text-slate-100">
      {/* Ambient gradient mesh — two soft blobs + a subtle blueprint grid.
          Pure CSS, no JS, performs perfectly on a tablet. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #3B82F6 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 -right-24 h-[560px] w-[560px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #8B5CF6 0%, transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            backgroundPosition: "center",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 80%)",
          }}
        />
      </div>

      <main className="relative mx-auto grid min-h-[100dvh] w-full max-w-7xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-16">
        {/* Marketing column */}
        <section className="flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <BrandMark initials={INITIALS} />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide text-slate-200">{PRODUCT}</div>
              {company && <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">for {company}</div>}
            </div>
          </div>

          <div className="mt-12 max-w-xl lg:mt-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300 backdrop-blur">
              <Sparkles className="h-3 w-3 text-blue-300" />
              Built for the shop floor
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Time tracking,{" "}
              <span className="bg-gradient-to-r from-blue-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                simplified.
              </span>
              <br />
              Money,{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                saved.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg">
              {company
                ? `Snap a photo of any paper timesheet. ${company} gets job costing, payroll exports, and weekly production goals — automatically, in seconds.`
                : "Snap a photo of any paper timesheet. Get job costing, payroll exports, and weekly production goals — automatically, in seconds."}
            </p>
          </div>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <FeatureItem
              icon={<Camera className="h-4 w-4" />}
              title="Photograph the sheet"
              body="Phone or tablet, paper to data in seconds."
            />
            <FeatureItem
              icon={<Clock className="h-4 w-4" />}
              title="Hours read for you"
              body="AI handles handwriting, AM/PM, math."
            />
            <FeatureItem
              icon={<FileSpreadsheet className="h-4 w-4" />}
              title="QuickBooks-ready"
              body="One tap emails the daily packet to HR."
            />
            <FeatureItem
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Built for fab shops"
              body="Welding codes, units, OT — all native."
            />
          </ul>

          <div className="mt-10 hidden lg:block">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sign-in is by invitation only</div>
          </div>
        </section>

        {/* Login column */}
        <section className="flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur sm:p-8">
              <div className="mb-5 space-y-1.5">
                <h2 className="text-xl font-semibold tracking-tight text-white">Sign in</h2>
                <p className="text-sm text-slate-400">
                  We&apos;ll email you a one-tap sign-in link. No password to remember.
                </p>
              </div>
              <LoginForm nextUrl={next ?? "/dashboard"} initialError={error ?? null} />
            </div>

            <p className="mt-5 text-center text-xs text-slate-500 lg:hidden">
              Sign-in is by invitation only. Trouble getting in? Contact your administrator.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function BrandMark({ initials }: { initials: string }) {
  return (
    <div className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-[#0A1929] text-white shadow-lg ring-1 ring-white/10">
      <span className="text-sm font-extrabold tracking-tight">{initials}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 bottom-1 h-[2px] rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(96,165,250,0.9), transparent)" }}
      />
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur transition-colors hover:bg-white/[0.06]">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/30 to-indigo-500/20 text-blue-200 ring-1 ring-white/10">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs leading-relaxed text-slate-400">{body}</div>
      </div>
    </li>
  );
}
