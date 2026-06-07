"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/access";
import { scopeWhere, tenantWhere } from "@/lib/tenant";
import { createWorkflowAudit, WORKFLOW_STATUS } from "@/lib/workflow";

function revalidateWorkflow() {
  revalidatePath("/foreman");
  revalidatePath("/hr");
  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath("/reports");
  revalidatePath("/big-honcho");
  revalidatePath("/executive");
}

async function scopedUpload(uploadId: string) {
  const ctx = await requirePermission("timesheets.review");
  const upload = await prisma.timesheetUpload.findFirst({
    where: { id: uploadId, ...scopeWhere(ctx) },
    include: { entries: true, employee: true },
  });
  return { ctx, upload };
}

export async function requestTimesheetCorrection(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const ctx = await requirePermission("timesheets.review");
  const entry = await prisma.timesheetEntry.findFirst({ where: { id: entryId, ...scopeWhere(ctx) } });
  if (!entry) return { ok: false, error: "Entry not found." };
  await prisma.timesheetEntry.update({ where: { id: entry.id }, data: { status: "needs_correction", notes: [entry.notes, reason].filter(Boolean).join(" | Correction: ") } });
  await prisma.timesheetUpload.update({ where: { id: entry.uploadId }, data: { status: "needs_review" } });
  await createWorkflowAudit(ctx, "TimesheetEntry", entry.id, "request_correction", { reason });
  revalidateWorkflow();
  return { ok: true };
}

export async function foremanApproveUpload(uploadId: string) {
  const { ctx, upload } = await scopedUpload(uploadId);
  if (!upload) return { ok: false, error: "Upload not found." };
  await prisma.$transaction([
    prisma.timesheetEntry.updateMany({
      where: { uploadId: upload.id, status: { in: ["needs_review", "needs_correction", "approved"] } },
      data: { status: WORKFLOW_STATUS.FOREMAN_APPROVED, approvedAt: new Date() },
    }),
    prisma.timesheetUpload.update({ where: { id: upload.id }, data: { status: WORKFLOW_STATUS.FOREMAN_APPROVED } }),
  ]);
  await createWorkflowAudit(ctx, "TimesheetUpload", upload.id, "foreman_approve", {
    rows: upload.entries.length,
    employee: upload.employee?.name ?? null,
    date: upload.date,
  });
  revalidateWorkflow();
  return { ok: true };
}

export async function submitUploadToHr(uploadId: string) {
  const { ctx, upload } = await scopedUpload(uploadId);
  if (!upload) return { ok: false, error: "Upload not found." };
  await prisma.$transaction([
    prisma.timesheetEntry.updateMany({
      where: { uploadId: upload.id, status: { in: [WORKFLOW_STATUS.FOREMAN_APPROVED, "approved"] } },
      data: { status: WORKFLOW_STATUS.SENT_TO_HR },
    }),
    prisma.timesheetUpload.update({ where: { id: upload.id }, data: { status: WORKFLOW_STATUS.SENT_TO_HR } }),
  ]);
  await createWorkflowAudit(ctx, "TimesheetUpload", upload.id, "submit_to_hr", {
    rows: upload.entries.length,
    totalHours: upload.entries.reduce((sum, entry) => sum + entry.decimalHours, 0),
  });
  revalidateWorkflow();
  return { ok: true };
}

export async function markEnteredInQuickBooks(uploadId: string) {
  const ctx = await requirePermission("hr.view");
  const upload = await prisma.timesheetUpload.findFirst({ where: { id: uploadId, ...scopeWhere(ctx) }, include: { entries: true } });
  if (!upload) return { ok: false, error: "Upload not found." };
  await prisma.$transaction([
    prisma.timesheetEntry.updateMany({ where: { uploadId: upload.id, status: WORKFLOW_STATUS.SENT_TO_HR }, data: { status: WORKFLOW_STATUS.ENTERED_IN_QB } }),
    prisma.timesheetUpload.update({ where: { id: upload.id }, data: { status: WORKFLOW_STATUS.ENTERED_IN_QB } }),
  ]);
  await createWorkflowAudit(ctx, "QuickBooksExport", upload.id, "entered_in_quickbooks", {
    rows: upload.entries.length,
    totalHours: upload.entries.reduce((sum, entry) => sum + entry.decimalHours, 0),
  });
  revalidateWorkflow();
  return { ok: true };
}

const verificationSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  clockHours: z.coerce.number().min(0).max(24),
  notes: z.string().optional(),
});

export async function verifyTimeClockAgainstProduction(formData: FormData) {
  const ctx = await requirePermission("hr.view");
  const parsed = verificationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Enter employee, date, and clock hours." };

  const date = new Date(`${parsed.data.date}T00:00:00`);
  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  const [employee, entries] = await Promise.all([
    prisma.employee.findFirst({ where: { id: parsed.data.employeeId, ...tenantWhere(ctx) } }),
    prisma.timesheetEntry.findMany({
      where: {
        ...scopeWhere(ctx),
        employeeId: parsed.data.employeeId,
        upload: { date: { gte: start, lt: end } },
        status: { in: [WORKFLOW_STATUS.ENTERED_IN_QB, WORKFLOW_STATUS.PAYROLL_READY, WORKFLOW_STATUS.SENT_TO_HR, WORKFLOW_STATUS.FOREMAN_APPROVED, "approved"] },
      },
      select: { decimalHours: true, uploadId: true },
    }),
  ]);
  if (!employee) return { ok: false, error: "Employee not found." };

  const productionHours = entries.reduce((sum, entry) => sum + entry.decimalHours, 0);
  const diff = Number((parsed.data.clockHours - productionHours).toFixed(2));
  const abs = Math.abs(diff);
  const status = abs <= 0.05 ? "match" : abs <= 0.5 ? "warning" : "mismatch";
  const uploadIds = Array.from(new Set(entries.map((entry) => entry.uploadId)));

  await createWorkflowAudit(ctx, "TimeClockVerification", `${employee.id}:${parsed.data.date}`, "verify_time_clock", {
    employeeId: employee.id,
    employeeName: employee.name,
    date: parsed.data.date,
    clockHours: parsed.data.clockHours,
    productionHours,
    difference: diff,
    status,
    notes: parsed.data.notes ?? "",
    verifiedBy: ctx.user?.email ?? "system",
    verifiedAt: new Date().toISOString(),
    uploadIds,
  });

  if (status === "match" && uploadIds.length > 0) {
    await prisma.$transaction([
      prisma.timesheetEntry.updateMany({ where: { uploadId: { in: uploadIds }, status: WORKFLOW_STATUS.ENTERED_IN_QB }, data: { status: WORKFLOW_STATUS.PAYROLL_READY } }),
      prisma.timesheetUpload.updateMany({ where: { id: { in: uploadIds }, status: WORKFLOW_STATUS.ENTERED_IN_QB }, data: { status: WORKFLOW_STATUS.PAYROLL_READY } }),
    ]);
  }

  revalidateWorkflow();
  return { ok: true, status, difference: diff };
}

export async function markPayrollReady(uploadId: string) {
  const ctx = await requirePermission("hr.view");
  const upload = await prisma.timesheetUpload.findFirst({ where: { id: uploadId, ...scopeWhere(ctx) }, include: { entries: true } });
  if (!upload) return { ok: false, error: "Upload not found." };
  await prisma.$transaction([
    prisma.timesheetEntry.updateMany({ where: { uploadId: upload.id }, data: { status: WORKFLOW_STATUS.PAYROLL_READY } }),
    prisma.timesheetUpload.update({ where: { id: upload.id }, data: { status: WORKFLOW_STATUS.PAYROLL_READY } }),
  ]);
  await createWorkflowAudit(ctx, "TimesheetUpload", upload.id, "mark_payroll_ready", {
    rows: upload.entries.length,
    totalHours: upload.entries.reduce((sum, entry) => sum + entry.decimalHours, 0),
  });
  revalidateWorkflow();
  return { ok: true };
}
