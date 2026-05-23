import { PrismaClient } from "@prisma/client";
import { EMPLOYEES, JOBS, LABOR_CODES, TASK_DESCRIPTIONS } from "../src/lib/domain";
import { computeDecimalHours } from "../src/lib/utils";

const prisma = new PrismaClient();

const COMPANY_NAME = process.env.COMPANY_NAME ?? "Raven's Marine";
const TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "ravens";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function reset() {
  await prisma.auditLog.deleteMany();
  await prisma.timesheetEntry.deleteMany();
  await prisma.timesheetUpload.deleteMany();
  await prisma.ocrCache.deleteMany();
  await prisma.job.deleteMany();
  await prisma.taskDescription.deleteMany();
  await prisma.laborCode.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
  await prisma.division.deleteMany();
  await prisma.tenant.deleteMany();
}

async function main() {
  await reset();

  // Default tenant + division for Raven's. In multi_tenant mode you would add
  // more of these; everything below is scoped to this one.
  const tenant = await prisma.tenant.create({
    data: {
      slug: TENANT_SLUG,
      name: COMPANY_NAME,
      displayName: COMPANY_NAME,
      contactEmail: "office@ravensmarine.com",
    },
  });
  const division = await prisma.division.create({
    data: { tenantId: tenant.id, name: "Welding", slug: "welding", contactEmail: "office@ravensmarine.com" },
  });
  const t = tenant.id;
  const d = division.id;

  // A seed admin user (only used in multi_tenant mode for magic-link login).
  await prisma.user.create({
    data: { tenantId: t, email: "luifig19@gmail.com", name: "Luis Figueroa", role: "admin" },
  });

  await prisma.company.create({ data: { tenantId: t, name: COMPANY_NAME } });

  const employees = await Promise.all(
    EMPLOYEES.map((name) => prisma.employee.create({ data: { name } })),
  );
  const emp = (n: string) => employees.find((e) => e.name === n)!;

  await Promise.all(
    LABOR_CODES.map((c) =>
      prisma.laborCode.create({ data: { code: c.code, description: c.description } }),
    ),
  );
  await Promise.all(
    TASK_DESCRIPTIONS.map((name) => prisma.taskDescription.create({ data: { name } })),
  );

  const jobs = await Promise.all(
    JOBS.map((j) =>
      prisma.job.create({
        data: {
          workOrderNumber: j.workOrderNumber,
          customerName: j.customerName,
          description: j.description,
          budgetedHours: j.budgetedHours,
          status: j.status ?? "active",
        },
      }),
    ),
  );
  const job = (wo: string) => jobs.find((j) => j.workOrderNumber === wo)!;

  const h = computeDecimalHours;

  // Helper to make an APPROVED upload + entries that count toward job totals.
  async function approvedDay(args: {
    employeeName: string;
    date: Date;
    rows: {
      wo: string;
      desc: string;
      code: string;
      start: string;
      end: string;
      part?: string;
    }[];
  }) {
    const e = emp(args.employeeName);
    await prisma.timesheetUpload.create({
      data: {
        filePath: "seed/approved.jpg",
        mimeType: "image/jpeg",
        employeeId: e.id,
        date: args.date,
        status: "approved",
        extractorName: "claude",
        shiftStart: args.rows[0]?.start ?? "",
        shiftEnd: args.rows[args.rows.length - 1]?.end ?? "",
        warnings: [],
        entries: {
          create: args.rows.map((r) => {
            const j = job(r.wo);
            return {
              employeeId: e.id,
              jobId: j.id,
              workOrderNumber: r.wo,
              customerName: j.customerName,
              partId: r.part ?? "",
              description: r.desc,
              laborCode: `${r.code} ${LABOR_CODES.find((c) => c.code === r.code)?.description ?? ""}`.trim(),
              startTime: r.start,
              endTime: r.end,
              decimalHours: h(r.start, r.end),
              confidenceByField: {},
              status: "approved",
              approvedAt: new Date(),
            };
          }),
        },
      },
    });
  }

  // Build approved hours so the dashboard tiers show green/yellow/red:
  //   4354 RCCL RB1   (budget 400) -> ~310 h  => 77% YELLOW
  //   4571 Coco Cay   (budget 320) -> ~120 h  => 38% GREEN
  //   4625 Port Ever. (budget 60)  -> ~75 h   => 125% RED
  // Spread across the past week for the Reports range views.
  const welders = ["Luis Figueroa", "Glenn Swinger", "Tyler Paulsen", "Luis Sanchez", "Jose Davila"];
  for (let d = 1; d <= 5; d++) {
    for (const w of welders) {
      await approvedDay({
        employeeName: w,
        date: daysAgo(d),
        rows: [
          { wo: "4354", desc: "Frame", code: "110", start: "07:00", end: "11:00", part: "FR-100" },
          { wo: "4354", desc: "Decking", code: "140", start: "11:30", end: "13:30" },
        ],
      });
    }
  }
  // Coco Cay: lighter load
  for (let d = 1; d <= 3; d++) {
    for (const w of ["Davian Soto", "Stanley Humphrey"]) {
      await approvedDay({
        employeeName: w,
        date: daysAgo(d),
        rows: [{ wo: "4571", desc: "Rails", code: "110", start: "07:00", end: "15:00", part: "RL-12" }],
      });
    }
  }
  // Port Everglades: blow the budget (red)
  for (let d = 1; d <= 5; d++) {
    await approvedDay({
      employeeName: "Chris Sharpe",
      date: daysAgo(d),
      rows: [{ wo: "4625", desc: "Tread Plate", code: "280", start: "07:00", end: "16:00" }],
    });
  }

  // FRESHLY EXTRACTED, NEEDS REVIEW: the real-world messy sheet with the
  // deliberate low-confidence fields the manager must catch. Glenn Sw / 4354.
  await prisma.timesheetUpload.create({
    data: {
      filePath: "seed/glenn_4354.jpg",
      mimeType: "image/jpeg",
      employeeId: emp("Glenn Swinger").id,
      date: daysAgo(0),
      status: "needs_review",
      extractorName: "claude",
      shiftStart: "07:00",
      shiftEnd: "16:00",
      rawExtractedJson: { note: "seeded sample, see entries" },
      warnings: [
        "Row 2 work order is hard to read (4354 vs 4364). Confirm before approving.",
        "Row 3 labor code is smudged.",
        "Row 4 description is illegible.",
      ],
      entries: {
        create: [
          {
            employeeId: emp("Glenn Swinger").id,
            jobId: job("4354").id,
            workOrderNumber: "4354",
            customerName: "RCCL RB1",
            partId: "FR-100",
            description: "Frame",
            laborCode: "110 Weld/Fab",
            startTime: "07:00",
            endTime: "11:00",
            decimalHours: h("07:00", "11:00"),
            confidenceByField: { workOrderNumber: 0.96, description: 0.94, laborCode: 0.93, startTime: 0.95, endTime: 0.95 },
            status: "needs_review",
          },
          {
            employeeId: emp("Glenn Swinger").id,
            workOrderNumber: "4364",
            customerName: "RCCL RB1",
            partId: "",
            description: "Decking",
            laborCode: "140 Labor Decking",
            startTime: "11:30",
            endTime: "13:30",
            decimalHours: h("11:30", "13:30"),
            confidenceByField: { workOrderNumber: 0.41, description: 0.8, laborCode: 0.86 },
            status: "needs_review",
          },
          {
            employeeId: emp("Glenn Swinger").id,
            jobId: job("4354").id,
            workOrderNumber: "4354",
            customerName: "RCCL RB1",
            partId: "RL-12",
            description: "Rails",
            laborCode: "110 Weld/Fab",
            startTime: "13:30",
            endTime: "15:00",
            decimalHours: h("13:30", "15:00"),
            confidenceByField: { laborCode: 0.38, description: 0.72 },
            status: "needs_review",
          },
          {
            employeeId: emp("Glenn Swinger").id,
            workOrderNumber: "4354",
            customerName: "RCCL RB1",
            partId: "",
            description: "",
            laborCode: "",
            startTime: "15:00",
            endTime: "16:00",
            decimalHours: h("15:00", "16:00"),
            confidenceByField: { description: 0.2, laborCode: 0.25, workOrderNumber: 0.6 },
            status: "needs_review",
          },
        ],
      },
    },
  });

  // STILL EXTRACTING (edge state on dashboard).
  await prisma.timesheetUpload.create({
    data: {
      filePath: "seed/pending.pdf",
      mimeType: "application/pdf",
      employeeId: emp("Tyler Paulsen").id,
      date: daysAgo(0),
      status: "extracting",
      extractorName: "claude",
      warnings: [],
    },
  });

  // Attach the tenant + division to everything seeded above.
  await prisma.laborCode.updateMany({ where: { tenantId: null }, data: { tenantId: t } });
  await prisma.taskDescription.updateMany({ where: { tenantId: null }, data: { tenantId: t } });
  await prisma.employee.updateMany({ where: { tenantId: null }, data: { tenantId: t, divisionId: d } });
  await prisma.job.updateMany({ where: { tenantId: null }, data: { tenantId: t, divisionId: d } });
  await prisma.timesheetUpload.updateMany({ where: { tenantId: null }, data: { tenantId: t, divisionId: d } });
  await prisma.timesheetEntry.updateMany({ where: { tenantId: null }, data: { tenantId: t, divisionId: d } });

  const counts = {
    tenant: tenant.slug,
    division: division.slug,
    employees: employees.length,
    laborCodes: LABOR_CODES.length,
    descriptions: TASK_DESCRIPTIONS.length,
    jobs: jobs.length,
    uploads: await prisma.timesheetUpload.count(),
    entries: await prisma.timesheetEntry.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
