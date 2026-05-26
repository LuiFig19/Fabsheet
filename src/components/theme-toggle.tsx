"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ThemeToggleItems() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <>
      <DropdownMenuItem onClick={() => setTheme("light")}>
        <Sun className="h-4 w-4" /> Light {theme === "light" ? "✓" : ""}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("dark")}>
        <Moon className="h-4 w-4" /> Dark {theme === "dark" ? "✓" : ""}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("system")}>
        <Monitor className="h-4 w-4" /> System {theme === "system" ? "✓" : ""}
      </DropdownMenuItem>
    </>
  );
}
