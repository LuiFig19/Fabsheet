"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { uploadAndExtract } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Camera, UploadCloud, Loader2, AlertTriangle, RotateCcw } from "lucide-react";

type Employee = { id: string; name: string };
type Phase = "idle" | "compressing" | "uploading" | "extracting";

const MAX_BYTES = 2 * 1024 * 1024; // compress anything larger than 2MB

export function UploadForm({ employees, defaultDate }: { employees: Employee[]; defaultDate: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configure, setConfigure] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
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
    // Compress large photos client-side. PDFs are left as-is.
    if (f.type.startsWith("image/") && f.size > MAX_BYTES) {
      setPhase("compressing");
      try {
        chosen = await imageCompression(f, { maxWidthOrHeight: 1920, maxSizeMB: 1.5, useWebWorker: true });
      } catch {
        chosen = f; // fall back to original if compression fails
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
    setProgress(0);
  }

  // Real upload progress via XHR to a tiny endpoint, then run the server action.
  function uploadWithProgress(fd: FormData): Promise<void> {
    // Derive the URL from the current path so the access-prefix / tenant-slug is
    // preserved without the client needing to know it.
    const url = window.location.pathname.replace(/\/upload\/?$/, "") + "/api/upload-progress";
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload failed")));
      xhr.onerror = () => reject(new Error("upload failed"));
      xhr.send(fd);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConfigure(false);
    if (!file) {
      setError("Take or choose a photo of the timesheet first.");
      return;
    }
    const fd = new FormData(formRef.current!);
    fd.set("file", file);

    startTransition(async () => {
      try {
        setPhase("uploading");
        setProgress(0);
        await uploadWithProgress(cloneForProgress(fd));
      } catch {
        // Progress endpoint is best-effort; continue to the real action regardless.
      }
      setPhase("extracting");
      const res = await uploadAndExtract(fd);
      if (res.ok) {
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
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Employee</span>
          <Select name="employeeId" defaultValue={employees[0]?.id} required className="min-h-[44px]">
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Work date</span>
          <Input type="date" name="date" defaultValue={defaultDate} required className="min-h-[44px]" />
        </label>
      </div>

      {previewUrl ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Timesheet preview" className="max-h-80 w-full rounded-lg border object-contain" />
          <div className="flex justify-center">
            <Button type="button" variant="outline" onClick={retake} className="min-h-[44px]">
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

      {/* Rear camera on iPad/iPhone Safari. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      <input ref={libraryRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div>{error}</div>
            {configure && (
              <Link href="/settings" className="font-medium underline">
                Configure in Settings
              </Link>
            )}
          </div>
        </div>
      )}

      <Button type="submit" disabled={busy || !file} className="min-h-[48px] w-full text-base">
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {phase === "compressing" ? "Optimizing photo..." : phase === "uploading" ? "Uploading..." : "Reading timesheet..."}
          </>
        ) : (
          <>
            <UploadCloud className="h-5 w-5" /> Use photo
          </>
        )}
      </Button>

      {busy && (
        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {phase === "compressing" ? "Optimizing" : phase === "uploading" ? "Uploading" : "Extracting with Claude Vision"}
            </span>
            {phase === "uploading" && <span className="tabular-nums">{progress}%</span>}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-primary transition-all", phase === "extracting" && "animate-pulse w-full")}
              style={phase === "uploading" ? { width: `${progress}%` } : undefined}
            />
          </div>
        </div>
      )}
    </form>
  );
}

// Build a lightweight FormData (file only) for the progress probe so we get a
// real byte-based progress bar without duplicating the heavy server action.
function cloneForProgress(fd: FormData): FormData {
  const out = new FormData();
  const f = fd.get("file");
  if (f) out.set("file", f);
  return out;
}
