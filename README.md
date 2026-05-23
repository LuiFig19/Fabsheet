# Raven's Marine Timesheet App

Internal tool for Raven's Marine. It sits between the paper timesheet and
QuickBooks: a manager photographs a filled-out paper sheet, the app reads the
rows with Claude Vision, the manager reviews and approves, and the approved
hours roll up into job-costing reports (PDF + CSV + email). It replaces the
hand math and the manual re-entry steps. Welders keep using paper. This is job
costing, not employee monitoring.

## The loop

```
Photo or PDF of paper timesheet
  -> extract rows with Claude Vision (real OCR) or the dev mock
  -> manager reviews + edits in a table laid out like the paper form
  -> manager approves (only approved rows count)
  -> dashboard updates (job progress, hours used vs budgeted)
  -> export daily/weekly/monthly/yearly summary as PDF + CSV
  -> email the PDF to the office
```

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS + shadcn-style UI components
- Prisma + PostgreSQL (local Docker, same image in production)
- Zod validation; Server Actions for mutations, RSC for reads
- File upload via native FormData to a server action, stored under `/uploads`
- OCR: Anthropic Claude Vision (`@anthropic-ai/sdk`), model `claude-sonnet-4-6`
- PDF: `pdfkit`. CSV: native string building. Email: Resend (optional).

### Substitutions from the original spec (called out on purpose)

