"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ProfileMenu } from "./profile-menu";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  ClipboardCheck,
  Briefcase,
  FileText,
  Target,
  Settings,
  Menu,
  Search,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/production", label: "Production", icon: Target },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavList({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            className={cn(
              "flex min-h-[40px] items-center gap-3 rounded-md px-3 text-sm transition-colors",
              active
                ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const PRODUCT = process.env.NEXT_PUBLIC_APP_NAME || "FabSheet";

function SidebarHeader({ company }: { company: string }) {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold text-sidebar-foreground">
        {company.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-semibold text-sidebar-foreground">{company}</div>
        <div className="text-[11px] text-sidebar-foreground/60">{PRODUCT}</div>
      </div>
    </div>
  );
}

export function AppSidebar({
  company,
  user,
}: {
  company: string;
  user: { name: string | null; email: string; role: string } | null;
}) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <SidebarHeader company={company} />
      <div className="flex-1 overflow-y-auto">
        <NavList pathname={pathname} />
      </div>
      {user && (
        <div className="border-t border-sidebar-border p-2">
          <ProfileMenu name={user.name} email={user.email} role={user.role} />
        </div>
      )}
    </aside>
  );
}

export function MobileNav({
  company,
  user,
}: {
  company: string;
  user: { name: string | null; email: string; role: string } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-accent lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col bg-sidebar text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarHeader company={company} />
        <div className="flex-1 overflow-y-auto">
          <NavList pathname={pathname} onClick={() => setOpen(false)} />
        </div>
        {user && (
          <div className="border-t border-sidebar-border p-2">
            <ProfileMenu name={user.name} email={user.email} role={user.role} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function TopBar({
  title,
  company,
  user,
  onOpenCommand,
}: {
  title: string;
  company: string;
  user: { name: string | null; email: string; role: string } | null;
  onOpenCommand?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <MobileNav company={company} user={user} />
      <h1 className="hidden text-base font-semibold sm:block">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onOpenCommand}
          className="hidden h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground hover:bg-muted sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <kbd className="ml-1 rounded border bg-background px-1 py-0.5 font-mono text-[10px]">{typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘K" : "Ctrl K"}</kbd>
        </button>
      </div>
    </header>
  );
}
