import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";

export default async function MagicLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  const { verify } = await searchParams;
  if (!verify) redirect("/login?error=Missing sign-in token.");

  let verifyUrl: URL;
  try {
    verifyUrl = new URL(verify);
  } catch {
    redirect("/login?error=Invalid sign-in link.");
  }

  const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000");
  const sameHost = verifyUrl.host === appUrl.host || verifyUrl.host === "localhost:3000";
  const isAuthVerify = verifyUrl.pathname.endsWith("/magic-link/verify");
  if (!sameHost || !isAuthVerify) redirect("/login?error=Invalid sign-in link.");

  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#0A1929] px-6 text-white">
      <div aria-hidden className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(34,211,238,.22),transparent_32%),radial-gradient(circle_at_80%_85%,rgba(16,185,129,.16),transparent_34%)]" />
        <div className="absolute inset-0 opacity-[.06] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>

      <section className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/[.045] p-7 text-center shadow-2xl shadow-black/30 backdrop-blur">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-200/20">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Opening {PRODUCT}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This page protects your one-time sign-in token from email scanners. Your browser will continue automatically.
        </p>
        <div className="mt-6 flex justify-center text-cyan-200">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <Button asChild className="mt-6 w-full bg-white text-[#0A1929] hover:bg-slate-100">
          <Link href={verifyUrl.toString()}>
            Continue to {PRODUCT}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      <script
        dangerouslySetInnerHTML={{
          __html: `setTimeout(function(){ window.location.replace(${JSON.stringify(verifyUrl.toString())}); }, 700);`,
        }}
      />
    </main>
  );
}
