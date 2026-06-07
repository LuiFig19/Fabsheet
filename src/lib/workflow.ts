import { prisma } from "@/lib/db";
import { isProductiveCode } from "@/lib/utils";
import type { TenantContext } from "@/lib/tenant";

export const WORKFLOW_STATUS = {
  NEEDS_REVIEW: "needs_review",
  NEEDS_CORRECTION: "needs_correction",
  FOREMAN_APPROVED: "foreman_approved",
  SENT_TO_HR: "sent_to_hr",
  ENTERED_IN_QB: "entered_in_quickbooks",
  PAYROLL_READY: "payroll_ready",
} as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS];

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    uploaded: "Uploaded",
    extracting: "Extracting",
    needs_review: "Foreman review",
    needs_correction: "Needs correction",
    approved: "Approved",
    foreman_approved: "Foreman approved",
    sent_to_hr: "Sent to HR",
    entered_in_quickbooks: "Entered in QuickBooks",
    payroll_ready: "Payroll ready",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

export function workflowBadgeTone(status: string): "success" | "warning" | "danger" | "muted" {
  if (["payroll_ready", "verified", "approved", "foreman_approved"].includes(status)) return "success";
  if (["needs_review", "sent_to_hr", "entered_in_quickbooks", "extracting"].includes(status)) return "warning";
  if (["needs_correction", "mismatch"].includes(status)) return "danger";
  return "muted";
}

export async function createWorkflowAudit(ctx: TenantContext, entityType: string, entityId: string, action: string, after: unknown) {
  return prisma.auditLog.create({
    data: {
      tenantId: ctx.tenant.id,
      entityType,
      entityId,
      action,
      after: after as object,
    },
  });
}

export async function workflowCounts(where: { tenantId?: string | null; divisionId?: string | null }) {
  const [needsReview, foremanApproved, sentToHr, enteredInQuickBooks, payrollReady] = await Promise.all([
    prisma.timesheetUpload.count({ where: { ...where, status: "needs_review" } }),
    prisma.timesheetUpload.count({ where: { ...where, status: "foreman_approved" } }),
    prisma.timesheetUpload.count({ where: { ...where, status: "sent_to_hr" } }),
    prisma.timesheetUpload.count({ where: { ...where, status: "entered_in_quickbooks" } }),
    prisma.timesheetUpload.count({ where: { ...where, status: "payroll_ready" } }),
  ]);
  return { needsReview, foremanApproved, sentToHr, enteredInQuickBooks, payrollReady };
}

export async function jobCostingSummary(where: { tenantId?: string | null; divisionId?: string | null }) {
  const jobs = await prisma.job.findMany({
    where: { ...where, status: { in: ["active", "on_hold"] } },
    select: {
      id: true,
      workOrderNumber: true,
      customerName: true,
      description: true,
      budgetedHours: true,
      entries: {
        where: { status: { in: ["approved", "foreman_approved", "sent_to_hr", "entered_in_quickbooks", "payroll_ready"] } },
        select: { decimalHours: true, laborCode: true, employee: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return jobs.map((job) => {
    const actualHours = job.entries.reduce((sum, entry) => sum + entry.decimalHours, 0);
    const productiveHours = job.entries.filter((entry) => isProductiveCode(entry.laborCode)).reduce((sum, entry) => sum + entry.decimalHours, 0);
    const supportHours = job.entries.filter((entry) => !isProductiveCode(entry.laborCode)).reduce((sum, entry) => sum + entry.decimalHours, 0);
    const budget = job.budgetedHours || 0;
    const pct = budget > 0 ? Math.round((actualHours / budget) * 100) : 0;
    return {
      id: job.id,
      workOrderNumber: job.workOrderNumber,
      customerName: job.customerName,
      description: job.description,
      budgetedHours: budget,
      actualHours,
      productiveHours,
      supportHours,
      pct,
      overBudget: budget > 0 && actualHours > budget,
      laborCost: actualHours * 45,
    };
  });
}
