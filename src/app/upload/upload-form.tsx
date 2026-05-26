"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { uploadAndExtract } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Camera, UploadCloud, Loader2, AlertTriangle, RotateCcw, CheckCircle2, Sparkles, ListChecks } from "lucide-react";

type Phase = "idle" | "compressing" | "uploading" | "reading" | "validating";
const MAX_BYTES = 2 * 1024 * 1024;

export function UploadForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configure, setConfigure] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function pickFile(f: File | null) {
    setError(null);
    if (!f) return;
    if (!(f.type.startsWith("image/") || f.type === "application/pdf")) {
      setError("Only image or PDF files are supported.");
      return;
    }
    let chosen = f;
    if (f.type.startsWith("image/") && f.size > MAX_BYTES) {
      setPhase("compressing");
      try {
        chosen = await imageCompression(f, { maxWidthOrHeight: 1920, maxSizeMB: 1.5, useWebWorker: true });
      } catch {
        chosen = f;
      }
      setPhase("idle");
    }
    setFile(chosen);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return f.type.startsWith("image/") ? URL.createObjectURL(chosen) : null;
    });
  }

  function retake() {
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConfigure(false);
    if (!file) {
      setError("Take or choose a photo of the timesheet first.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);

    startTransition(async () => {
      // Step bumps run in the foreground; the server action below blocks until
      // Vision returns, so we set "reading" before awaiting and trust the user
      // sees real progress (the spinner + label change).
      setPhase("uploading");
      // Tiny delay so the user actually sees this label.
      await new Promise((r) => setTimeout(r, 200));
      setPhase("reading");
      const res = await uploadAndExtract(fd);
      if (res.ok) {
        setPhase("validating");
        await new Promise((r) => setTimeout(r, 250));
        router.push(`/review/${res.uploadId}`);
      } else {
        setPhase("idle");
        setError(res.error);
        setConfigure(Boolean(res.configure));
      }
    });
  }

  const busy = pending || phase !== "idle";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {previewUrl ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Timesheet preview" className="max-h-80 w-full rounded-lg border object-contain" />
          <div className="flex justify-center">
            <Button type="button" variant="outline" onClick={retake} className="min-h-[44px]" disabled={busy}>
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
          </div>
        </div>
      ) : file ? (
        <div className="rounded-lg border p-4 text-center text-sm">
          {file.name}
          <div className="mt-2">
            <Button type="button" variant="outline" onClick={retake} className="min-h-[44px]">
              <RotateCcw className="h-4 w-4" /> Choose a different file
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-6 text-center hover:bg-muted/50"
          >
            <Camera className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">Take photo</span>
            <span className="text-xs text-muted-foreground">Opens the rear camera</span>
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-6 text-center hover:bg-muted/50"
          >
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Upload file</span>
            <span className="text-xs text-muted-foreground">Photo or PDF from this device</span>
          </button>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      <input ref={libraryRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div>{error}</div>
            {configure && (
              <Link href="/settings" className="font-medium underline">Configure in Settings</Link>
            )}
          </div>
        </div>
      )}

      <Button type="submit" disabled={busy || !file} className="min-h-[48px] w-full text-base">
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Reading the sheet...
          </>
        ) : (
          <>
            <UploadCloud className="h-5 w-5" /> Read this sheet
          </>
        )}
      </Button>

      {busy && <ProgressSteps phase={phase} />}

      <p className="text-center text-xs text-muted-foreground">
        The AI reads the welder's name and the date from the top of the sheet. You will not be asked to pick them.
      </p>
    </form>
  );
}

function ProgressSteps({ phase }: { phase: Phase }) {
  const steps: { key: Phase; label: string; icon: typeof Camera }[] = [
    { key: "compressing", label: "Optimizing photo", icon: Camera },
    { key: "uploading", label: "Uploading to server", icon: UploadCloud },
    { key: "reading", label: "AI is reading the timesheet (this takes 10-20s)", icon: Sparkles },
    { key: "validating", label: "Validating against your jobs", icon: ListChecks },
  ];
  const activeIdx = steps.findIndex((s) => s.key === phase);

  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-3">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.key} className={cn("flex items-center gap-3 text-sm", done && "text-muted-foreground", !done && !active && "opacity-50")}>
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : active ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <s.icon className="h-4 w-4" />
            )}
            <span className={cn(active && "font-medium text-foreground")}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
