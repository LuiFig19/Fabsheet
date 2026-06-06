import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { requirePermission, normalizeRole } from "@/lib/access";
import { getTenantContext, tenantWhere } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePermission("admin.users");
  const ctx = await getTenantContext();
  const users = await prisma.user.findMany({
    where: tenantWhere(ctx),
    orderBy: { email: "asc" },
    select: { email: true, name: true, role: true, active: true, lastLoginAt: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground">User access and platform controls. Editing roles is intentionally server-controlled for now.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-foreground">Users and roles</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {users.map((u) => (
            <div key={u.email} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="font-medium">{u.name || u.email}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
              <div className="flex gap-2"><Badge variant="muted">{normalizeRole(u.role)}</Badge><Badge variant={u.active ? "success" : "danger"}>{u.active ? "active" : "disabled"}</Badge></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
