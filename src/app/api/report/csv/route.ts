import { NextRequest } from "next/server";
import { buildReport, reportToCsv } from "@/lib/report";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const preset = sp.get("preset") ?? "week";
  const groupBy = (sp.get("group") ?? "job") as "job" | "employee" | "code";
  const ctx = await getTenantContext();
  const data = await buildReport(ctx, preset, groupBy, sp.get("start") ?? undefined, sp.get("end") ?? undefined);
  const csv = reportToCsv(data);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ravens-time-${data.startLabel}_to_${data.endLabel}.csv"`,
    },
  });
}
