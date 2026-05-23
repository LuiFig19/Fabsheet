"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { getTenantContext, scopeStamp, tenantStamp } from "@/lib/tenant";

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
  await prisma.company.update({
    where: { id },
    data: {
      ocrThreshold: Number.isFinite(threshold) ? Math.min(1, Math.max(0, threshold)) : 0.7,
      dailyApiCap: Number.isFinite(cap) ? Math.max(0, Math.round(cap)) : 100,
    },
  });
  revalidatePath("/settings");
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
