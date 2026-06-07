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
  AlertTriangle,
  Settings,
  Menu,
  Search,
  Crown,
  Landmark,
  Users,
  HardHat,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import type { NavModule, ModuleKey } from "@/lib/access";

const ICONS: Record<ModuleKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  executive: Crown,
  big_honcho: Landmark,
  attention: AlertTriangle,
  upload: Upload,
  review: ClipboardCheck,
  jobs: Briefcase,
  production: Target,
  reports: FileText,
  hr: Users,
  foreman: HardHat,
  quality: ShieldCheck,
  incentives: Trophy,
  admin: Settings,
  settings: Settings,
};

function NavList({ pathname, modules, onClick }: { pathname: string; modules: NavModule[]; onClick?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {modules.map((m) => {
        const Icon = ICONS[m.key] ?? LayoutDashboard;
        const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={onClick}
            className={cn(
              "flex min-h-[40px] items-center gap-3 rounded-md px-3 text-sm transition-colors",
              active
                ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{m.label}</span>
            {m.placeholder && <span className="ml-auto rounded bg-sidebar-foreground/10 px-1.5 py-0.5 text-[10px] text-sidebar-foreground/60">soon</span>}
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
  modules,
}: {
  company: string;
  user: { name: string | null; email: string; role: string } | null;
  modules: NavModule[];
}) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <SidebarHeader company={company} />
      <div className="flex-1 overflow-y-auto">
        <NavList pathname={pathname} modules={modules} />
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
  modules,
}: {
  company: string;
  user: { name: string | null; email: string; role: string } | null;
  modules: NavModule[];
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
          <NavList pathname={pathname} modules={modules} onClick={() => setOpen(false)} />
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
  modules,
  onOpenCommand,
}: {
  title: string;
  company: string;
  user: { name: string | null; email: string; role: string } | null;
  modules: NavModule[];
  onOpenCommand?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <MobileNav company={company} user={user} modules={modules} />
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
