import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTenantContextSafe } from "@/lib/tenant";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";
// Initials from the capital letters of the product name ("FabSheet" -> "FS").
const INITIALS = (PRODUCT.replace(/[^A-Z]/g, "") || PRODUCT.slice(0, 2)).slice(0, 2).toUpperCase();

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  // If already signed in, bounce straight to the dashboard.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  // Resolve the tenant so the page speaks to the actual shop, not a generic
  // product. In single-tenant mode this is Raven's Marine.
  const ctx = await getTenantContextSafe();
  const company = ctx?.tenant.displayName || ctx?.tenant.name || null;

  const { next, error } = await searchParams;
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-100 to-slate-300 p-6 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0A1929] text-xl font-bold tracking-tight text-white shadow-lg">
            {INITIALS}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{PRODUCT}</h1>
          {company && (
            <p className="mt-1 text-sm font-medium text-foreground/80">Built for {company}</p>
          )}
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {company
              ? `Shaped around how ${company} already runs the shop floor. Paper in, job costing out.`
              : "Paper timesheets in, job costing out."}
          </p>
        </div>

        <LoginForm nextUrl={next ?? "/dashboard"} initialError={error ?? null} />

        <p className="text-center text-xs text-muted-foreground">
          Sign-in is by invitation. Trouble getting in? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
