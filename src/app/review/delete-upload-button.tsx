"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteUpload } from "@/lib/actions";
import { toast } from "@/components/ui/sonner";
import { Trash2 } from "lucide-react";

/**
 * Destructive delete with a native confirm() — small surface, no modal lib
 * needed. The action cascade-deletes the upload's rows on the server side.
 */
export function DeleteUploadButton({ uploadId, employee }: { uploadId: string; employee: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(
      `Delete ${employee}'s timesheet? This removes the upload and all its rows. The stored photo stays cached so you can re-upload the same image without re-billing OCR.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteUpload(uploadId);
      if (res.ok) toast.success(`Deleted ${employee}'s timesheet.`);
      else toast.error(res.error);
    });
  }

  return (
    <Button type="button" size="sm" variant="ghost" onClick={onClick} disabled={pending} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
      <Trash2 className="h-4 w-4" /> {pending ? "Deleting..." : "Delete"}
    </Button>
  );
}
