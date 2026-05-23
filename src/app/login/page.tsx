import { redirect } from "next/navigation";
import { appMode } from "@/lib/tenant";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";

export default function LoginPage() {
  // Login only exists in multi_tenant mode. In single_tenant (Raven's) there is
  // no login at all; bounce to the app.
  if (appMode() === "single_tenant") redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex rounded-lg bg-navy px-3 py-2 text-lg font-bold text-navy-foreground">
          {PRODUCT}
        </div>
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="text-sm text-muted-foreground">We will email you a one-time sign-in link. No password.</p>
      </div>
      <LoginForm />
    </div>
  );
}
