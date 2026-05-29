"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runExtraction } from "@/lib/extractors";
import {
  entriesFromExtraction,
  matchJobId,
  matchEmployee,
  parseHeaderDate,
  codeFromBubble,
  validateUnit,
} from "@/lib/mapping";
import { computeDecimalHours } from "@/lib/utils";
import { putUpload } from "@/lib/storage";
import { getTenantContext, scopeWhere, scopeStamp, tenantWhere, type TenantContext } from "@/lib/tenant";

// maxDuration is set on the calling route (src/app/upload/page.tsx) because
// "use server" files only allow async function exports.

async function audit(ctx: TenantContext, entityType: string, entityId: string, action: string, after: unknown = {}) {
  await prisma.auditLog.create({
    data: { tenantId: ctx.tenant.id, entityType, entityId, action, after: after as object },
  });
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath("/jobs");
  revalidatePath("/reports");
}

export type UploadResult =
  | { ok: true; uploadId: string; source: string; cappedFallback: boolean; detectedEmployee: string | null; detectedDate: string | null }
  | { ok: false; error: string; configure?: boolean };

/**
 * Critical path. V5: the manager does NOT pick the employee or date - the OCR
 * reads them from the header and we fuzzy-match the employee + parse the date.
 * If either can't be determined the upload still saves and the Review screen
 * banner asks for it.
 *
 * Stamps tenant/division on everything; passes job context into mapping so
 * customer + labor code are DERIVED, not extracted.
 */
export async function uploadAndExtract(formData: FormData): Promise<UploadResult> {
  const ctx = await getTenantContext();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Attach a photo or PDF of the timesheet." };
  }
  const okType = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!okType) return { ok: false, error: "Only image or PDF files are supported." };

  const buffer = Buffer.from(await file.arrayBuffer());

  // Create the upload row in "extracting" so the Review queue shows it
  // immediately (and won't be lost if extraction throws).
  const upload = await prisma.timesheetUpload.create({
    data: {
      ...scopeStamp(ctx),
      filePath: "",
      mimeType: file.type,
      date: new Date(), // placeholder; overwritten below from the OCR header or override
      status: "extracting",
    },
  });

  const obj = await putUpload(ctx.tenant.slug, upload.id, file.name, buffer, file.type);
  await prisma.timesheetUpload.update({
    where: { id: upload.id },
    data: { filePath: obj.key, storageKey: obj.backend === "r2" ? obj.key : null, storageUrl: obj.url },
  });

  try {
    const { result, source, cappedFallback } = await runExtraction(buffer, file.type, ctx.tenant.id);

    // Fuzzy-match employee + parse date from the OCR header.
    const [employees, jobs] = await Promise.all([
      prisma.employee.findMany({ where: scopeWhere(ctx) }),
      prisma.job.findMany({ where: scopeWhere(ctx), select: { id: true, workOrderNumber: true, customerName: true, quantity: true } }),
    ]);
    const matchedEmployee = matchEmployee(result.header.employeeName.value, employees);
    const parsedDate = parseHeaderDate(result.header.date.value);

    // Convert OCR rows into entry drafts with derived customer + code +
    // per-row warnings (UNIT validation, job-not-found, etc).
    const { drafts } = entriesFromExtraction({
      ex: result,
      jobs: jobs.map((j) => ({ id: j.id, workOrderNumber: j.workOrderNumber, customerName: j.customerName, quantity: j.quantity })),
    });

    const headerWarnings: string[] = [];
    if (!matchedEmployee) headerWarnings.push(`Could not auto-pick employee from header ("${result.header.employeeName.value || "blank"}"). Pick one above.`);
    if (!parsedDate) headerWarnings.push("Could not read the date. Pick one above.");
    const allWarnings = [...headerWarnings, ...result.warnings];

    await prisma.$transaction([
      ...drafts.map((d) =>
        prisma.timesheetEntry.create({
          data: {
            ...scopeStamp(ctx),
            uploadId: upload.id,
            employeeId: matchedEmployee?.id ?? null,
            jobId: matchJobId(d.workOrderNumber, jobs),
            workOrderNumber: d.workOrderNumber,
            customerName: d.customerName,
            unitNumber: d.unitNumber ?? null,
            unitTotal: d.unitTotal ?? null,
            description: d.description,
            laborCode: d.laborCode,
            startTime: d.startTime,
            endTime: d.endTime,
            decimalHours: d.decimalHours,
            notes: d.notes,
            confidenceByField: { ...d.confidenceByField, _rowWarnings: d.warnings.length },
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
          warnings: allWarnings,
          employeeId: matchedEmployee?.id ?? null,
          date: parsedDate ?? upload.date,
          // V5 has no shift fields. Use earliest start + latest end as a snapshot.
          shiftStart: drafts.length > 0 ? (drafts[0]?.startTime ?? "") : "",
          shiftEnd: drafts.length > 0 ? (drafts[drafts.length - 1]?.endTime ?? "") : "",
        },
      }),
    ]);

    // Save row-level warnings out of confidenceByField into a more useful place
    // (they're already on the entry record under _rowWarnings, but we also need
    // the actual strings on the row for the Review UI to render).
    await Promise.all(
      drafts.map(async (d, i) => {
        if (d.warnings.length === 0) return;
        const entry = await prisma.timesheetEntry.findFirst({
          where: { uploadId: upload.id, workOrderNumber: d.workOrderNumber, startTime: d.startTime },
          orderBy: { createdAt: "asc" },
          skip: 0,
        });
        if (!entry) return;
        const cby = (entry.confidenceByField as Record<string, unknown> | null) ?? {};
        await prisma.timesheetEntry.update({
          where: { id: entry.id },
          data: { confidenceByField: { ...cby, _warnings: d.warnings } },
        });
      }),
    );

    await audit(ctx, "TimesheetUpload", upload.id, "create", { source, rows: drafts.length });
    revalidateAll();
    return {
      ok: true,
      uploadId: upload.id,
      source,
      cappedFallback,
      detectedEmployee: matchedEmployee?.name ?? null,
      detectedDate: parsedDate ? parsedDate.toISOString().slice(0, 10) : null,
    };
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
  unitNumber: z.string().optional(),
  unitTotal: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().optional(),
  decimalHours: z.string().optional(),
});

