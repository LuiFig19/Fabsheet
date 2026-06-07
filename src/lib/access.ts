import { cache } from "react";
import { getTenantContext, type TenantContext } from "@/lib/tenant";
import { isOwnerEmail } from "@/lib/platform-emails";

export type AppRole = "owner" | "manager" | "foreman" | "hr" | "office" | "viewer";

export type Permission =
  | "dashboard.view"
  | "attention.view"
  | "timesheets.upload"
  | "timesheets.review"
  | "timesheets.delete"
  | "jobs.view"
  | "jobs.write"
  | "production.view"
  | "reports.view"
  | "reports.export"
  | "settings.view"
  | "settings.manage"
  | "admin.users"
  | "modules.view"
  | "hr.view"
  | "foreman.view"
  | "big_honcho.view"
  | "executive.view";

export type ModuleKey =
  | "dashboard"
  | "executive"
  | "big_honcho"
  | "attention"
  | "upload"
  | "review"
  | "jobs"
  | "production"
  | "reports"
  | "hr"
  | "foreman"
  | "quality"
  | "incentives"
  | "admin"
  | "settings";

export type NavModule = {
  key: ModuleKey;
  href: string;
  label: string;
  permission: Permission;
  exact?: boolean;
  placeholder?: boolean;
};

export const NAV_MODULES: NavModule[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", permission: "dashboard.view", exact: true },
  { key: "executive", href: "/executive", label: "Executive", permission: "executive.view" },
  { key: "big_honcho", href: "/big-honcho", label: "Big Honcho", permission: "big_honcho.view" },
  { key: "attention", href: "/attention", label: "Needs Attention", permission: "attention.view" },
  { key: "upload", href: "/upload", label: "Upload", permission: "timesheets.upload" },
  { key: "review", href: "/review", label: "Review", permission: "timesheets.review" },
  { key: "jobs", href: "/jobs", label: "Jobs", permission: "jobs.view" },
  { key: "production", href: "/production", label: "Production", permission: "production.view" },
  { key: "reports", href: "/reports", label: "Reports", permission: "reports.view" },
  { key: "hr", href: "/hr", label: "HR / Payroll", permission: "hr.view" },
  { key: "foreman", href: "/foreman", label: "Foreman", permission: "foreman.view" },
  { key: "quality", href: "/quality", label: "Quality Control", permission: "modules.view", placeholder: true },
  { key: "incentives", href: "/incentives", label: "Incentives", permission: "modules.view", placeholder: true },
  { key: "admin", href: "/admin", label: "Admin", permission: "admin.users" },
  { key: "settings", href: "/settings", label: "Settings", permission: "settings.view" },
];

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  owner: [
    "dashboard.view", "executive.view", "attention.view", "timesheets.upload", "timesheets.review", "timesheets.delete",
    "jobs.view", "jobs.write", "production.view", "reports.view", "reports.export", "settings.view",
    "settings.manage", "admin.users", "modules.view", "hr.view", "foreman.view", "big_honcho.view",
  ],
  manager: [
    "dashboard.view", "executive.view", "attention.view", "timesheets.upload", "timesheets.review", "timesheets.delete",
    "jobs.view", "jobs.write", "production.view", "reports.view", "reports.export", "settings.view",
    "settings.manage", "modules.view", "hr.view", "foreman.view", "big_honcho.view",
  ],
  foreman: [
    "dashboard.view", "attention.view", "timesheets.upload", "timesheets.review", "jobs.view", "jobs.write",
    "production.view", "foreman.view", "modules.view",
  ],
  hr: [
    "dashboard.view", "timesheets.review", "jobs.view", "production.view", "reports.view", "reports.export",
    "hr.view",
  ],
  office: ["dashboard.view", "timesheets.review", "jobs.view", "reports.view", "reports.export", "hr.view"],
  viewer: ["dashboard.view", "jobs.view", "production.view"],
};

export function normalizeRole(role: string | null | undefined): AppRole {
  const r = (role ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["owner", "president", "executive", "executive_admin", "admin"].includes(r)) return "owner";
  if (["manager", "big_boss", "boss"].includes(r)) return "manager";
  if (["foreman", "lead"].includes(r)) return "foreman";
  if (["hr", "office_admin", "payroll"].includes(r)) return "hr";
  if (["office", "staff", "basic_office_staff"].includes(r)) return "office";
  if (["viewer", "read_only", "readonly"].includes(r)) return "viewer";
  return "manager";
}

export function permissionsForRole(role: string | null | undefined): Set<Permission> {
  return new Set(ROLE_PERMISSIONS[normalizeRole(role)]);
}

export function canAccess(role: string | null | undefined, permission: Permission): boolean {
  return permissionsForRole(role).has(permission);
}

export function visibleModulesForRole(role: string | null | undefined): NavModule[] {
  const allowed = permissionsForRole(role);
  return NAV_MODULES.filter((m) => allowed.has(m.permission));
}

export const getAccessContext = cache(async (): Promise<TenantContext & { role: AppRole; permissions: Set<Permission> }> => {
  const ctx = await getTenantContext();
  const role = process.env.AUTH_DISABLED === "true" || isOwnerEmail(ctx.user?.email) ? "owner" : normalizeRole(ctx.user?.role);
  return { ...ctx, role, permissions: permissionsForRole(role) };
});

export async function requirePermission(permission: Permission): Promise<TenantContext> {
  const ctx = await getAccessContext();
  if (!ctx.permissions.has(permission)) {
    throw new Error("Forbidden: your role does not allow this action.");
  }
  return ctx;
}
