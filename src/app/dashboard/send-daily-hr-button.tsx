"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { sendDailyHrEmail } from "@/lib/actions";
import { Mail, Loader2 } from "lucide-react";

export function SendDailyHrButton({ recipient }: { recipient: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      onClick={() =>
        startTransition(async () => {
          const res = await sendDailyHrEmail();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const detail = `${res.approvedCount}/${res.entryCount} approved across ${res.uploadCount} upload${res.uploadCount === 1 ? "" : "s"}`;
          if (res.mode === "sent") toast.success(`Sent today's packet to ${res.recipient} (${detail}).`);
          else toast.success(`Email not configured. Logged a "would send" to ${res.recipient} (${detail}). Set RESEND_API_KEY to send for real.`);
        })
      }
      disabled={pending}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
      {pending ? "Sending..." : `Email today to ${recipient}`}
    </Button>
  );
}
