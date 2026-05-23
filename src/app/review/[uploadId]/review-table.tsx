"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, computeDecimalHours, fmtHours } from "@/lib/utils";
import { addRow, approveAll, approveEntry, deleteRow, updateEntry } from "@/lib/actions";
import { Check, Plus, Trash2, CheckCheck } from "lucide-react";

type Entry = {
  id: string;
  workOrderNumber: string;
  customerName: string;
  partId: string;
  description: string;
  laborCode: string;
  startTime: string;
  endTime: string;
  decimalHours: number;
  hoursOverridden: boolean;
  notes: string;
  status: string;
  confidenceByField: Record<string, number>;
};

type TextField = "workOrderNumber" | "customerName" | "partId" | "startTime" | "endTime";

export function ReviewTable({
  uploadId,
  entries: initial,
  descriptions,
  laborCodes,
  threshold,
}: {
  uploadId: string;
  entries: Entry[];
  descriptions: string[];
  laborCodes: string[];
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
            <TableHead className="w-[90px]">WO #</TableHead>
            <TableHead className="w-[130px]">Customer</TableHead>
            <TableHead className="w-[90px]">Part ID</TableHead>
            <TableHead className="w-[130px]">Description</TableHead>
            <TableHead className="w-[170px]">Code</TableHead>
            <TableHead className="w-[110px]">Start</TableHead>
            <TableHead className="w-[110px]">End</TableHead>
            <TableHead className="w-[80px] text-right">Hours</TableHead>
            <TableHead className="w-[150px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id} data-state={e.status}>
              <TableCell>
                <TextCell value={e.workOrderNumber} low={isLow(e, "workOrderNumber")} onChange={(v) => setLocal(e.id, { workOrderNumber: v })} onCommit={(v) => persist(e.id, { workOrderNumber: v })} />
              </TableCell>
              <TableCell>
                <TextCell value={e.customerName} low={isLow(e, "customerName")} onChange={(v) => setLocal(e.id, { customerName: v })} onCommit={(v) => persist(e.id, { customerName: v })} />
              </TableCell>
              <TableCell>
                <TextCell value={e.partId} low={isLow(e, "partId")} onChange={(v) => setLocal(e.id, { partId: v })} onCommit={(v) => persist(e.id, { partId: v })} />
              </TableCell>
              <TableCell>
                <DescriptionCell
                  value={e.description}
                  options={descriptions}
                  low={isLow(e, "description")}
                  onCommit={(v) => {
                    setLocal(e.id, { description: v });
                    persist(e.id, { description: v });
                  }}
                />
              </TableCell>
              <TableCell>
                <SelectCell
                  value={e.laborCode}
                  options={laborCodes}
                  low={isLow(e, "laborCode")}
                  onCommit={(v) => {
                    setLocal(e.id, { laborCode: v });
                    persist(e.id, { laborCode: v });
                  }}
                />
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
                <div className="flex items-center gap-1">
                  {e.status === "approved" ? (
                    <Badge variant="success">
                      <Check className="mr-1 h-3 w-3" /> approved
                    </Badge>
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
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
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
        <span className="text-xs text-muted-foreground">Yellow cell = low confidence. Blue hours = manual override.</span>
      </div>
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

function SelectCell({ value, options, low, onCommit }: { value: string; options: string[]; low: boolean; onCommit: (v: string) => void }) {
  const opts = options.includes(value) || value === "" ? options : [value, ...options];
  return (
    <select
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      className={cn("h-8 w-full rounded-md border border-input bg-background px-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", low && "field-low")}
    >
      <option value="">--</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Description enforces one of the nine options, or "Other" with manual text. */
function DescriptionCell({ value, options, low, onCommit }: { value: string; options: string[]; low: boolean; onCommit: (v: string) => void }) {
  const isKnown = options.includes(value);
  const [other, setOther] = useState(!isKnown && value !== "");

  if (other) {
    return (
      <div className="flex flex-col gap-1">
        <input
          autoFocus
          defaultValue={isKnown ? "" : value}
          placeholder="Other..."
          onBlur={(e) => onCommit(e.target.value)}
          className={cn("h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", low && "field-low")}
        />
        <button type="button" className="text-left text-[10px] text-muted-foreground underline" onClick={() => setOther(false)}>
          pick from list
        </button>
      </div>
    );
  }
  return (
    <select
      value={isKnown ? value : ""}
      onChange={(e) => {
        if (e.target.value === "__other__") setOther(true);
        else onCommit(e.target.value);
      }}
      className={cn("h-8 w-full rounded-md border border-input bg-background px-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", low && "field-low")}
    >
      <option value="">--</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value="__other__">Other...</option>
    </select>
  );
}
