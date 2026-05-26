"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, computeDecimalHours, fmtHours } from "@/lib/utils";
import { addRow, approveAll, approveEntry, deleteRow, updateEntry } from "@/lib/actions";
import { Check, Plus, Trash2, CheckCheck, AlertTriangle } from "lucide-react";

type Entry = {
  id: string;
  workOrderNumber: string;
  derivedCustomer: string;
  derivedCode: string;
  jobQuantity: number | null;
  unitNumber: number | null;
  unitTotal: number | null;
  description: string;
  notes: string;
  startTime: string;
  endTime: string;
  decimalHours: number;
  hoursOverridden: boolean;
  status: string;
  confidenceByField: Record<string, number>;
  rowWarnings: string[];
  jobMissing: boolean;
};

export function ReviewTable({
  uploadId,
  entries: initial,
  bubbleOptions,
  threshold,
}: {
  uploadId: string;
  entries: Entry[];
  bubbleOptions: readonly string[];
  threshold: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Entry[]>(initial);
  const [pending, startTransition] = useTransition();

  useEffect(() => setRows(initial), [initial]);

  const isLow = (e: Entry, field: string) => {
    const c = e.confidenceByField[field];
    return c !== undefined && c < threshold;
  };

  function setLocal(id: string, patch: Partial<Entry>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if ((patch.startTime !== undefined || patch.endTime !== undefined) && !next.hoursOverridden) {
          next.decimalHours = computeDecimalHours(next.startTime, next.endTime);
        }
        return next;
      }),
    );
  }

  function persist(id: string, fields: Record<string, string>) {
    const fd = new FormData();
    fd.set("entryId", id);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(async () => {
      await updateEntry(fd);
      router.refresh();
    });
  }

  function persistTimes(id: string) {
    const row = rows.find((r) => r.id === id);
    if (row) persist(id, { startTime: row.startTime, endTime: row.endTime });
  }

  function doAction(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const pendingCount = rows.filter((r) => r.status !== "approved").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"} . {pendingCount} pending approval
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => doAction(() => addRow(uploadId))} disabled={pending}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
          <Button size="sm" variant="success" onClick={() => doAction(() => approveAll(uploadId))} disabled={pending || pendingCount === 0}>
            <CheckCheck className="h-4 w-4" /> Approve all
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">JOB #</TableHead>
            <TableHead className="w-[140px]">Customer</TableHead>
            <TableHead className="w-[110px]">UNIT</TableHead>
            <TableHead className="w-[150px]">Task / Action</TableHead>
            <TableHead className="w-[150px]">Code</TableHead>
            <TableHead className="w-[100px]">Start</TableHead>
            <TableHead className="w-[100px]">End</TableHead>
            <TableHead className="w-[70px] text-right">Hours</TableHead>
            <TableHead className="min-w-[180px]">Notes</TableHead>
            <TableHead className="w-[150px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <>
              <TableRow key={e.id} data-state={e.status}>
                <TableCell>
                  <TextCell value={e.workOrderNumber} low={isLow(e, "workOrderNumber") || e.jobMissing} onChange={(v) => setLocal(e.id, { workOrderNumber: v })} onCommit={(v) => persist(e.id, { workOrderNumber: v })} />
                </TableCell>
                <TableCell>
                  <ReadOnly value={e.derivedCustomer || (e.workOrderNumber ? "- job not in system -" : "")} muted={!e.derivedCustomer} />
                </TableCell>
                <TableCell>
                  <UnitCell e={e} onCommit={(unitNumber, unitTotal) => persist(e.id, { unitNumber, unitTotal })} setLocal={(p) => setLocal(e.id, p)} />
                </TableCell>
                <TableCell>
                  <SelectCell
                    value={e.description}
                    options={bubbleOptions}
                    low={isLow(e, "description")}
                    onCommit={(v) => {
                      setLocal(e.id, { description: v });
                      persist(e.id, { description: v });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <ReadOnly value={e.derivedCode || "-"} muted={!e.derivedCode} title="Auto-filled from Task/Action bubble" />
                </TableCell>
                <TableCell>
                  <TimeCell value={e.startTime} low={isLow(e, "startTime")} onChange={(v) => setLocal(e.id, { startTime: v })} onCommit={() => persistTimes(e.id)} />
                </TableCell>
                <TableCell>
                  <TimeCell value={e.endTime} low={isLow(e, "endTime")} onChange={(v) => setLocal(e.id, { endTime: v })} onCommit={() => persistTimes(e.id)} />
                </TableCell>
                <TableCell className="text-right">
                  <input
                    type="number"
                    step="0.25"
                    value={Number.isFinite(e.decimalHours) ? e.decimalHours : 0}
                    onChange={(ev) => setLocal(e.id, { decimalHours: Number(ev.target.value), hoursOverridden: true })}
                    onBlur={(ev) => persist(e.id, { decimalHours: ev.target.value })}
                    className={cn(
                      "h-8 w-[70px] rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      e.hoursOverridden && "border-blue-400 bg-blue-50",
                    )}
                    title={e.hoursOverridden ? "Manual override" : "Auto from start/end"}
                  />
                </TableCell>
                <TableCell>
                  <input
                    defaultValue={e.notes}
                    placeholder="(none)"
                    onBlur={(ev) => persist(e.id, { notes: ev.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {e.status === "approved" ? (
                      <Badge variant="success"><Check className="mr-1 h-3 w-3" /> approved</Badge>
                    ) : (
                      <Button size="sm" variant="success" onClick={() => doAction(() => approveEntry(e.id))} disabled={pending}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => doAction(() => deleteRow(e.id))} disabled={pending} title="Delete row">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {e.rowWarnings.length > 0 && (
                <TableRow key={`${e.id}-warn`} className="!border-t-0">
                  <TableCell colSpan={10} className="!pt-0">
                    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <ul className="list-disc space-y-0.5 pl-4">
                        {e.rowWarnings.map((w, i) => (<li key={i}>{w}</li>))}
                      </ul>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                No rows. Add one to record hours manually.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          Total hours: <span className="font-semibold text-foreground tabular-nums">{fmtHours(rows.reduce((s, r) => s + (r.decimalHours || 0), 0))}</span>
        </span>
        <span className="text-xs text-muted-foreground">Yellow cell = low confidence. Blue hours = manual override. Customer + code auto-filled from JOB # + bubble.</span>
      </div>
    </div>
  );
}

function ReadOnly({ value, muted, title }: { value: string; muted?: boolean; title?: string }) {
  return (
    <div title={title} className={cn("flex h-8 items-center rounded-md border border-dashed border-input bg-muted/40 px-2 text-sm", muted && "text-muted-foreground")}>
      {value}
    </div>
  );
}

function TextCell({ value, low, onChange, onCommit }: { value: string; low: boolean; onChange: (v: string) => void; onCommit: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
      className={cn("h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", low && "field-low")}
    />
  );
}

function TimeCell({ value, low, onChange, onCommit }: { value: string; low: boolean; onChange: (v: string) => void; onCommit: () => void }) {
  return (
    <input
      type="time"
      step={900}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      className={cn("h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", low && "field-low")}
    />
  );
}

function SelectCell({ value, options, low, onCommit }: { value: string; options: readonly string[]; low: boolean; onCommit: (v: string) => void }) {
  const opts = options.includes(value) || value === "" || value === "Other" ? options : [value, ...options];
  return (
    <select
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      className={cn("h-8 w-full rounded-md border border-input bg-background px-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", low && "field-low")}
    >
      <option value="">-- pick --</option>
      {opts.map((o) => (<option key={o} value={o}>{o}</option>))}
      <option value="Other">Other (use Notes)</option>
    </select>
  );
}

function UnitCell({ e, onCommit, setLocal }: { e: Entry; onCommit: (unitNumber: string, unitTotal: string) => void; setLocal: (p: Partial<Entry>) => void }) {
  const total = e.jobQuantity ?? e.unitTotal ?? null;
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="1"
        value={e.unitNumber ?? ""}
        onChange={(ev) => setLocal({ unitNumber: ev.target.value === "" ? null : Number(ev.target.value) })}
        onBlur={(ev) => onCommit(ev.target.value, String(e.unitTotal ?? total ?? ""))}
        placeholder="-"
        className="h-8 w-10 rounded-md border border-input bg-background px-1 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <span className="text-xs text-muted-foreground">of</span>
      <span className="text-xs tabular-nums text-muted-foreground">{total ?? "-"}</span>
    </div>
  );
}
