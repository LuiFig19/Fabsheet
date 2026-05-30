"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  X,
} from "lucide-react";

type Link = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const LINKS: Link[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/attention", label: "Needs Attention", icon: AlertTriangle },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/production", label: "Production", icon: Target },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, link: Link) {
  return link.exact ? pathname === link.href : pathname.startsWith(link.href);
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on route change + lock body scroll when the mobile sheet is open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      {/* md+ : inline nav with icons + labels */}
      <nav className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => {
          const active = isActive(pathname, l);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <l.icon className="h-4 w-4" />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* < md : hamburger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white md:hidden"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile menu sheet (absolutely positioned below header). Header has
          position:relative so this aligns under it; backdrop dims the page. */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 top-16 z-40 bg-black/40 md:hidden"
            style={{ bottom: 0 }}
          />
          <div
            id="mobile-menu"
            className="absolute inset-x-0 top-full z-50 border-t border-white/10 bg-navy shadow-lg md:hidden"
          >
            <nav className="container flex flex-col gap-1 py-2">
              {LINKS.map((l) => {
                const active = isActive(pathname, l);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "flex min-h-[48px] items-center gap-3 rounded-md px-3 text-base font-medium transition-colors",
                      active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <l.icon className="h-5 w-5" />
                    <span>{l.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
