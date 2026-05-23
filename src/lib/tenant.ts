import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { Tenant, Division, User } from "@prisma/client";

export type TenancyMode = "single_tenant" | "multi_tenant";

export type TenantContext = {
  tenant: Tenant;
  division: Division | null;
  user: User | null;
  mode: TenancyMode;
};

export function appMode(): TenancyMode {
  return process.env.APP_MODE === "multi_tenant" ? "multi_tenant" : "single_tenant";
}

export function defaultTenantSlug(): string {
  return process.env.DEFAULT_TENANT_SLUG ?? "ravens";
}

/**
 * Resolve the active tenant/division/user for this request. Memoized per
 * request via React cache so every RSC and server action shares one lookup.
 *
 * single_tenant: tenant from DEFAULT_TENANT_SLUG, no user, division auto-picked
 *   only when the tenant has exactly one (so no picker shows for Raven's).
 * multi_tenant: tenant + user from headers set by middleware (session cookie),
 *   division from the user's selection.
 *
 * Every query must scope by the returned tenant.id (and division where set).
 * Use tenantWhere() / divisionWhere() helpers below.
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const mode = appMode();
  const h = await headers();

  if (mode === "single_tenant") {
    const slug = h.get("x-tenant-slug") || defaultTenantSlug();
    const tenant = await resolveTenant(slug);
    const divisions = await prisma.division.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { createdAt: "asc" },
    });
    // Auto-pick only when there is exactly one division (no UI picker for Raven's).
    const division = divisions.length === 1 ? divisions[0] : pickDivision(divisions, h.get("x-division-id"));
    return { tenant, division, user: null, mode };
  }

  // multi_tenant
  const slug = h.get("x-tenant-slug");
  const userId = h.get("x-user-id");
  if (!slug || !userId) {
    throw new Error("Unauthenticated: no tenant/user context in multi_tenant mode.");
  }
  const tenant = await resolveTenant(slug);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.tenantId !== tenant.id || !user.active) {
    throw new Error("Forbidden: user does not belong to this tenant.");
  }
  const divisions = await prisma.division.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { createdAt: "asc" } });
  const division = pickDivision(divisions, h.get("x-division-id"));
  return { tenant, division, user, mode };
});

/** Non-throwing variant for shared chrome (layout, metadata) that must render
 *  even on unauthenticated pages like the multi_tenant login screen. */
export const getTenantContextSafe = cache(async (): Promise<TenantContext | null> => {
  try {
    return await getTenantContext();
  } catch {
    return null;
  }
});

function pickDivision(divisions: Division[], wantedId: string | null): Division | null {
  if (wantedId) {
    const found = divisions.find((d) => d.id === wantedId);
    if (found) return found;
  }
  return divisions.length === 1 ? divisions[0] : null;
}

async function resolveTenant(slug: string): Promise<Tenant> {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant "${slug}" not found. Run db:seed or db:backfill.`);
  return tenant;
}

/**
 * Scoping helpers. Spread into a Prisma `where` so callers cannot forget the
 * tenant filter. divisionWhere additionally narrows to the active division
 * when one is set (single-division tenants and admins see all divisions).
 */
export function tenantWhere(ctx: TenantContext) {
  return { tenantId: ctx.tenant.id };
}

export function scopeWhere(ctx: TenantContext) {
  if (ctx.division) return { tenantId: ctx.tenant.id, divisionId: ctx.division.id };
  return { tenantId: ctx.tenant.id };
}

/** Default tenant/division stamps for newly created rows. */
export function tenantStamp(ctx: TenantContext) {
  return { tenantId: ctx.tenant.id };
}
export function scopeStamp(ctx: TenantContext) {
  return { tenantId: ctx.tenant.id, divisionId: ctx.division?.id ?? null };
}
