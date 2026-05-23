"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runExtraction } from "@/lib/extractors";
import { entriesFromExtraction, matchJobId } from "@/lib/mapping";
import { computeDecimalHours } from "@/lib/utils";
import { sha256 } from "@/lib/crypto";
import { putUpload } from "@/lib/storage";
import { getTenantContext, scopeWhere, scopeStamp, type TenantContext } from "@/lib/tenant";

async function audit(ctx: TenantContext, entityType: string, entityId: string, action: string, after: unknown = {}) {
  await prisma.auditLog.create({
    data: { tenantId: ctx.tenant.id, entityType, entityId, action, after: after as object },
  });
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/jobs");
  revalidatePath("/reports");
}

const uploadSchema = z.object({
  employeeId: z.string().min(1, "Pick an employee."),
  date: z.string().min(1, "Pick a date."),
});

export type UploadResult =
  | { ok: true; uploadId: string; source: string; cappedFallback: boolean }
  | { ok: false; error: string; configure?: boolean };

/**
 * Critical path. Store the file (R2 or disk), create the upload as "extracting",
 * run the orchestrated extractor (cache + cap + cost logging), persist rows in
 * needs_review with per-field confidence, attach jobs by work order, flip to
 * needs_review. Everything is stamped + scoped to the active tenant/division.
 */
export async function uploadAndExtract(formData: FormData): Promise<UploadResult> {
  const ctx = await getTenantContext();
  const parsed = uploadSchema.safeParse({
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // Employee must belong to this tenant/division.
  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, ...scopeWhere(ctx) },
  });
  if (!employee) return { ok: false, error: "Unknown employee for this company." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Attach a photo or PDF of the timesheet." };
  }
  const okType = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!okType) return { ok: false, error: "Only image or PDF files are supported." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = sha256(buffer);

  const upload = await prisma.timesheetUpload.create({
    data: {
      ...scopeStamp(ctx),
      filePath: "", // set after storage
      fileHash: hash,
      mimeType: file.type,
      employeeId: employee.id,
      date: new Date(parsed.data.date),
      status: "extracting",
    },
  });

  // Store the image (R2 in prod, disk in dev). Key is derived from upload id.
  const obj = await putUpload(ctx.tenant.slug, upload.id, file.name, buffer, file.type);
  await prisma.timesheetUpload.update({
    where: { id: upload.id },
    data: { filePath: obj.key, storageKey: obj.backend === "r2" ? obj.key : null, storageUrl: obj.url },
  });

  try {
    const { result, source, cappedFallback } = await runExtraction(buffer, file.type, ctx.tenant.id);
    const drafts = entriesFromExtraction(result);
    const jobs = await prisma.job.findMany({ where: scopeWhere(ctx), select: { id: true, workOrderNumber: true } });

    await prisma.$transaction([
      ...drafts.map((d) =>
        prisma.timesheetEntry.create({
          data: {
            ...scopeStamp(ctx),
            uploadId: upload.id,
            employeeId: employee.id,
            jobId: matchJobId(d.workOrderNumber, jobs),
            workOrderNumber: d.workOrderNumber,
            customerName: d.customerName,
            partId: d.partId,
            description: d.description,
            laborCode: d.laborCode,
            startTime: d.startTime,
            endTime: d.endTime,
            decimalHours: d.decimalHours,
            confidenceByField: d.confidenceByField,
            status: "needs_review",
          },
        }),
      ),
      prisma.timesheetUpload.update({
        where: { id: upload.id },
        data: {
          status: "needs_review",
          extractorName: source,
          rawExtractedJson: result as object,
          warnings: result.warnings,
          shiftStart: result.header.shiftStart.value,
          shiftEnd: result.header.shiftEnd.value,
        },
      }),
    ]);

    await audit(ctx, "TimesheetUpload", upload.id, "create", { source, rows: drafts.length });
    revalidateAll();
    return { ok: true, uploadId: upload.id, source, cappedFallback };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed.";
    await prisma.timesheetUpload.update({
      where: { id: upload.id },
      data: { status: "uploaded", warnings: [message] },
    });
    const configure = /ANTHROPIC_API_KEY|not set|not configured/i.test(message);
    return { ok: false, error: message, configure };
  }
}