export async function updateEntry(formData: FormData) {
  const ctx = await getTenantContext();
  const parsed = fieldSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const { entryId, decimalHours, ...fields } = parsed.data;

  const existing = await prisma.timesheetEntry.findFirst({ where: { id: entryId, ...scopeWhere(ctx) } });
  if (!existing) return;

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (k === "unitNumber" || k === "unitTotal") {
      data[k] = v === "" ? null : Number.parseInt(v, 10) || null;
    } else {
      data[k] = v;
    }
  }

  // Re-match job if work order changed; re-derive customer + code from new job
  // and current description.
  if (typeof data.workOrderNumber === "string") {
    const jobs = await prisma.job.findMany({ where: scopeWhere(ctx), select: { id: true, workOrderNumber: true, customerName: true } });
    const m = jobs.find((j) => j.workOrderNumber === (data.workOrderNumber as string).trim());
    data.jobId = m?.id ?? null;
    data.customerName = m?.customerName ?? "";
  }
  // If description (bubble) changed, re-derive labor code.
  if (typeof data.description === "string") {
    data.laborCode = codeFromBubble(data.description as string, null) || existing.laborCode;
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

/** Manager overrides the auto-detected employee or date on the upload itself. */
export async function updateUploadHeader(formData: FormData) {
  const ctx = await getTenantContext();
  const uploadId = String(formData.get("uploadId") ?? "");
  const upload = await prisma.timesheetUpload.findFirst({ where: { id: uploadId, ...scopeWhere(ctx) } });
  if (!upload) return;

  const data: Record<string, unknown> = {};
  const employeeId = formData.get("employeeId");
  if (typeof employeeId === "string") {
    if (employeeId === "") data.employeeId = null;
    else {
      const e = await prisma.employee.findFirst({ where: { id: employeeId, ...tenantWhere(ctx) } });
      if (e) {
        data.employeeId = e.id;
        // Propagate to all entries on this upload so reports group correctly.
        await prisma.timesheetEntry.updateMany({ where: { uploadId, ...tenantWhere(ctx) }, data: { employeeId: e.id } });
      }
    }
  }
  const date = formData.get("date");
  if (typeof date === "string" && date) {
    const d = parseHeaderDate(date) ?? new Date(date);
    if (!Number.isNaN(d.getTime())) data.date = d;
  }
  if (Object.keys(data).length > 0) {
    await prisma.timesheetUpload.update({ where: { id: uploadId }, data });
    await audit(ctx, "TimesheetUpload", uploadId, "edit_header", data);
    revalidateAll();
  }
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

/**
 * Bulk-approve every needs_review upload that has ZERO flags — no extractor
 * warnings and no per-row warnings. The manager only hand-reviews the sheets
 * that actually need attention. Returns how many uploads were approved.
 */
export async function approveCleanUploads(): Promise<{ ok: true; approved: number } | { ok: false; error: string }> {
  const ctx = await getTenantContext();
  const s = scopeWhere(ctx);
  const uploads = await prisma.timesheetUpload.findMany({
    where: { ...s, status: "needs_review" },
    include: { entries: { select: { confidenceByField: true } } },
  });

  const cleanIds: string[] = [];
  for (const u of uploads) {
    const warnings = Array.isArray(u.warnings) ? (u.warnings as unknown[]) : [];
    if (warnings.length > 0) continue;
    const hasRowWarning = u.entries.some((e) => {
      const cby = (e.confidenceByField as Record<string, unknown> | null) ?? {};
      return Array.isArray(cby._warnings) && (cby._warnings as unknown[]).length > 0;
    });
    if (hasRowWarning) continue;
    if (u.entries.length === 0) continue;
    cleanIds.push(u.id);
  }

  if (cleanIds.length === 0) return { ok: true, approved: 0 };

  await prisma.$transaction([
    prisma.timesheetEntry.updateMany({
      where: { uploadId: { in: cleanIds }, status: { not: "approved" } },
      data: { status: "approved", approvedAt: new Date() },
    }),
    prisma.timesheetUpload.updateMany({
      where: { id: { in: cleanIds } },
      data: { status: "approved" },
    }),
  ]);
  await audit(ctx, "TimesheetUpload", "bulk", "approve_clean", { count: cleanIds.length });
  revalidateAll();
  return { ok: true, approved: cleanIds.length };
}
