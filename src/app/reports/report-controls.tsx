"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { emailReport } from "@/lib/report-actions";
import { Download, FileText, Mail, X } from "lucide-react";

type Preset = { value: string; label: string };

export function ReportControls({
  presets,
  preset,
  group,
  start,
  end,
  query,
  defaultEmailTo,
}: {
  presets: Preset[];
  preset: string;
  group: string;
  start: string;
  end: string;
  query: string;
  defaultEmailTo: string;
}) {
  const router = useRouter();
  const [emailOpen, setEmailOpen] = useState(false);

  function apply(next: Partial<{ preset: string; group: string; start: string; end: string }>) {
    const p = new URLSearchParams({ preset, group, start, end, ...next });
    if (p.get("preset") !== "custom") {
      p.delete("start");
      p.delete("end");
    }
    router.push(`/reports?${p.toString()}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Range</span>
            <Select value={preset} onChange={(e) => apply({ preset: e.target.value })} className="w-36">
              {presets.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>

          {preset === "custom" && (
            <>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">From</span>
                <Input type="date" defaultValue={start} onChange={(e) => apply({ start: e.target.value })} className="w-40" />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">To</span>
                <Input type="date" defaultValue={end} onChange={(e) => apply({ end: e.target.value })} className="w-40" />
              </label>
            </>
          )}

          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Group by</span>
            <Select value={group} onChange={(e) => apply({ group: e.target.value })} className="w-36">
              <option value="job">Job</option>
              <option value="employee">Employee</option>
              <option value="code">Labor code</option>
            </Select>
          </label>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`/api/report/pdf?${query}`}>
              <FileText className="h-4 w-4" /> Download PDF
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/report/csv?${query}`}>
              <Download className="h-4 w-4" /> Download CSV
            </a>
          </Button>
          <Button onClick={() => setEmailOpen(true)}>
            <Mail className="h-4 w-4" /> Email to...
          </Button>
        </div>

        {emailOpen && (
          <EmailDialog
            onClose={() => setEmailOpen(false)}
            defaultTo={defaultEmailTo}
            hidden={{ preset, group, start, end }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function EmailDialog({
  onClose,
  defaultTo,
  hidden,
}: {
  onClose: () => void;
  defaultTo: string;
  hidden: { preset: string; group: string; start: string; end: string };
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await emailReport(fd);
      setResult(res);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Email report</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="preset" value={hidden.preset} />
          <input type="hidden" name="group" value={hidden.group} />
          <input type="hidden" name="start" value={hidden.start} />
          <input type="hidden" name="end" value={hidden.end} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">To (comma separated)</span>
            <Input name="to" defaultValue={defaultTo} placeholder="office@ravensmarine.com" required />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Subject</span>
            <Input name="subject" defaultValue="Raven's Marine time report" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Message (optional)</span>
            <textarea name="message" rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </label>
          {result && (
            <p className={`text-sm ${result.ok ? "text-emerald-600" : "text-destructive"}`}>{result.message}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send PDF"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
