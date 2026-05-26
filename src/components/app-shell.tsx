"use client";
import { useState } from "react";
import { AppSidebar, TopBar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";

export function AppShell({
  company,
  user,
  children,
}: {
  company: string;
  user: { name: string | null; email: string; role: string } | null;
  children: React.ReactNode;
}) {
  // Command palette opens on Cmd/Ctrl+K globally (wired inside CommandMenu).
  // We also expose an explicit "Search" button on the top bar that opens it.
  const [, setOpenSignal] = useState(0);
  function openCommand() {
    // Synthesize a Cmd+K so the global handler inside CommandMenu picks it up.
    const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true });
    window.dispatchEvent(ev);
    setOpenSignal((n) => n + 1);
  }

  return (
    <div className="flex min-h-[100dvh] bg-muted/30">
      <AppSidebar company={company} user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={company} company={company} user={user} onOpenCommand={openCommand} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
      <CommandMenu />
    </div>
  );
}
