import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { buildProductionBreakdown, resolveProductionRange } from "@/lib/production";
import { renderProductionPdf } from "@/lib/production-pdf";
import { getTenantContext, tenantWhere } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ctx = await getTenantContext();
  const range = resolveProductionRange({
    week: sp.get("week") ?? undefined,
    start: sp.get("start") ?? undefined,
    end: sp.get("end") ?? undefined,
  });
  const [data, company] = await Promise.all([
    buildProductionBreakdown(ctx, range),
    prisma.company.findFirst({ where: tenantWhere(ctx) }),
  ]);
  const pdf = await renderProductionPdf(data, ctx.tenant.displayName || ctx.tenant.name || company?.name || "FabSheet");

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="production-${data.startLabel}_to_${data.endLabel}.pdf"`,
    },
  });
}
