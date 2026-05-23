import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { buildReport } from "@/lib/report";
import { renderReportPdf } from "@/lib/report-pdf";
import { getTenantContext, tenantWhere } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const preset = sp.get("preset") ?? "week";
  const groupBy = (sp.get("group") ?? "job") as "job" | "employee" | "code";
  const ctx = await getTenantContext();
  const data = await buildReport(ctx, preset, groupBy, sp.get("start") ?? undefined, sp.get("end") ?? undefined);
  const company = await prisma.company.findFirst({ where: tenantWhere(ctx) });
  const pdf = await renderReportPdf(data, ctx.tenant.displayName || ctx.tenant.name || company?.name || "FabSheet");

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ravens-time-${data.startLabel}_to_${data.endLabel}.pdf"`,
    },
  });
}
