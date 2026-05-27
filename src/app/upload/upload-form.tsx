"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadAndExtract } from "@/lib/actions";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  Camera, UploadCloud, Loader2, AlertTriangle, RotateCcw, CheckCircle2,
  XCircle, FileImage, FileText,
} from "lucide-react";

type Phase = "queued" | "compressing" | "uploading" | "reading" | "done" | "error";
type Item = {
  id: string;
  file: File;
  preview: string | null;
  phase: Phase;
  uploadId?: string;
  error?: string;
};

const MAX_BYTES = 2 * 1024 * 1024;
const CONCURRENCY = 3;

export function UploadForm() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [pending, startTransition] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: Item[] = [];
    for (const f of Array.from(files)) {
      const okType = f.type.startsWith("image/") || f.type === "application/pdf";
      if (!okType) continue;
      next.push({
        id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        phase: "queued",
      });
    }
    setItems((prev) => [...prev, ...next]);
  }

  function patch(id: string, p: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const found = prev.find((it) => it.id === id);
      if (found?.preview) URL.revokeObjectURL(found.preview);
      return prev.filter((it) => it.id !== id);
    });
  }

  function clearAll() {
    items.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
    setItems([]);
  }

  async function processOne(it: Item): Promise<{ ok: boolean; uploadId?: string; error?: string }> {
    patch(it.id, { phase: "compressing" });
    let f = it.file;
    if (f.type.startsWith("image/") && f.size > MAX_BYTES) {
      try {
        f = await imageCompression(f, { maxWidthOrHeight: 1920, maxSizeMB: 1.5, useWebWorker: true });
      } catch { /* fall back to original */ }
    }
    patch(it.id, { phase: "uploading" });
    // Brief delay so user sees uploading state before "reading" takes over
    await new Promise((r) => setTimeout(r, 120));
    patch(it.id, { phase: "reading" });
    const fd = new FormData();
    fd.set("file", f);
    const res = await uploadAndExtract(fd);
    if (res.ok) {
      patch(it.id, { phase: "done", uploadId: res.uploadId });
      return { ok: true, uploadId: res.uploadId };
    } else {
      patch(it.id, { phase: "error", error: res.error });
      return { ok: false, error: res.error };
    }
  }

  // Concurrency-limited runner: at most CONCURRENCY uploads in flight at once.
  async function runAll() {
    const queue = items.filter((it) => it.phase === "queued" || it.phase === "error");
    if (queue.length === 0) return;
    const cursor = { i: 0 };
    let ok = 0;
    let fail = 0;
    async function worker() {
      while (cursor.i < queue.length) {
        const idx = cursor.i++;
        const r = await processOne(queue[idx]);
        if (r.ok) ok++; else fail++;
      }
    }
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker());
    await Promise.all(workers);
    if (ok > 0) toast.success(`Read ${ok} timesheet${ok === 1 ? "" : "s"}` + (fail > 0 ? `, ${fail} failed` : ""));
    if (fail > 0 && ok === 0) toast.error(`${fail} timesheet${fail === 1 ? "" : "s"} failed to read`);
    // Route to the review queue so the manager sees the whole batch
    if (ok > 0) router.push("/review");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Take or choose at least one photo.");
      return;
    }
    startTransition(runAll);
  }

  const busy = pending;
  const doneCount = items.filter((it) => it.phase === "done").length;
  const errorCount = items.filter((it) => it.phase === "error").length;
  const queuedCount = items.filter((it) => it.phase === "queued").length;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {items.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-6 text-center hover:bg-muted/50"
          >
            <Camera className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">Take photo</span>
            <span className="text-xs text-muted-foreground">Opens the rear camera</span>
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-6 text-center hover:bg-muted/50"
          >
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Upload files</span>
            <span className="text-xs text-muted-foreground">Drop up to 25 photos or PDFs</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              {items.length} sheet{items.length === 1 ? "" : "s"}
              {doneCount > 0 && <span className="ml-2 text-emerald-700">{doneCount} done</span>}
              {errorCount > 0 && <span className="ml-2 text-destructive">{errorCount} failed</span>}
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => libraryRef.current?.click()} disabled={busy}>
                <UploadCloud className="h-4 w-4" /> Add more
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearAll} disabled={busy}>
                <RotateCcw className="h-4 w-4" /> Clear
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <FileTile key={it.id} item={it} onRemove={() => removeItem(it.id)} busy={busy} />
            ))}
          </div>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
      <input ref={libraryRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

      {items.length > 0 && (
        <Button type="submit" disabled={busy || queuedCount + errorCount === 0} className="min-h-[48px] w-full text-base">
          {busy ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Reading {queuedCount + items.filter(i => i.phase === "compressing" || i.phase === "uploading" || i.phase === "reading").length} sheets...</>
          ) : doneCount === items.length && doneCount > 0 ? (
            <><CheckCircle2 className="h-5 w-5" /> All read. Go to Review queue</>
          ) : (
            <><UploadCloud className="h-5 w-5" /> Read {queuedCount + errorCount} sheet{queuedCount + errorCount === 1 ? "" : "s"}</>
          )}
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Names and dates are auto-detected. You only fix what looks off in Review.
      </p>
    </form>
  );
}

function FileTile({ item, onRemove, busy }: { item: Item; onRemove: () => void; busy: boolean }) {
  const phaseLabel: Record<Phase, string> = {
    queued: "Queued",
    compressing: "Optimizing",
    uploading: "Uploading",
    reading: "Reading...",
    done: "Done",
    error: "Failed",
  };
  const phaseColor: Record<Phase, string> = {
    queued: "bg-muted text-muted-foreground",
    compressing: "bg-blue-100 text-blue-900",
    uploading: "bg-blue-100 text-blue-900",
    reading: "bg-amber-100 text-amber-900 animate-pulse",
    done: "bg-emerald-100 text-emerald-900",
    error: "bg-red-100 text-red-900",
  };
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="relative aspect-[4/3] bg-muted">
        {item.preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <FileText className="h-10 w-10" />
          </div>
        )}
        {!busy && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Remove"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
        <Badge className={cn("absolute bottom-1.5 left-1.5", phaseColor[item.phase])}>
          {item.phase === "done" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : item.phase === "error" ? <AlertTriangle className="mr-1 h-3 w-3" /> : item.phase === "reading" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileImage className="mr-1 h-3 w-3" />}
          {phaseLabel[item.phase]}
        </Badge>
      </div>
      <div className="p-2">
        <div className="truncate text-xs font-medium">{item.file.name}</div>
        {item.error && <div className="mt-0.5 text-[11px] text-destructive">{item.error}</div>}
        {item.uploadId && (
          <Link href={`/review/${item.uploadId}`} className="mt-0.5 inline-block text-[11px] text-primary underline">
            Open in Review
          </Link>
        )}
      </div>
    </div>
  );
}
