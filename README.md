# FabSheet

Paper timesheets to job costing for fabrication shops. A welder fills out a
paper sheet; the office snaps a photo; FabSheet reads it with Claude Vision,
the manager reviews and approves, and the hours roll up into job-costing
reports and a payroll CSV. It replaces the daily hand-keying between paper and
QuickBooks. It is not a punch clock and not employee surveillance.

Built first for Raven's Marine. Multi-tenant capable behind a single config
switch.

## What it does

- **Upload**: photograph one or many paper timesheets (rear camera on iPad).
- **Read**: Claude Vision extracts rows; the welder's name, date, times,
  task/action bubbles, and notes are parsed. Customer and labor code are
  derived (never re-typed). Times like "5" or "1" are normalized to shop hours.
- **Review**: a table that mirrors the paper form. Only genuinely uncertain
  fields flag. Approve per row, per sheet, or bulk-approve all clean sheets.
- **Dashboard**: weekly productive-hours goal (850 default), job progress with
  per-unit bars, and an anomaly panel (long days, silent welders, overlaps).
- **Reports**: by job / employee / labor code, with PDF, CSV, payroll CSV, and
  email.

## Stack

Next.js 15 (App Router, RSC) · TypeScript (strict) · Prisma + Postgres (Neon) ·
BetterAuth (magic link via Resend) · Anthropic Claude Vision · Cloudflare R2 ·
Tailwind + shadcn-style UI · Vitest.

## Run it locally

```bash
pnpm install
pnpm db:push && pnpm db:seed      # Postgres in DATABASE_URL (docker compose up -d db)
pnpm dev                           # http://localhost:3000
```

Copy `.env.example` to `.env`, set `DATABASE_URL` + `BETTER_AUTH_SECRET`, keep
`EXTRACTOR=mock` to avoid spending OCR credits in dev.

## Docs

- `CONTRIBUTING.md` - setup, conventions, layout
- `SECURITY.md` - threat model, auth, headers
- `OPERATIONS.md` - deploy, backups, cron, env
- `FEATURE_BACKLOG.md` - what's next and why

## Tests + CI

`pnpm test` runs the unit suite (Task to code mapping, UNIT validation, decimal
hours, time/date parsing). `pnpm typecheck` must be clean. CI runs both plus the
build on every push.
