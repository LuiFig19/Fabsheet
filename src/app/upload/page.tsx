import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm } from "./upload-form";
import { toDateInputValue } from "@/lib/utils";
import { getTenantContext, scopeWhere } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const ctx = await getTenantContext();
  const employees = await prisma.employee.findMany({
    where: { ...scopeWhere(ctx), active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload a timesheet</h1>
        <p className="text-sm text-muted-foreground">
          Photograph or scan the paper sheet. The app reads the rows so you review them instead of retyping.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New timesheet</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm
            employees={employees.map((e) => ({ id: e.id, name: e.name }))}
            defaultDate={toDateInputValue(new Date())}
          />
        </CardContent>
      </Card>
    </div>
  );
}
