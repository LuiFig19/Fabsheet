"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Upload,
  ClipboardCheck,
  Briefcase,
  FileText,
  Target,
  AlertTriangle,
  Settings,
  Download,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useTheme } from "next-themes";
import type { NavModule } from "@/lib/access";

export function CommandMenu({ modules }: { modules: NavModule[] }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Go to">
          {modules.map((m) => (
            <CommandItem key={m.href} onSelect={() => go(m.href)}>
              <CommandIcon keyName={m.key} /> {m.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Quick actions">
          {modules.some((m) => m.href === "/reports") && (
            <>
              <CommandItem onSelect={() => go("/reports?preset=week")}><Download className="h-4 w-4" /> Export this week</CommandItem>
              <CommandItem onSelect={() => go("/reports?preset=last_week")}><Download className="h-4 w-4" /> Export last week</CommandItem>
            </>
          )}
          {modules.some((m) => m.href === "/settings") && (
            <CommandItem onSelect={() => go("/settings#danger-zone")}><Settings className="h-4 w-4" /> Danger zone</CommandItem>
          )}
        </CommandGroup>
        <CommandGroup heading="Appearance">
          <CommandItem onSelect={() => { setTheme("light"); setOpen(false); }}><Sun className="h-4 w-4" /> Light mode</CommandItem>
          <CommandItem onSelect={() => { setTheme("dark"); setOpen(false); }}><Moon className="h-4 w-4" /> Dark mode</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Account">
          <CommandItem onSelect={async () => { await signOut(); router.push("/login"); router.refresh(); }}>
            <LogOut className="h-4 w-4" /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function CommandIcon({ keyName }: { keyName: string }) {
  if (keyName === "upload") return <Upload className="h-4 w-4" />;
  if (keyName === "review") return <ClipboardCheck className="h-4 w-4" />;
  if (keyName === "jobs") return <Briefcase className="h-4 w-4" />;
  if (keyName === "production") return <Target className="h-4 w-4" />;
  if (keyName === "attention") return <AlertTriangle className="h-4 w-4" />;
  if (keyName === "reports") return <FileText className="h-4 w-4" />;
  if (keyName === "settings" || keyName === "admin") return <Settings className="h-4 w-4" />;
  return <LayoutDashboard className="h-4 w-4" />;
}
