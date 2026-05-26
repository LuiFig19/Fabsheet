"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { getTenantContext, scopeStamp, tenantStamp, tenantWhere } from "@/lib/tenant";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/review");
  revalidatePath("/reports");
  revalidatePath("/settings");
}

async function danger(action: string, after: Record<string, unknown> = {}) {
  const ctx = await getTenantContext();
  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenant.id,
      entityType: "Settings",
      entityId: "danger-zone",
      action,
      after: after as object,
    },
  });
}

/** The Company config row for the active tenant (created if missing). */
async function companyId(): Promise<{ companyId: string; tenantId: string; divisionId: string | null }> {
  const ctx = await getTenantContext();
  let c = await prisma.company.findFirst({ where: { tenantId: ctx.tenant.id } });
  if (!c) c = await prisma.company.create({ data: { tenantId: ctx.tenant.id, name: ctx.tenant.name } });
  return { companyId: c.id, tenantId: ctx.tenant.id, divisionId: ctx.division?.id ?? null };
}

export async function updateCompany(formData: FormData) {
  const { companyId: id } = await companyId();
  await prisma.company.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "Raven's Marine"),
      address: String(formData.get("address") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      defaultEmailTo: String(formData.get("defaultEmailTo") ?? ""),
      resendFrom: String(formData.get("resendFrom") ?? ""),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function updateOcrSettings(formData: FormData) {
  const { companyId: id } = await companyId();
  const threshold = Number(formData.get("ocrThreshold"));
  const cap = Number(formData.get("dailyApiCap"));
  const target = Number(formData.get("weeklyProductionTarget"));
  await prisma.company.update({
    where: { id },
    data: {
      ocrThreshold: Number.isFinite(threshold) ? Math.min(1, Math.max(0, threshold)) : 0.7,
      dailyApiCap: Number.isFinite(cap) ? Math.max(0, Math.round(cap)) : 100,
      weeklyProductionTarget: Number.isFinite(target) ? Math.max(0, Math.round(target)) : 850,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function saveKeys(formData: FormData) {
  const { companyId: id } = await companyId();
  const anthropic = String(formData.get("anthropicKey") ?? "").trim();
  const resend = String(formData.get("resendKey") ?? "").trim();
  const data: Record<string, string> = {};
  if (anthropic) data.anthropicKeyEnc = encryptSecret(anthropic);
  if (resend) data.resendKeyEnc = encryptSecret(resend);
  if (Object.keys(data).length > 0) await prisma.company.update({ where: { id }, data });
  revalidatePath("/settings");
}

export async function addEmployee(formData: FormData) {
  const ctx = await getTenantContext();
  const name = String(formData.get("name") ?? "").trim();
  if (name) await prisma.employee.create({ data: { ...scopeStamp(ctx), name } });
  revalidatePath("/settings");
  revalidatePath("/upload");
}

export async function toggleEmployee(formData: FormData) {
  const ctx = await getTenantContext();
  const id = String(formData.get("id"));
  const e = await prisma.employee.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (e) await prisma.employee.update({ where: { id }, data: { active: !e.active } });
  revalidatePath("/settings");
}

export async function addLaborCode(formData: FormData) {
  const ctx = await getTenantContext();
  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (code && description) {
    await prisma.laborCode.upsert({
      where: { tenantId_code: { tenantId: ctx.tenant.id, code } },
      create: { ...tenantStamp(ctx), code, description },
      update: { description, active: true },
    });
  }
  revalidatePath("/settings");
}

export async function toggleLaborCode(formData: FormData) {
  const ctx = await getTenantContext();
  const id = String(formData.get("id"));
  const c = await prisma.laborCode.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (c) await prisma.laborCode.update({ where: { id }, data: { active: !c.active } });
  revalidatePath("/settings");
}

export async function addDescription(formData: FormData) {
  const ctx = await getTenantContext();
  const name = String(formData.get("name") ?? "").trim();
  if (name) {
    await prisma.taskDescription.upsert({
      where: { tenantId_name: { tenantId: ctx.tenant.id, name } },
      create: { ...tenantStamp(ctx), name },
      update: { active: true },
    });
  }
  revalidatePath("/settings");
}

export async function toggleDescription(formData: FormData) {
  const ctx = await getTenantContext();
  const id = String(formData.get("id"));
  const d = await prisma.taskDescription.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (d) await prisma.taskDescription.update({ where: { id }, data: { active: !d.active } });
  revalidatePath("/settings");
}

// --- Danger Zone -----------------------------------------------------------
// All scoped by tenantId; never cross-tenant.

export type DangerResult = { ok: true; deleted: Record<string, number> } | { ok: false; error: string };

/** Wipe all timesheets (entries + uploads). Optionally also wipe Jobs.
 *  Names, codes, descriptions, settings, and API keys are NOT touched. */
export async function clearTimesheets(includeJobs: boolean): Promise<DangerResult> {
  const ctx = await getTenantContext();
  const tw = tenantWhere(ctx);
  const entries = await prisma.timesheetEntry.deleteMany({ where: tw });
  const uploads = await prisma.timesheetUpload.deleteMany({ where: tw });
  let jobs = { count: 0 };
  if (includeJobs) jobs = await prisma.job.deleteMany({ where: tw });
  const deleted = { entries: entries.count, uploads: uploads.count, jobs: jobs.count };
  await danger("clear_timesheets", { includeJobs, ...deleted });
  revalidateAll();
  return { ok: true, deleted };
}

/** Wipe all Employees. Nulls them out on any remaining entries/uploads first
 *  so the foreign-key constraint does not block. */
export async function clearEmployees(): Promise<DangerResult> {
  const ctx = await getTenantContext();
  const tw = tenantWhere(ctx);
  await prisma.timesheetEntry.updateMany({ where: tw, data: { employeeId: null } });
  await prisma.timesheetUpload.updateMany({ where: tw, data: { employeeId: null } });
  const r = await prisma.employee.deleteMany({ where: tw });
  await danger("clear_employees", { count: r.count });
  revalidateAll();
  return { ok: true, deleted: { employees: r.count } };
}

export async function clearLaborCodes(): Promise<DangerResult> {
  const ctx = await getTenantContext();
  const r = await prisma.laborCode.deleteMany({ where: tenantWhere(ctx) });
  await danger("clear_labor_codes", { count: r.count });
  revalidateAll();
  return { ok: true, deleted: { laborCodes: r.count } };
}

export async function clearTaskDescriptions(): Promise<DangerResult> {
  const ctx = await getTenantContext();
  const r = await prisma.taskDescription.deleteMany({ where: tenantWhere(ctx) });
  await danger("clear_task_descriptions", { count: r.count });
  revalidateAll();
  return { ok: true, deleted: { taskDescriptions: r.count } };
}

/** Forget API keys stored in the Company row. Keys set via env vars still
 *  take precedence at runtime, so production keeps working. */
export async function clearStoredKeys(): Promise<DangerResult> {
  const { companyId: id } = await companyId();
  await prisma.company.update({
    where: { id },
    data: { anthropicKeyEnc: null, resendKeyEnc: null },
  });
  await danger("clear_stored_keys");
  revalidateAll();
  return { ok: true, deleted: { keys: 1 } };
}

/** Nuke option. Everything tenant-owned: timesheets, jobs, employees, codes,
 *  descriptions, stored keys, and the tenant's audit log + OCR cache.
 *  Tenant + division rows themselves stay (you would still be logged in). */
export async function clearEverything(): Promise<DangerResult> {
  const ctx = await getTenantContext();
  const tw = tenantWhere(ctx);
  const entries = await prisma.timesheetEntry.deleteMany({ where: tw });
  const uploads = await prisma.timesheetUpload.deleteMany({ where: tw });
  const jobs = await prisma.job.deleteMany({ where: tw });
  await prisma.timesheetEntry.updateMany({ where: tw, data: { employeeId: null } }); // safety
  const emps = await prisma.employee.deleteMany({ where: tw });
  const codes = await prisma.laborCode.deleteMany({ where: tw });
  const descs = await prisma.taskDescription.deleteMany({ where: tw });
  const { companyId: id } = await companyId();
  await prisma.company.update({ where: { id }, data: { anthropicKeyEnc: null, resendKeyEnc: null } });
  // Audit BEFORE wiping the audit log so the "everything cleared" record exists.
  await danger("clear_everything", {
    entries: entries.count, uploads: uploads.count, jobs: jobs.count,
    employees: emps.count, laborCodes: codes.count, taskDescriptions: descs.count,
  });
  await prisma.auditLog.deleteMany({ where: { ...tw, NOT: { action: "clear_everything" } } });
  revalidateAll();
  return {
    ok: true,
    deleted: {
      entries: entries.count, uploads: uploads.count, jobs: jobs.count,
      employees: emps.count, laborCodes: codes.count, taskDescriptions: descs.count,
    },
  };
}
