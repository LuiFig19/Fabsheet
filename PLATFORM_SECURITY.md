# FabSheet Platform Security Foundation

FabSheet is being prepared as a reusable company administration platform while keeping the current Raven's Marine timesheet workflow stable.

## What Is Enforced Now

- All protected app routes still require a BetterAuth session cookie.
- Tenant scoping remains mandatory through `tenantWhere`, `scopeWhere`, and `scopeStamp`.
- Role permissions are centralized in `src/lib/access.ts`.
- Navigation is filtered by role from the same module list used by server permissions.
- Server actions enforce permissions before mutating sensitive data.
- Report/export API routes enforce permissions server-side.
- Future module pages are permission-gated placeholders, not public pages.

## Current Roles

- `owner`: president / executive admin / full platform access.
- `manager`: Raven's manager / big boss access across operations and settings.
- `foreman`: upload, review, jobs, production, and enabled operational modules.
- `hr`: payroll, review, reports, exports, and production visibility.
- `office`: payroll/reporting support without settings/admin control.
- `viewer`: read-only operational visibility.

## Tenant Safety

Raven's Marine remains the active tenant. Existing tables already carry `tenantId` and the core app queries are scoped to the active tenant. The platform foundation does not reset, migrate, or expose Raven's data to future tenants.

## Secrets

Secrets remain server-side:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `RESEND_API_KEY`
- `ANTHROPIC_API_KEY`
- R2 account/access/secret keys
- encrypted company-level Anthropic/Resend keys

Only `NEXT_PUBLIC_*` values are intended for browser exposure.

## Still To Build Before Multi-Company Sales

- User invitation and role-editing UI.
- Optional password/passkey sign-in if leadership wants more than magic-link accounts.
- Per-company enabled-module records in the database.
- Editable role-permission matrix for future tenants.
- Formal audit/event viewer for admins.
- Public marketing/pitch page.
