# Contributing

## Local setup (3 commands)

```bash
pnpm install
pnpm db:push && pnpm db:seed   # needs a Postgres in DATABASE_URL
pnpm dev                        # http://localhost:3000
```

Copy `.env.example` to `.env` first and fill in `DATABASE_URL` +
`BETTER_AUTH_SECRET`. Leave `EXTRACTOR=mock` for local dev so you don't spend
Anthropic credits on every restart. R2 and Resend are optional locally (the app
falls back to local-disk storage and console "would send" email).

A local Postgres via Docker:
```bash
docker compose up -d db
```

## Commands

| Command | What |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit`, must be clean |
| `pnpm test` | Vitest unit tests (under 30s) |
| `pnpm lint` | Next lint |
| `pnpm db:push` | Sync Prisma schema to the DB |
| `pnpm db:seed` | Seed the Raven's tenant + reference data |

## Conventions

- **Files**: kebab-case. **Components**: PascalCase. **Server-only modules**
  (anything importing `@/lib/db`, `@/lib/auth`) must never be imported from a
  `"use client"` file.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`).
- **Types**: `strict` is on. No `any`. Validate all external input with Zod.
- **Env**: never read `process.env` directly in feature code — import from
  `lib/env.ts`.
- **No em dashes** in user-visible strings (`-`, commas, or parentheses).

## Layout

```
src/
  app/            routes (RSC by default; "use client" only where needed)
  components/     UI: shared primitives in components/ui
  lib/
    auth*         BetterAuth config + client + login server action
    extractors/   OCR: TimesheetExtractor interface, claude + mock
    storage.ts    R2 (signed URLs) with disk fallback
    report*       report builder + PDF + CSV
    anomalies.ts  dashboard anomaly checks
    mapping.ts    OCR rows -> entry drafts, code/customer derivation
    env.ts        validated env
    db.ts utils.ts tenant.ts
prisma/           schema + seed + backfill
```

## CI

`.github/workflows/ci.yml` runs typecheck, test, and build on every push and
PR. Keep it green.

## Adding a feature

Keep business logic in `lib/`, not components. If it touches the DB, scope every
query by `tenantId` (use `scopeWhere`/`tenantWhere` from `lib/tenant.ts`). Add a
unit test for any pure logic. Update the relevant doc.
