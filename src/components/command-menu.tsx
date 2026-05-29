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
  Settings,
  Download,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useTheme } from "next-themes";

export function CommandMenu() {
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
          <CommandItem onSelect={() => go("/dashboard")}><LayoutDashboard className="h-4 w-4" /> Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/upload")}><Upload className="h-4 w-4" /> Upload timesheet</CommandItem>
          <CommandItem onSelect={() => go("/review")}><ClipboardCheck className="h-4 w-4" /> Review queue</CommandItem>
          <CommandItem onSelect={() => go("/jobs")}><Briefcase className="h-4 w-4" /> Jobs</CommandItem>
          <CommandItem onSelect={() => go("/production")}><Target className="h-4 w-4" /> Production breakdown</CommandItem>
          <CommandItem onSelect={() => go("/reports")}><FileText className="h-4 w-4" /> Reports</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Settings className="h-4 w-4" /> Settings</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/reports?preset=week")}><Download className="h-4 w-4" /> Export this week</CommandItem>
          <CommandItem onSelect={() => go("/reports?preset=last_week")}><Download className="h-4 w-4" /> Export last week</CommandItem>
          <CommandItem onSelect={() => go("/settings#danger-zone")}><Settings className="h-4 w-4" /> Danger zone</CommandItem>
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
