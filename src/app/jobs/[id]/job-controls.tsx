"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setJobStatus, updateJobBudget } from "@/lib/jobs-actions";

export function JobControls({ jobId, budgetedHours, status }: { jobId: string; budgetedHours: number; status: string }) {
  const router = useRouter();
  const [budget, setBudget] = useState(String(budgetedHours));
  const [pending, startTransition] = useTransition();

  function saveBudget() {
    const n = Number(budget);
    if (Number.isNaN(n)) return;
    startTransition(async () => {
      await updateJobBudget(jobId, n);
      router.refresh();
    });
  }

  function changeStatus(next: "active" | "complete" | "on_hold") {
    startTransition(async () => {
      await setJobStatus(jobId, next);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-5">
        <div className="flex items-end gap-2">
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Budgeted hours</span>
            <Input type="number" step="1" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-32" />
          </label>
          <Button variant="outline" onClick={saveBudget} disabled={pending}>
            Save budget
          </Button>
        </div>
        <div className="flex gap-2">
          {status !== "active" && (
            <Button variant="outline" onClick={() => changeStatus("active")} disabled={pending}>
              Reopen
            </Button>
          )}
          {status !== "on_hold" && (
            <Button variant="outline" onClick={() => changeStatus("on_hold")} disabled={pending}>
              Put on hold
            </Button>
          )}
          {status !== "complete" && (
            <Button variant="success" onClick={() => changeStatus("complete")} disabled={pending}>
              Mark complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
