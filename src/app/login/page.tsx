import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  // If already signed in, bounce straight to the dashboard.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  const { next, error } = await searchParams;
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-6 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#0A1929] text-lg font-bold text-white">
            {PRODUCT.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="text-xl font-semibold">Sign in to {PRODUCT}</h1>
          <p className="mt-1 text-sm text-muted-foreground">A one-time link will be emailed to you. No password.</p>
        </div>
        <LoginForm nextUrl={next ?? "/dashboard"} initialError={error ?? null} />
        <p className="text-center text-xs text-muted-foreground">
          Trouble signing in? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
