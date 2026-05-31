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
    icons: {
      // PNG fleet covers iOS (which rejects SVG for home-screen icons), the
      // PWA manifest, and the favicon. apple-touch-icon is the one iPadOS
      // pins when "Add to Home Screen" is tapped.
      icon: [
        { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
      shortcut: "/icon-192.png",
    },
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
  //
  // Kill switch: with AUTH_DISABLED=true the shell renders for everyone, with
  // a placeholder user identity in the sidebar, so the site is fully
  // browseable while auth is being fixed.
  const authDisabled = process.env.AUTH_DISABLED === "true";
  const session = authDisabled
    ? null
    : await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const ctx = authDisabled || session ? await getTenantContextSafe() : null;
  const company = ctx?.tenant.displayName || ctx?.tenant.name || PRODUCT;
  const user = ctx?.user
    ? { name: ctx.user.name, email: ctx.user.email, role: ctx.user.role }
    : authDisabled
      ? { name: "Auth disabled", email: "(temp)", role: "browse-only" }
      : null;
  const showShell = authDisabled || Boolean(session && ctx);

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
