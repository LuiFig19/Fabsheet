# Operations

## Stack

- **Web**: Next.js 15 (App Router) on Vercel
- **DB**: Neon Postgres (pooled connection string)
- **Storage**: Cloudflare R2 (S3-compatible), signed URLs
- **Auth**: BetterAuth (magic link via Resend)
- **OCR**: Anthropic Claude Vision
- **Email**: Resend

## Environment variables

Validated at boot by `lib/env.ts` — a missing/invalid required var fails the
build/start with a clear message. Full list in `.env.example`. Required:
`DATABASE_URL`, `BETTER_AUTH_SECRET`. Everything else has a safe default or a
local fallback (disk storage, console email).

## Deploy

Push to `main` → Vercel builds and deploys. Set env vars in the Vercel project
(not committed). For a fresh database:

```bash
export DATABASE_URL="<neon-unpooled-url>"
pnpm prisma db push     # or: pnpm prisma migrate deploy
pnpm db:seed            # creates the ravens tenant, codes, employees, jobs
```

Use the **unpooled** Neon URL for `db push`/migrations; the **pooled** URL
(`-pooler` host, `?pgbouncer=true&connection_limit=1`) for the app runtime.

## Health check

`GET /api/health` → `200` when DB + storage + OCR config are green, `503`
otherwise. Point an uptime monitor (UptimeRobot free tier) at it.

## Daily digest cron

`vercel.json` schedules `GET /api/cron/daily-digest` at 22:00 UTC. It emails
each tenant's `Company.defaultEmailTo` a summary (hours by job, uploads needing
review, over-budget jobs). Set `CRON_SECRET` in Vercel so only Vercel's cron
(which sends `Authorization: Bearer <CRON_SECRET>`) can trigger it.

## Database backup + restore

Neon keeps automatic point-in-time history. For an independent copy:

```bash
# Backup (run from any machine with psql tools + network to Neon)
pg_dump "$DATABASE_URL" -Fc -f fabsheet-$(date +%Y%m%d).dump

# Restore into a fresh database
pg_restore --clean --no-owner -d "$TARGET_DATABASE_URL" fabsheet-YYYYMMDD.dump
```

Retention target: 30 daily, 12 monthly, 5 yearly. Store dumps off Neon (e.g. a
separate R2 bucket). Automating this to R2 on a schedule is in the backlog.

## Export all data (manager self-service)

Settings → Account → Export all data produces a ZIP of CSV + JSON for entries,
jobs, and uploads, plus the original photos. (See `FEATURE_BACKLOG.md` if not
yet shipped in your build.)

## Rotating secrets

- **BetterAuth**: change `BETTER_AUTH_SECRET` in Vercel + redeploy. This
  invalidates all sessions (everyone re-logs-in via magic link).
- **Anthropic / Resend / R2**: rotate in the provider dashboard, update the
  Vercel env var, redeploy.
- **Access**: edit `ALLOWED_EMAILS`, redeploy. Delete `Session` rows to force
  immediate logout.

## Observability

Errors log to the server console (visible in Vercel Runtime Logs). Sentry is
not wired (no account); if you add it, document the DSN handling here. The
`AuditLog` table is the source of truth for "who did what".

## Multi-tenant (future)

Set `APP_MODE=multi_tenant` on a separate Vercel project. Login becomes
required with tenant-slug URLs. The same Neon DB can host multiple tenants
safely — every query is scoped by `tenantId`.
