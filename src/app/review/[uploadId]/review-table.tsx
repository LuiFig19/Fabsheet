"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, computeDecimalHours, fmtHours } from "@/lib/utils";
import { addRow, approveAll, approveEntry, deleteRow, updateEntry } from "@/lib/actions";
import { toast } from "@/components/ui/sonner";
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

  // Shared per-row handlers, passed into card + table renderers.
  const handlers = {
    setLocal,
    persist,
    persistTimes,
    isLow,
    pending,
    onApprove: (id: string) => {
      setLocal(id, { status: "approved" });
      doAction(() => approveEntry(id));
      toast.success("Row approved");
    },
    onDelete: (id: string) => {
      doAction(() => deleteRow(id));
      toast.success("Row deleted");
    },
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"} . {pendingCount} pending approval
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { doAction(() => addRow(uploadId)); toast.success("Row added"); }} disabled={pending}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
          <Button size="sm" variant="success" onClick={() => { const n = pendingCount; doAction(() => approveAll(uploadId)); toast.success(`Approved ${n} row${n === 1 ? "" : "s"}`); }} disabled={pending || pendingCount === 0}>
            <CheckCheck className="h-4 w-4" /> Approve all
          </Button>
        </div>
      </div>

      {/* Mobile / tablet portrait: stacked cards. A 10-column table on a
          touch device gets compressed into a forest of overlapping clipped
          text — a card per entry keeps every field readable and tappable. */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
            No rows. Add one to record hours manually.
          </div>
        ) : (
          rows.map((e, idx) => (
            <EntryCard key={e.id} index={idx + 1} e={e} bubbleOptions={bubbleOptions} {...handlers} />
          ))
        )}
      </div>

      {/* Desktop / iPad landscape: full table. Scrolls horizontally if the
          viewport is still narrower than the sum of column widths. */}
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">JOB #</TableHead>
                <TableHead className="w-[160px]">Customer</TableHead>
                <TableHead className="w-[110px]">UNIT</TableHead>
                <TableHead className="w-[150px]">Task / Action</TableHead>
                <TableHead className="w-[170px]">Code</TableHead>
                <TableHead className="w-[110px]">Start</TableHead>
                <TableHead className="w-[110px]">End</TableHead>
                <TableHead className="w-[80px] text-right">Hours</TableHead>
                <TableHead className="min-w-[180px]">Notes</TableHead>
                <TableHead className="w-[170px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <RowFragment key={e.id} e={e} bubbleOptions={bubbleOptions} {...handlers} />
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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          Total hours: <span className="font-semibold text-foreground tabular-nums">{fmtHours(rows.reduce((s, r) => s + (r.decimalHours || 0), 0))}</span>
        </span>
        <span className="text-xs text-muted-foreground">Yellow = low confidence. Blue hours = manual override. Customer + code auto-filled.</span>
      </div>
    </div>
  );
}

// ---------- Mobile card layout ----------

type CardProps = {
  index: number;
  e: Entry;
  bubbleOptions: readonly string[];
  setLocal: (id: string, patch: Partial<Entry>) => void;
  persist: (id: string, fields: Record<string, string>) => void;
  persistTimes: (id: string) => void;
  isLow: (e: Entry, field: string) => boolean;
  pending: boolean;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
};

