import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST() {
  await ensureTenancySchema();
  const result = await backfillDefaultTenant();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  await ensureTenancySchema();
  const result = await backfillDefaultTenant();
  return NextResponse.json({ ok: true, ...result });
}

async function ensureTenancySchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TenantDomain" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "hostname" TEXT NOT NULL UNIQUE,
      "primary" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TenantDomain_tenantId_idx" ON "TenantDomain"("tenantId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TenantMembership" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "role" TEXT NOT NULL DEFAULT 'manager',
      "divisionAccess" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TenantMembership_tenantId_userId_key" UNIQUE ("tenantId", "userId")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TenantMembership_tenantId_idx" ON "TenantMembership"("tenantId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TenantMembership_userId_idx" ON "TenantMembership"("userId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TenantInvite" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "email" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'manager',
      "divisionAccess" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "active" BOOLEAN NOT NULL DEFAULT true,
      "acceptedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TenantInvite_tenantId_email_key" UNIQUE ("tenantId", "email")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TenantInvite_email_idx" ON "TenantInvite"("email");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TenantInvite_tenantId_idx" ON "TenantInvite"("tenantId");`);
}

async function backfillDefaultTenant() {
  const slug = process.env.DEFAULT_TENANT_SLUG ?? "ravens";
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return { tenant: null, memberships: 0, domain: null };

  const users = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  for (const user of users) {
    await prisma.$executeRaw`
      INSERT INTO "TenantMembership" ("id", "tenantId", "userId", "role", "divisionAccess", "active", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${tenant.id}, ${user.id}, ${user.role}, ${user.divisionAccess}, ${user.active}, NOW(), NOW())
      ON CONFLICT ("tenantId", "userId")
      DO UPDATE SET "role" = EXCLUDED."role", "divisionAccess" = EXCLUDED."divisionAccess", "active" = EXCLUDED."active", "updatedAt" = NOW();
    `;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
  let hostname: string | null = null;
  if (appUrl) {
    hostname = new URL(appUrl).hostname.toLowerCase();
    await prisma.$executeRaw`
      INSERT INTO "TenantDomain" ("id", "tenantId", "hostname", "primary", "createdAt")
      VALUES (${randomUUID()}, ${tenant.id}, ${hostname}, true, NOW())
      ON CONFLICT ("hostname")
      DO UPDATE SET "tenantId" = EXCLUDED."tenantId", "primary" = true;
    `;
  }

  return { tenant: tenant.slug, memberships: users.length, domain: hostname };
}
