"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTenantContext, scopeWhere, scopeStamp } from "@/lib/tenant";

const jobSchema = z.object({
  workOrderNumber: z.string().min(1, "Work order number is required."),
  customerName: z.string().optional(),
  description: z.string().optional(),
  budgetedHours: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export async function createJob(formData: FormData) {
  const ctx = await getTenantContext();
  const parsed = jobSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await prisma.job.create({
    data: {
      ...scopeStamp(ctx),
      workOrderNumber: parsed.data.workOrderNumber,
      customerName: parsed.data.customerName ?? "",
      description: parsed.data.description ?? "",
      budgetedHours: parsed.data.budgetedHours ?? 0,
      notes: parsed.data.notes ?? "",
    },
  });
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true };
}

export async function updateJobBudget(jobId: string, budgetedHours: number) {
  const ctx = await getTenantContext();
  await prisma.job.updateMany({ where: { id: jobId, ...scopeWhere(ctx) }, data: { budgetedHours } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/");
}

export async function setJobStatus(jobId: string, status: "active" | "complete" | "on_hold") {
  const ctx = await getTenantContext();
  await prisma.job.updateMany({
    where: { id: jobId, ...scopeWhere(ctx) },
    data: { status, completedAt: status === "complete" ? new Date() : null },
  });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/");
}
