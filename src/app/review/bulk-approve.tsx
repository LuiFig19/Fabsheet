"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { approveCleanUploads } from "@/lib/actions";
import { CheckCheck } from "lucide-react";

export function BulkApprove({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="success"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const res = await approveCleanUploads();
          if (res.ok) {
            toast.success(res.approved > 0 ? `Approved ${res.approved} clean sheet${res.approved === 1 ? "" : "s"}` : "No clean sheets to approve");
          } else {
            toast.error(res.error);
          }
          router.refresh();
        })
      }
    >
      <CheckCheck className="h-4 w-4" /> Approve all clean
    </Button>
  );
}
