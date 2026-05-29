"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in the browser console + Vercel logs for debugging.
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Try again. If it keeps happening, contact luis@fabsheet.org
          {error.digest ? ` (ref ${error.digest})` : ""}.
        </p>
      </div>
      <Button onClick={reset} className="min-h-[44px]">
        <RotateCw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
