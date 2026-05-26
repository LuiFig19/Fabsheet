"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  clearTimesheets,
  clearEmployees,
  clearLaborCodes,
  clearTaskDescriptions,
  clearStoredKeys,
  clearEverything,
  type DangerResult,
} from "@/lib/settings-actions";
import { AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";

type Counts = {
  entries: number;
  uploads: number;
  jobs: number;
  employees: number;
  laborCodes: number;
  taskDescriptions: number;
  hasStoredKeys: boolean;
};

type ConfirmKind =
  | { kind: "timesheets" }
  | { kind: "employees" }
  | { kind: "codes" }
  | { kind: "descriptions" }
  | { kind: "keys" }
  | { kind: "everything" }
  | null;

export function DangerZone({ counts }: { counts: Counts }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [flash, setFlash] = useState<{ ok: boolean; message: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function ask(kind: NonNullable<ConfirmKind>["kind"]) {
    setConfirm({ kind });
    setFlash(null);
    queueMicrotask(() => dialogRef.current?.showModal());
  }
  function close() {
    dialogRef.current?.close();
    setConfirm(null);
  }
  function done(res: DangerResult, fallback: string) {
    if (res.ok) {
      const total = Object.values(res.deleted).reduce((s, n) => s + n, 0);
      setFlash({ ok: true, message: `Cleared. Removed ${total} record${total === 1 ? "" : "s"}.` });
    } else {
      setFlash({ ok: false, message: res.error || fallback });
    }
    close();
    router.refresh();
  }

  function run(fn: () => Promise<DangerResult>, fallback: string) {
    startTransition(async () => done(await fn(), fallback));
  }

  return (
    <Card className="border-red-300 bg-red-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-900">
          <AlertTriangle className="h-4 w-4" /> Danger zone
        </CardTitle>
        <p className="text-xs text-red-900/70">
          These actions delete data and cannot be undone. Each prompts before running.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row
          title="Clear timesheets (hours logged)"
          desc="Deletes every uploaded timesheet and every approved entry. Asks if you also want to delete jobs. Names, codes, descriptions, and API keys are preserved."
          counts={[
            { label: "entries", n: counts.entries },
            { label: "uploads", n: counts.uploads },
            { label: "jobs", n: counts.jobs },
          ]}
          onClick={() => ask("timesheets")}
          disabled={pending}
        />
        <Row
          title="Clear employees (names)"
          desc="Removes every employee. Any historical entries stay but are marked as having no employee."
          counts={[{ label: "employees", n: counts.employees }]}
          onClick={() => ask("employees")}
          disabled={pending}
        />
        <Row
          title="Clear labor codes"
          desc="Removes every labor code (110, 120, etc). Past entries keep their code string but new uploads will have no dropdown options until you add them back."
          counts={[{ label: "codes", n: counts.laborCodes }]}
          onClick={() => ask("codes")}
          disabled={pending}
        />
        <Row
          title="Clear task descriptions"
          desc="Removes Frame / Decking / Rails / etc. Past entries keep their description string."
          counts={[{ label: "descriptions", n: counts.taskDescriptions }]}
          onClick={() => ask("descriptions")}
          disabled={pending}
        />
        <Row
          title="Forget stored API keys"
          desc="Removes any keys you saved through Settings. Keys configured in environment variables still take precedence, so the live system keeps working."
          counts={[{ label: "stored", n: counts.hasStoredKeys ? 1 : 0 }]}
          onClick={() => ask("keys")}
          disabled={pending || !counts.hasStoredKeys}
        />
        <div className="border-t border-red-200 pt-3">
          <Row
            title="Clear EVERYTHING"
            desc="The nuclear option. Deletes timesheets, jobs, employees, codes, descriptions, stored keys, and the audit log. The company itself stays so you remain logged in."
            counts={[
              { label: "entries", n: counts.entries },
              { label: "jobs", n: counts.jobs },
              { label: "employees", n: counts.employees },
              { label: "codes+desc", n: counts.laborCodes + counts.taskDescriptions },
            ]}
            onClick={() => ask("everything")}
            disabled={pending}
            severe
          />
        </div>

        {flash && (
          <div
            className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
              flash.ok
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {flash.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
            <span>{flash.message}</span>
          </div>
        )}
      </CardContent>

      <dialog
        ref={dialogRef}
        onClose={() => setConfirm(null)}
        className="w-[min(440px,92vw)] rounded-lg p-0 backdrop:bg-black/40"
      >
        {confirm && (
          <div className="space-y-4 p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              {titleFor(confirm.kind)}
            </h3>
            <p className="text-sm text-muted-foreground">{bodyFor(confirm.kind, counts)}</p>

            {confirm.kind === "timesheets" ? (
              <div className="flex flex-col gap-2 pt-1">
                <Button variant="destructive" className="min-h-[44px] w-full" disabled={pending}
                  onClick={() => run(() => clearTimesheets(true), "Failed to clear")}>
                  <Trash2 className="h-4 w-4" /> Yes — clear timesheets AND jobs
                </Button>
                <Button variant="destructive" className="min-h-[44px] w-full opacity-90" disabled={pending}
                  onClick={() => run(() => clearTimesheets(false), "Failed to clear")}>
                  <Trash2 className="h-4 w-4" /> Yes — clear timesheets only (keep jobs)
                </Button>
                <Button variant="outline" className="min-h-[44px] w-full" onClick={close} disabled={pending}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
                <Button
                  variant="destructive"
                  className="min-h-[44px] sm:flex-1"
                  disabled={pending}
                  onClick={() => {
                    if (confirm.kind === "employees") run(clearEmployees, "Failed");
                    else if (confirm.kind === "codes") run(clearLaborCodes, "Failed");
                    else if (confirm.kind === "descriptions") run(clearTaskDescriptions, "Failed");
                    else if (confirm.kind === "keys") run(clearStoredKeys, "Failed");
                    else if (confirm.kind === "everything") run(clearEverything, "Failed");
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Yes, delete
                </Button>
                <Button variant="outline" className="min-h-[44px] sm:flex-1" onClick={close} disabled={pending}>
                  No, cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </Card>
  );
}

function titleFor(kind: NonNullable<ConfirmKind>["kind"]): string {
  switch (kind) {
    case "timesheets": return "Clear all timesheets?";
    case "employees": return "Clear all employees?";
    case "codes": return "Clear all labor codes?";
    case "descriptions": return "Clear all task descriptions?";
    case "keys": return "Forget stored API keys?";
    case "everything": return "Clear EVERYTHING?";
  }
}
function bodyFor(kind: NonNullable<ConfirmKind>["kind"], c: Counts): string {
  switch (kind) {
    case "timesheets": return `This removes ${c.entries} entr${c.entries === 1 ? "y" : "ies"} and ${c.uploads} upload${c.uploads === 1 ? "" : "s"}. Pick whether jobs should be deleted too. This cannot be undone.`;
    case "employees": return `This removes ${c.employees} employee${c.employees === 1 ? "" : "s"}. Past entries are kept but lose their employee link.`;
    case "codes": return `This removes ${c.laborCodes} labor code${c.laborCodes === 1 ? "" : "s"}. Past entries keep the code text but new uploads will have no dropdown options.`;
    case "descriptions": return `This removes ${c.taskDescriptions} description${c.taskDescriptions === 1 ? "" : "s"}.`;
    case "keys": return "Removes any API keys you saved in Settings. Environment-variable keys keep working.";
    case "everything": return `Deletes every timesheet, job, employee, code, description, stored key, and audit log for this company. You will be left with a blank app. This cannot be undone.`;
  }
}

function Row({
  title, desc, counts, onClick, disabled, severe,
}: {
  title: string;
  desc: string;
  counts: { label: string; n: number }[];
  onClick: () => void;
  disabled?: boolean;
  severe?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${severe ? "text-red-700" : ""}`}>{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {counts.map((c) => (
            <Badge key={c.label} variant="muted" className="font-mono">
              {c.n} {c.label}
            </Badge>
          ))}
        </div>
      </div>
      <Button variant="destructive" onClick={onClick} disabled={disabled} className="min-h-[44px] sm:w-auto">
        <Trash2 className="h-4 w-4" /> Clear
      </Button>
    </div>
  );
}
