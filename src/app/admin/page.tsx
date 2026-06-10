import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { requirePermission, normalizeRole } from "@/lib/access";
import { createClientTenant, inviteTenantUser, toggleTenantMembership } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "manager", "foreman", "hr", "office", "viewer"];

export default async function AdminPage() {
  await requirePermission("admin.users");
  const [tenants, users] = await Promise.all([
    prisma.tenant.findMany({
      include: {
        domains: { orderBy: { primary: "desc" } },
        divisions: { orderBy: { name: "asc" } },
        memberships: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
        invites: { orderBy: { createdAt: "desc" }, take: 8 },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { email: true, name: true, role: true, active: true, lastLoginAt: true, tenant: { select: { slug: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage real customer tenants, invite users, and keep Raven&apos;s as one customer under the FabSheet roof.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-foreground">Create client tenant</CardTitle></CardHeader>
        <CardContent>
          <form action={createClientTenant} className="grid gap-3 lg:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium">Client name</span>
              <Input name="name" placeholder="Acme Fabrication" required />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Slug</span>
              <Input name="slug" placeholder="acme" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Display name</span>
              <Input name="displayName" placeholder="Acme Fabrication" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Contact email</span>
              <Input name="contactEmail" type="email" placeholder="ops@company.com" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">First division</span>
              <Input name="divisionName" placeholder="Operations" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Custom host</span>
              <Input name="hostname" placeholder="client.fabsheet.org" />
            </label>
            <div className="lg:col-span-3">
              <Button type="submit">Create client</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {tenants.map((tenant) => (
          <Card key={tenant.id}>
            <CardHeader>
              <CardTitle className="flex flex-col gap-2 text-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{tenant.displayName || tenant.name}</span>
                <span className="flex flex-wrap gap-2 text-sm font-normal">
                  <Badge variant="muted">/{tenant.slug}</Badge>
                  <Button asChild size="sm" variant="outline"><Link href={`/c/${tenant.slug}/dashboard`}>Open tenant</Link></Button>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
              <div className="space-y-3">
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <Info label="Divisions" value={tenant.divisions.map((d) => d.name).join(", ") || "None"} />
                  <Info label="Domains" value={tenant.domains.map((d) => d.hostname).join(", ") || "Default domain only"} />
                  <Info label="Contact" value={tenant.contactEmail || "Not set"} />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Members</div>
                  {tenant.memberships.length === 0 ? (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No members yet.</div>
                  ) : tenant.memberships.map((membership) => (
                    <form key={membership.id} action={toggleTenantMembership} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <input type="hidden" name="id" value={membership.id} />
                      <div>
                        <div className="font-medium">{membership.user.name || membership.user.email}</div>
                        <div className="text-xs text-muted-foreground">{membership.user.email}</div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="muted">{normalizeRole(membership.role)}</Badge>
                        <Badge variant={membership.active ? "success" : "danger"}>{membership.active ? "active" : "disabled"}</Badge>
                        <Button size="sm" variant="outline" type="submit">{membership.active ? "Disable" : "Enable"}</Button>
                      </div>
                    </form>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <form action={inviteTenantUser} className="space-y-2 rounded-md border p-3">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <div className="text-sm font-semibold">Invite user</div>
                  <Input name="name" placeholder="Name optional" />
                  <Input name="email" type="email" placeholder="person@company.com" required />
                  <select name="role" defaultValue="manager" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                  <Button type="submit" size="sm">Invite / grant access</Button>
                </form>
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Recent invites</div>
                  {tenant.invites.length === 0 ? (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No invites yet.</div>
                  ) : tenant.invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>{invite.email}</span>
                      <div className="flex gap-2">
                        <Badge variant="muted">{invite.role}</Badge>
                        <Badge variant={invite.acceptedAt ? "success" : invite.active ? "warning" : "danger"}>
                          {invite.acceptedAt ? "accepted" : invite.active ? "pending" : "off"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-foreground">All BetterAuth users</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {users.map((u) => (
            <div key={u.email} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="font-medium">{u.name || u.email}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
              <div className="flex gap-2">
                <Badge variant="muted">{normalizeRole(u.role)}</Badge>
                {u.tenant?.slug && <Badge variant="muted">{u.tenant.slug}</Badge>}
                <Badge variant={u.active ? "success" : "danger"}>{u.active ? "active" : "disabled"}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-medium">{value}</div>
    </div>
  );
}
