import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const defaultSlug = process.env.DEFAULT_TENANT_SLUG ?? "ravens";
  const tenant = await prisma.tenant.findUnique({ where: { slug: defaultSlug } });
  if (!tenant) throw new Error(`Tenant ${defaultSlug} not found.`);

  const users = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  for (const user of users) {
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        role: user.role,
        divisionAccess: user.divisionAccess,
        active: user.active,
      },
      update: {
        role: user.role,
        divisionAccess: user.divisionAccess,
        active: user.active,
      },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
  if (appUrl) {
    const hostname = new URL(appUrl).hostname.toLowerCase();
    await prisma.tenantDomain.upsert({
      where: { hostname },
      create: { tenantId: tenant.id, hostname, primary: true },
      update: { tenantId: tenant.id, primary: true },
    });
  }

  console.log(`Backfilled ${users.length} membership(s) for ${tenant.slug}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
