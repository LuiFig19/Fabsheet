import { PrismaClient } from "@prisma/client";

// Idempotent backfill: ensure the default Raven's tenant + Welding division
// exist, then point every pre-existing row at them. Safe to run repeatedly.
// New (Neon) databases get this state from seed.ts instead.
const prisma = new PrismaClient();

const TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "ravens";

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {},
    create: {
      slug: TENANT_SLUG,
      name: "Raven's Marine",
      displayName: "Raven's Marine",
      contactEmail: "office@ravensmarine.com",
    },
  });

  let division = await prisma.division.findFirst({ where: { tenantId: tenant.id, slug: "welding" } });
  if (!division) {
    division = await prisma.division.create({
      data: { tenantId: tenant.id, name: "Welding", slug: "welding", contactEmail: "office@ravensmarine.com" },
    });
  }

  const t = tenant.id;
  const d = division.id;

  // Tenant-only tables.
  const company = await prisma.company.updateMany({ where: { tenantId: null }, data: { tenantId: t } });
  const codes = await prisma.laborCode.updateMany({ where: { tenantId: null }, data: { tenantId: t } });
  const descs = await prisma.taskDescription.updateMany({ where: { tenantId: null }, data: { tenantId: t } });
  const audits = await prisma.auditLog.updateMany({ where: { tenantId: null }, data: { tenantId: t } });

  // Tenant + division tables.
  const emps = await prisma.employee.updateMany({ where: { tenantId: null }, data: { tenantId: t, divisionId: d } });
  const jobs = await prisma.job.updateMany({ where: { tenantId: null }, data: { tenantId: t, divisionId: d } });
  const ups = await prisma.timesheetUpload.updateMany({ where: { tenantId: null }, data: { tenantId: t, divisionId: d } });
  const ents = await prisma.timesheetEntry.updateMany({ where: { tenantId: null }, data: { tenantId: t, divisionId: d } });

  console.log("Backfill complete:", {
    tenant: tenant.slug,
    division: division.slug,
    company: company.count,
    laborCodes: codes.count,
    descriptions: descs.count,
    auditLogs: audits.count,
    employees: emps.count,
    jobs: jobs.count,
    uploads: ups.count,
    entries: ents.count,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
