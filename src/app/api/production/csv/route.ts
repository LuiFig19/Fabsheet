import { NextRequest } from "next/server";
import { buildProductionBreakdown, productionToCsv, resolveProductionRange } from "@/lib/production";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ctx = await getTenantContext();
  const range = resolveProductionRange({
    week: sp.get("week") ?? undefined,
    start: sp.get("start") ?? undefined,
    end: sp.get("end") ?? undefined,
  });
  const data = await buildProductionBreakdown(ctx, range);
  const csv = productionToCsv(data);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="production-${data.startLabel}_to_${data.endLabel}.csv"`,
    },
  });
}