const fieldSchema = z.object({
  entryId: z.string().min(1),
  workOrderNumber: z.string().optional(),
  customerName: z.string().optional(),
  partId: z.string().optional(),
  description: z.string().optional(),
  laborCode: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().optional(),
  decimalHours: z.string().optional(), // manual override when present
});

export async function updateEntry(formData: FormData) {
  const ctx = await getTenantContext();
  const parsed = fieldSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const { entryId, decimalHours, ...fields } = parsed.data;

  // Scope: entry must belong to this tenant/division.
  const existing = await prisma.timesheetEntry.findFirst({ where: { id: entryId, ...scopeWhere(ctx) } });
  if (!existing) return;

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) data[k] = v;

  if (typeof data.workOrderNumber === "string") {
    const jobs = await prisma.job.findMany({ where: scopeWhere(ctx), select: { id: true, workOrderNumber: true } });
    data.jobId = matchJobId(data.workOrderNumber, jobs);
  }

  if (decimalHours !== undefined && decimalHours !== "") {
    const h = Number(decimalHours);
    if (!Number.isNaN(h)) {
      data.decimalHours = h;
      data.hoursOverridden = true;
    }
  } else if (!existing.hoursOverridden && (data.startTime || data.endTime)) {
    const start = (data.startTime as string) ?? existing.startTime;
    const end = (data.endTime as string) ?? existing.endTime;
    data.decimalHours = computeDecimalHours(start, end);
  }

  await prisma.timesheetEntry.update({ where: { id: entryId }, data });
  await audit(ctx, "TimesheetEntry", entryId, "edit", data);
  revalidateAll();
}

export async function approveEntry(entryId: string) {
  const ctx = await getTenantContext();
  const updated = await prisma.timesheetEntry.updateMany({
    where: { id: entryId, ...scopeWhere(ctx) },
    data: { status: "approved", approvedAt: new Date() },
  });
  if (updated.count === 0) return;
  await audit(ctx, "TimesheetEntry", entryId, "approve");
  await maybeFinalize(entryId);
  revalidateAll();
}

export async function approveAll(uploadId: string) {
  const ctx = await getTenantContext();
  const upload = await prisma.timesheetUpload.findFirst({ where: { id: uploadId, ...scopeWhere(ctx) } });
  if (!upload) return;
  await prisma.timesheetEntry.updateMany({
    where: { uploadId, status: { not: "approved" } },
    data: { status: "approved", approvedAt: new Date() },
  });
  await prisma.timesheetUpload.update({ where: { id: uploadId }, data: { status: "approved" } });
  await audit(ctx, "TimesheetUpload", uploadId, "approve", { bulk: true });
  revalidateAll();
}

async function maybeFinalize(entryId: string) {
  const entry = await prisma.timesheetEntry.findUnique({ where: { id: entryId }, select: { uploadId: true } });
  if (!entry) return;
  const remaining = await prisma.timesheetEntry.count({
    where: { uploadId: entry.uploadId, status: { not: "approved" } },
  });
  if (remaining === 0) {
    await prisma.timesheetUpload.update({ where: { id: entry.uploadId }, data: { status: "approved" } });
  }
}

export async function addRow(uploadId: string) {
  const ctx = await getTenantContext();
  const upload = await prisma.timesheetUpload.findFirst({ where: { id: uploadId, ...scopeWhere(ctx) } });
  if (!upload) return;
  await prisma.timesheetEntry.create({
    data: {
      ...scopeStamp(ctx),
      uploadId,
      employeeId: upload.employeeId ?? null,
      startTime: "07:00",
      endTime: "08:00",
      decimalHours: computeDecimalHours("07:00", "08:00"),
      confidenceByField: {},
      status: "needs_review",
    },
  });
  await prisma.timesheetUpload.update({ where: { id: uploadId }, data: { status: "needs_review" } });
  revalidatePath("/review");
}

export async function deleteRow(entryId: string) {
  const ctx = await getTenantContext();
  const deleted = await prisma.timesheetEntry.deleteMany({ where: { id: entryId, ...scopeWhere(ctx) } });
  if (deleted.count === 0) return;
  await audit(ctx, "TimesheetEntry", entryId, "delete");
  revalidateAll();
}
