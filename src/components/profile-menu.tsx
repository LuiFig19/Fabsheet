"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/lib/auth-client";
import { toast } from "@/components/ui/sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeToggleItems } from "./theme-toggle";
import { LogOut, Settings as SettingsIcon } from "lucide-react";

function initials(name: string | null, email: string): string {
  const src = (name || email || "").trim();
  if (!src) return "?";
  const parts = src.split(/[\s@.]+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || src[0].toUpperCase();
}

export function ProfileMenu({ name, email, role }: { name: string | null; email: string; role: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  function doSignOut() {
    startTransition(async () => {
      await signOut();
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-accent">
          <Avatar><AvatarFallback>{initials(name, email)}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name || email}</div>
            <div className="truncate text-xs text-muted-foreground">{role}</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <SettingsIcon className="h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide">Theme</DropdownMenuLabel>
        <ThemeToggleItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={doSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
