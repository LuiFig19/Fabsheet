import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/nav";
import { getTenantContextSafe } from "@/lib/tenant";

const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantContextSafe();
  const company = ctx?.tenant.displayName || ctx?.tenant.name;
  return {
    title: company ? `${company} . ${PRODUCT}` : PRODUCT,
    description: "Read paper timesheets, review, and roll up job costing.",
  };
}

// viewport-fit=cover so the app uses the full notch-iPad viewport; safe-area
// padding is applied on the header below.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "TS";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContextSafe();
  const companyName = ctx?.tenant.displayName || ctx?.tenant.name || PRODUCT;
  const showChrome = Boolean(ctx); // hide nav on login / unauthenticated screens

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-muted/30">
          {showChrome && (
            <header className="bg-navy text-navy-foreground" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              <div className="container flex h-16 items-center justify-between gap-4">
                <Link href="/" className="flex items-center gap-2.5">
                  <span className="rounded-md bg-white/15 px-2 py-1 text-sm font-bold">{initials(companyName)}</span>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold">{companyName}</div>
                    <div className="text-xs text-white/60">Timesheet to job costing</div>
                  </div>
                </Link>
                <Nav />
              </div>
            </header>
          )}
          <main className="container py-8">{children}</main>
          {showChrome && (
            <footer className="container pb-8 pt-2 text-xs text-muted-foreground">
              Extracted rows start in review. Only approved rows count toward job totals and exports.
            </footer>
          )}
        </div>
      </body>
    </html>
  );
}