- **PDF: `pdfkit` instead of `@react-pdf/renderer`.** `@react-pdf/renderer`
  threw React reconciler errors (React #31 / internals mismatch) inside Next 15
  App Router server routes on this React 18 setup. Rather than ship a flaky PDF
  path before a Monday demo, the report PDF is built with `pdfkit` (pure Node,
  no React reconciler). Same QuickBooks "Time by X Detail" layout.
- **PDF rasterization dropped.** The spec suggested `pdf2pic`/`pdfjs-dist` to
  rasterize a PDF's first page before sending to vision. Instead, PDFs are sent
  to Claude as a native document block (Claude reads PDFs directly). This is
  more accurate and avoids fragile native canvas dependencies on Windows.

Everything else matches the spec.

## Requirements

- Docker (for Postgres locally, and to build/run the app image)
- Node 18+ (built on Node 24) and pnpm (`npm i -g pnpm`)

## Quick start (local dev)

```bash
docker compose up -d db        # Postgres 16 on localhost:5432
cp .env.example .env           # then edit (see "API keys" below)
pnpm install                   # installs deps, generates Prisma client
pnpm db:push                   # create tables
pnpm db:seed                   # real codes, descriptions, employees, jobs, samples
pnpm dev                       # http://localhost:3000
```

The dashboard shows seeded jobs with green/yellow/red budget bars, a
needs-review sheet, and recent uploads immediately.

> Local dev defaults to `EXTRACTOR=mock` in `.env` so dev-server restarts never
> spend API credits. The mock returns a realistic Glenn Swinger / WO 4354 sheet
> with deliberate imperfections. Production default is `EXTRACTOR=claude`.

### Reset the database

```bash
pnpm db:push --force-reset && pnpm db:seed
```

## API keys

Set these in `.env` (gitignored) or, at runtime, in the Settings screen
(stored AES-encrypted at rest). The environment variable always wins.

| Variable | Purpose | Missing behavior |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude Vision OCR | Upload shows a clear error with a "Configure in Settings" link. App still runs. |
| `ANTHROPIC_MODEL` | Vision model | Defaults to `claude-sonnet-4-6`. |
| `RESEND_API_KEY` | Email reports | Email button logs a "would send" notice instead of sending. App still runs. |
| `EXTRACTOR` | `claude` or `mock` | Defaults to `claude`. Use `mock` in dev. |

### Get an Anthropic API key

1. Go to console.anthropic.com, create a key under API Keys.
2. **Add credits under Plans and Billing.** A new account with a valid key but
   no credit balance returns `400 invalid_request_error: credit balance is too
   low`. The app surfaces that message on upload. Expect about $0.01 to $0.02
   per sheet, roughly $5 to $15 per month at 25 sheets per day.
3. Put the key in `.env` as `ANTHROPIC_API_KEY` and set `EXTRACTOR=claude`.

## How the mock OCR works

The only contract between the app and any OCR backend is one interface
(`src/lib/extractors/types.ts`):

```ts
interface TimesheetExtractor {
  readonly name: string;
  extract(file: Buffer, mimeType: string): Promise<ExtractedTimesheet>;
  lastUsage: ExtractorUsage | null; // tokens used, for cost logging
}
```

`ExtractedTimesheet` carries header guesses, rows, a `{ value, confidence }`
pair on every field (0..1), the raw transcription, and warnings.

Two real implementations live behind it:

- **ClaudeVisionExtractor** (`claude.ts`, production default): sends the image
  or PDF to Claude with the exact form layout, the 17 labor codes, and the 9
  descriptions baked into the system prompt (`claudeVisionPrompt.ts`). It
  **forces a tool call** so the response is always structurally valid JSON,
  validates it with Zod, and retries once if validation fails.
- **MockExtractor** (`mock.ts`, dev only, `EXTRACTOR=mock`): returns a realistic
  Glenn Swinger / WO 4354 sheet with deliberate imperfections so the review
  workflow has something to catch: an ambiguous work order (4354 vs 4364), a
  smudged labor code, an illegible description, and a blank trailing row. No
  network, no cost.

Selection happens in one place, `getExtractor()` inside `runExtraction()`
(`src/lib/extractors/index.ts`). The UI never knows which backend ran.

`runExtraction()` also adds the production guardrails:

- **Cache by file hash.** Re-uploading the same image returns the cached result
  with no second charge.
- **Daily API cap** (Settings, default 100/day). Once exceeded, uploads fall
  back to the mock extractor and a banner appears, so a runaway loop cannot burn
  the budget overnight.
- **Token + cost logging.** Every real call is written to `AuditLog`; Settings
  shows today's calls, tokens, and estimated cost.

### Demo without a real photo

Open `/review`, pick the seeded Glenn Swinger sheet, and you will see the
low-confidence cells highlighted. Fix the work order, approve, then open
`/reports` to export the PDF/CSV. To exercise the real Claude path, set
`EXTRACTOR=claude` with a funded key and upload a photo on `/upload`.

## Screens

1. `/` Dashboard: hours this week, jobs in progress, jobs over budget, uploads
   needing review, a job-progress grid (green under 75%, yellow 75-100%, red
   over 100%), and recent uploads.
2. `/upload`: drag-and-drop image or PDF, employee + date, uploading ->
   extracting -> routes to Review.
3. `/review` and `/review/[uploadId]`: editable table matching the paper form
   (WO#, Customer, Part ID, Description dropdown, Code dropdown, 15-minute time
   pickers, auto decimal hours with manual override). Low-confidence cells are
   highlighted. Per-row approve, approve all, add row, delete row.
4. `/jobs` and `/jobs/[id]`: sortable jobs with budget tiers, job detail with
   inline budget edit, status toggle, and approved entries.
5. `/reports`: date range + group by job/employee/code, on-screen preview,
   Download PDF, Download CSV, Email to.
6. `/settings`: company info, employees, labor codes, descriptions, OCR
   threshold, daily API cap, API usage, and encrypted key entry.

## Data model

`Company` (single row), `Employee`, `LaborCode` (17 seeded), `TaskDescription`
(9 seeded), `Job` (work order, customer, budgeted hours, status),
`TimesheetUpload` (file, status, employee, date, raw JSON, warnings),
`TimesheetEntry` (editable rows, per-field confidence JSON, status, approval),
`OcrCache` (hash -> result), `AuditLog` (edits, approvals, OCR calls with
tokens and cost). IDs are cuids. Extracted data starts in `needs_review`. Only
`approved` rows count toward job totals and exports.

## Deploying to Proxmox + Cloudflare Tunnel

On a Proxmox VM (Debian/Ubuntu) with Docker and the Docker Compose plugin:

```bash
# 1. Clone and configure
git clone <your-repo> /opt/ravens-timesheet
cd /opt/ravens-timesheet
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY, EXTRACTOR=claude, APP_SECRET (random),
# and optionally RESEND_API_KEY + RESEND_FROM.

# 2. Build and start web + db
docker compose up -d --build

# The web container runs `prisma db push` on start to create the schema,
# then serves on :3000. Seed once (optional, for demo data):
docker compose exec web node_modules/.bin/tsx prisma/seed.ts

# 3. Verify it survives a restart
docker compose restart
docker compose ps
```

The app is now on the VM at `http://<vm-ip>:3000`. Do not port-forward. Expose
it through Cloudflare Tunnel:

```bash
# On the VM, install cloudflared, then:
cloudflared tunnel login
cloudflared tunnel create ravens
# Map a hostname to the local app:
cloudflared tunnel route dns ravens timesheets.luifigueroa.com

# /etc/cloudflared/config.yml
# tunnel: <TUNNEL_ID>
# credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
# ingress:
#   - hostname: timesheets.luifigueroa.com
#     service: http://localhost:3000
#   - service: http_status:404

sudo cloudflared service install
sudo systemctl restart cloudflared
```

Office staff hit `https://timesheets.luifigueroa.com`. No open inbound ports.

### Backups

`scripts/backup.sh` runs `pg_dump` of the Postgres container to a backups
folder and prunes anything older than 14 days. Add it to cron on the host:

```bash
chmod +x scripts/backup.sh
( crontab -l 2>/dev/null; echo "0 2 * * * /opt/ravens-timesheet/scripts/backup.sh >> /var/log/ravens-backup.log 2>&1" ) | crontab -
```

## Notes

- `pnpm build` on a Windows host fails only at the final standalone symlink step
  (Windows requires admin/Developer Mode for symlinks). The Docker image builds
  on Linux where this is a non-issue. Local development uses `pnpm dev`.
- Phase 2 (not built): printable blank paper template, multi-page PDF uploads
  beyond page handling, richer audit log UI.