function EntryCard({ index, e, bubbleOptions, setLocal, persist, persistTimes, isLow, pending, onApprove, onDelete }: CardProps) {
  const approved = e.status === "approved";
  return (
    <div className={cn("space-y-3 rounded-lg border bg-card p-3", approved && "border-emerald-300/50")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Row {index}</div>
        {approved ? (
          <Badge variant="success" className="gap-1"><Check className="h-3 w-3" /> approved</Badge>
        ) : (
          <Badge variant="warning">pending</Badge>
        )}
      </div>

      <Field label="Job #">
        <TextCell value={e.workOrderNumber} low={isLow(e, "workOrderNumber") || e.jobMissing} onChange={(v) => setLocal(e.id, { workOrderNumber: v })} onCommit={(v) => persist(e.id, { workOrderNumber: v })} />
      </Field>

      <Field label="Customer">
        <ReadOnly
          value={e.derivedCustomer || (e.workOrderNumber ? "- job not in system -" : "(no job)")}
          muted={!e.derivedCustomer}
          truncate
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit">
          <UnitCell e={e} onCommit={(unitNumber, unitTotal) => persist(e.id, { unitNumber, unitTotal })} setLocal={(p) => setLocal(e.id, p)} />
        </Field>
        <Field label="Task / Action">
          <SelectCell
            value={e.description}
            options={bubbleOptions}
            low={isLow(e, "description")}
            onCommit={(v) => { setLocal(e.id, { description: v }); persist(e.id, { description: v }); }}
          />
        </Field>
      </div>

      <Field label="Labor code">
        <ReadOnly value={e.derivedCode || "-"} muted={!e.derivedCode} truncate />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Start">
          <TimeCell value={e.startTime} low={isLow(e, "startTime")} onChange={(v) => setLocal(e.id, { startTime: v })} onCommit={() => persistTimes(e.id)} />
        </Field>
        <Field label="End">
          <TimeCell value={e.endTime} low={isLow(e, "endTime")} onChange={(v) => setLocal(e.id, { endTime: v })} onCommit={() => persistTimes(e.id)} />
        </Field>
        <Field label="Hours">
          <HoursInput value={e.decimalHours} overridden={e.hoursOverridden} onChange={(n) => setLocal(e.id, { decimalHours: n, hoursOverridden: true })} onCommit={(v) => persist(e.id, { decimalHours: v })} />
        </Field>
      </div>

      <Field label="Notes">
        <input
          defaultValue={e.notes}
          placeholder="(none)"
          onBlur={(ev) => persist(e.id, { notes: ev.target.value })}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </Field>

      {e.rowWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <ul className="space-y-0.5">
            {e.rowWarnings.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground hover:text-destructive" onClick={() => onDelete(e.id)} disabled={pending} aria-label="Delete row">
          <Trash2 className="h-4 w-4" />
        </Button>
        {approved ? (
          <span className="text-xs text-muted-foreground">Approved</span>
        ) : (
          <Button size="sm" variant="success" className="h-10 px-4" onClick={() => onApprove(e.id)} disabled={pending}>
            <Check className="h-4 w-4" /> Approve row
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// ---------- Desktop table row ----------

function RowFragment({ e, bubbleOptions, setLocal, persist, persistTimes, isLow, pending, onApprove, onDelete }: Omit<CardProps, "index">) {
  return (
    <>
      <TableRow data-state={e.status}>
        <TableCell>
          <TextCell value={e.workOrderNumber} low={isLow(e, "workOrderNumber") || e.jobMissing} onChange={(v) => setLocal(e.id, { workOrderNumber: v })} onCommit={(v) => persist(e.id, { workOrderNumber: v })} />
        </TableCell>
        <TableCell>
          <ReadOnly value={e.derivedCustomer || (e.workOrderNumber ? "- job not in system -" : "")} muted={!e.derivedCustomer} truncate />
        </TableCell>
        <TableCell>
          <UnitCell e={e} onCommit={(unitNumber, unitTotal) => persist(e.id, { unitNumber, unitTotal })} setLocal={(p) => setLocal(e.id, p)} />
        </TableCell>
        <TableCell>
          <SelectCell
            value={e.description}
            options={bubbleOptions}
            low={isLow(e, "description")}
            onCommit={(v) => { setLocal(e.id, { description: v }); persist(e.id, { description: v }); }}
          />
        </TableCell>
        <TableCell>
          <ReadOnly value={e.derivedCode || "-"} muted={!e.derivedCode} truncate title="Auto-filled from Task/Action bubble" />
        </TableCell>
        <TableCell>
          <TimeCell value={e.startTime} low={isLow(e, "startTime")} onChange={(v) => setLocal(e.id, { startTime: v })} onCommit={() => persistTimes(e.id)} />
        </TableCell>
        <TableCell>
          <TimeCell value={e.endTime} low={isLow(e, "endTime")} onChange={(v) => setLocal(e.id, { endTime: v })} onCommit={() => persistTimes(e.id)} />
        </TableCell>
        <TableCell className="text-right">
          <HoursInput value={e.decimalHours} overridden={e.hoursOverridden} onChange={(n) => setLocal(e.id, { decimalHours: n, hoursOverridden: true })} onCommit={(v) => persist(e.id, { decimalHours: v })} />
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
              <Button size="sm" variant="success" onClick={() => onApprove(e.id)} disabled={pending}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(e.id)} disabled={pending} title="Delete row">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {e.rowWarnings.length > 0 && (
        <TableRow className="!border-t-0">
          <TableCell colSpan={10} className="!pt-0">
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <ul className="list-disc space-y-0.5 pl-4">
                {e.rowWarnings.map((w, i) => (<li key={i}>{w}</li>))}
              </ul>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ---------- Field helpers (used by both card + table renderers) ----------

function ReadOnly({ value, muted, title, truncate }: { value: string; muted?: boolean; title?: string; truncate?: boolean }) {
  return (
    <div
      title={title ?? value}
      className={cn(
        "flex h-10 items-center rounded-md border border-dashed border-input bg-muted/40 px-3 text-sm md:h-8 md:px-2",
        truncate && "overflow-hidden whitespace-nowrap",
        muted && "text-muted-foreground",
      )}
    >
      {truncate ? <span className="truncate">{value}</span> : value}
    </div>
  );
}

function TextCell({ value, low, onChange, onCommit }: { value: string; low: boolean; onChange: (v: string) => void; onCommit: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
      className={cn("h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:h-8 md:px-2", low && "field-low")}
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
      className={cn("h-10 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:h-8 md:px-2", low && "field-low")}
    />
  );
}

function SelectCell({ value, options, low, onCommit }: { value: string; options: readonly string[]; low: boolean; onCommit: (v: string) => void }) {
  const opts = options.includes(value) || value === "" || value === "Other" ? options : [value, ...options];
  return (
    <select
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      className={cn("h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:h-8 md:px-1", low && "field-low")}
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
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min="1"
        value={e.unitNumber ?? ""}
        onChange={(ev) => setLocal({ unitNumber: ev.target.value === "" ? null : Number(ev.target.value) })}
        onBlur={(ev) => onCommit(ev.target.value, String(e.unitTotal ?? total ?? ""))}
        placeholder="-"
        className="h-10 w-12 rounded-md border border-input bg-background px-1 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:h-8"
      />
      <span className="shrink-0 text-xs text-muted-foreground">of</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{total ?? "-"}</span>
    </div>
  );
}

function HoursInput({ value, overridden, onChange, onCommit }: { value: number; overridden: boolean; onChange: (n: number) => void; onCommit: (v: string) => void }) {
  return (
    <input
      type="number"
      step="0.25"
      value={Number.isFinite(value) ? value : 0}
      onChange={(ev) => onChange(Number(ev.target.value))}
      onBlur={(ev) => onCommit(ev.target.value)}
      className={cn(
        "h-10 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:h-8 md:w-[70px]",
        overridden && "border-blue-400 bg-blue-50 dark:bg-blue-950/40",
      )}
      title={overridden ? "Manual override" : "Auto from start/end"}
    />
  );
}
