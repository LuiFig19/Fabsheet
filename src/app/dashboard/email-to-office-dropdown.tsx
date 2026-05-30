"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { sendDailyHrEmail, type DailyRecipient } from "@/lib/actions";
import { ChevronDown, Loader2, Mail } from "lucide-react";

export type RosterMember = { id: string; name: string; hasEmail: boolean };

/**
 * "Email to Office" button that doubles as a recipient picker. The button
 * always says "Email to Office" — never displays a raw address. Click opens a
 * menu: Office first (default), then the active roster. Selecting any item
 * fires the email immediately — no confirm step, no submit button.
 *
 * People without an email on file appear disabled with a "(no email)" hint so
 * the manager knows what to fix in Settings, instead of just hiding them.
 */
export function EmailToOfficeDropdown({
  roster,
  officeReady,
}: {
  roster: RosterMember[];
  officeReady: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function send(recipient: DailyRecipient) {
    setOpen(false);
    startTransition(async () => {
      const res = await sendDailyHrEmail(recipient);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const detail = `${res.approvedCount}/${res.entryCount} approved, ${res.uploadCount} upload${res.uploadCount === 1 ? "" : "s"}`;
      if (res.mode === "sent") toast.success(`Sent today to ${res.recipientLabel} (${detail}).`);
      else toast.success(`Logged a "would send" to ${res.recipientLabel} (${detail}). Set RESEND_API_KEY to send for real.`);
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {pending ? "Sending..." : "Email to Office"}
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] w-60 overflow-y-auto">
        <DropdownMenuLabel>Send today&apos;s packet to</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!officeReady}
          onSelect={(e) => {
            e.preventDefault();
            send({ kind: "office" });
          }}
        >
          <Mail className="h-4 w-4 text-primary" />
          <span className="flex-1">Office</span>
          {!officeReady && <span className="text-[10px] text-muted-foreground">set in Settings</span>}
        </DropdownMenuItem>
        {roster.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide">Team</DropdownMenuLabel>
            {roster.map((m) => (
              <DropdownMenuItem
                key={m.id}
                disabled={!m.hasEmail}
                onSelect={(e) => {
                  e.preventDefault();
                  send({ kind: "employee", employeeId: m.id });
                }}
              >
                <Mail className="h-4 w-4 opacity-50" />
                <span className="flex-1 truncate">{m.name}</span>
                {!m.hasEmail && <span className="text-[10px] text-muted-foreground">no email</span>}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
