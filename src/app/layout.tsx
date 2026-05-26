import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { auth } from "@/lib/auth";
import { getTenantContextSafe } from "@/lib/tenant";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";

const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantContextSafe();
  const company = ctx?.tenant.displayName || ctx?.tenant.name;
  return {
    title: company ? `${company} . ${PRODUCT}` : PRODUCT,
    description: "Read paper timesheets, review, and roll up job costing.",
    manifest: "/manifest.json",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: PRODUCT },
    icons: { icon: "/icon-192.svg", apple: "/icon-192.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0A1929" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1929" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The shell (sidebar + topbar) only renders for AUTHENTICATED users. The
  // /login page is unauth so it gets a clean centered layout. We check the
  // session directly so it's not coupled to tenant resolution (single_tenant
  // always resolves a tenant even when nobody is signed in).
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const ctx = session ? await getTenantContextSafe() : null;
  const company = ctx?.tenant.displayName || ctx?.tenant.name || PRODUCT;
  const user = ctx?.user
    ? { name: ctx.user.name, email: ctx.user.email, role: ctx.user.role }
    : null;
  const showShell = Boolean(session && ctx);

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider delayDuration={150}>
            {showShell ? (
              <AppShell company={company} user={user}>{children}</AppShell>
            ) : (
              <div className="min-h-[100dvh]">{children}</div>
            )}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
