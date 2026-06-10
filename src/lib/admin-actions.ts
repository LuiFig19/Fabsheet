"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/access";
import { normalizeEmail } from "@/lib/platform-emails";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export async function createClientTenant(formData: FormData) {
  await requirePermission("admin.users");
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const displayName = String(formData.get("displayName") ?? "").trim() || name;
  const contactEmail = normalizeEmail(String(formData.get("contactEmail") ?? ""));
  const divisionName = String(formData.get("divisionName") ?? "").trim() || "Operations";
  const hostname = normalizeHost(String(formData.get("hostname") ?? ""));

  if (!name || !slug) return;

  const ctx = await requirePermission("admin.users");
  if (!ctx.user) return;
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    create: { slug, name, displayName, contactEmail },
    update: { name, displayName, contactEmail },
  });

  await prisma.$transaction([
    prisma.division.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: slugify(divisionName) || "operations" } },
      create: { tenantId: tenant.id, name: divisionName, slug: slugify(divisionName) || "operations", contactEmail },
      update: { name: divisionName, contactEmail, active: true },
    }),
    prisma.company.upsert({
      where: { tenantId: tenant.id },
      create: { tenantId: tenant.id, name: displayName },
      update: { name: displayName },
    }),
    prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: ctx.user.id } },
      create: { tenantId: tenant.id, userId: ctx.user.id, role: "owner", active: true },
      update: { role: "owner", active: true },
    }),
    ...(hostname
      ? [
          prisma.tenantDomain.upsert({
            where: { hostname },
            create: { tenantId: tenant.id, hostname, primary: true },
            update: { tenantId: tenant.id, primary: true },
          }),
        ]
      : []),
  ]);

  revalidatePath("/admin");
}

export async function inviteTenantUser(formData: FormData) {
  await requirePermission("admin.users");
  const tenantId = String(formData.get("tenantId") ?? "");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const role = String(formData.get("role") ?? "manager").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!tenantId || !email) return;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return;

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: name || email, role, tenantId, active: true },
    update: { name: name || undefined, active: true },
  });

  await prisma.$transaction([
    prisma.tenantInvite.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: { tenantId, email, role, active: true },
      update: { role, active: true, acceptedAt: null },
    }),
    prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role, active: true },
      update: { role, active: true },
    }),
  ]);

  revalidatePath("/admin");
}

export async function toggleTenantMembership(formData: FormData) {
  await requirePermission("admin.users");
  const id = String(formData.get("id") ?? "");
  const membership = await prisma.tenantMembership.findUnique({ where: { id }, select: { active: true } });
  if (!membership) return;
  await prisma.tenantMembership.update({ where: { id }, data: { active: !membership.active } });
  revalidatePath("/admin");
}
