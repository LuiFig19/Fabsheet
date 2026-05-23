# FabSheet deployment

FabSheet is the platform. Raven's Marine is the first tenant. This document
covers the live Raven's deployment on Vercel + Neon + Cloudflare R2, plus how to
operate it: rotate the access prefix, spin up the multi-tenant deployment, add
tenants and divisions, and back up the database.

Everything here you run yourself (the accounts are yours). The codebase is ready
to deploy as-is.

---

## 0. Architecture in one paragraph

One Next.js app, one Postgres database, config-driven tenancy. `APP_MODE`
decides behavior at deploy time. For Raven's, `APP_MODE=single_tenant`: the app
is served only under a secret URL prefix (`ACCESS_PATH_PREFIX`), no login, all
data implicitly scoped to the `ravens` tenant. Flip `APP_MODE=multi_tenant` on a
second deploy and the same code requires magic-link login and puts the tenant
slug in the URL. Every query is scoped by `tenantId`, so multiple tenants can
share one database with no leakage.

---

## 1. The live Raven's URL (after you finish the steps below)

```
https://fabsheet.org/r/8h3kd92ksjf/dashboard
```

- `/r/8h3kd92ksjf` is the access prefix. Anyone hitting `fabsheet.org` or
  `fabsheet.org/dashboard` without it gets a plain 404 and cannot tell an app
  is there.
- Bookmark the full URL on the iPad home screen (Safari, Share, Add to Home
  Screen) so it opens full-screen with no address bar.

Generate your own prefix so it is not the example value:

```bash
node -e "console.log('r/' + require('crypto').randomBytes(6).toString('hex'))"
```

---

## 2. Cloudflare R2 (image storage)

1. Cloudflare dashboard, R2, Create bucket: `fabsheet-ravens`.
2. R2, Manage R2 API Tokens, Create API token, Object Read & Write, scoped to
   that bucket. Copy the Access Key ID and Secret Access Key.
3. Your account ID is in the R2 overview (also in the S3 endpoint).
4. Optional public access: enable the bucket's r2.dev public URL (or attach a
   custom domain) and set `R2_PUBLIC_URL`. If you skip this, the app serves
   short-lived signed URLs instead. Either works.

Env values produced here:

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=fabsheet-ravens
R2_PUBLIC_URL=        # optional
```

Images are written server-side only; the browser never sees R2 credentials. The
object key is `tenants/<slug>/uploads/<uploadId>-<filename>`, so storage is
tenant-isolated and survives Vercel redeploys (Vercel disk is ephemeral; R2 is
not).

---

## 3. Neon Postgres

1. neon.tech, create project `tracksheet-prod`.
2. Copy the pooled connection string. Append `?sslmode=require` if not present.
3. Locally, point at it and create the schema + seed the Raven's tenant:

```bash
export DATABASE_URL="postgres://...neon..."   # PowerShell: $env:DATABASE_URL="..."
pnpm prisma db push           # create tables
pnpm db:seed                  # creates the ravens tenant, welding division,
                              # 17 codes, 9 descriptions, employees, sample jobs
```

`db push` is used here because the schema has no migration history yet. If you
prefer migrations: `pnpm prisma migrate dev --name init` once, commit the
`prisma/migrations` folder, then use `pnpm prisma migrate deploy` in CI.

To migrate an existing single-tenant database (e.g. the old local one) instead
of seeding fresh, run `pnpm db:backfill` once. It creates the tenant + division
and stamps `tenantId`/`divisionId` on all existing rows without data loss.

---

## 4. Vercel

1. Push this repo to a private GitHub repo.
2. vercel.com, Add New Project, import the repo. Framework preset: Next.js.
3. Project Settings, Environment Variables. Add everything from `.env.example`
   with real values (see the full list at the bottom of this file). Critically:
   - `APP_MODE=single_tenant`
   - `DEFAULT_TENANT_SLUG=ravens`
   - `ACCESS_PATH_PREFIX=r/<your-generated-prefix>`
   - `APP_SECRET=<random 32+ chars>`
   - `EXTRACTOR=claude` and a funded `ANTHROPIC_API_KEY`
   - the `R2_*`, `DATABASE_URL`, `RESEND_API_KEY`, and `NEXT_PUBLIC_*` values
4. Deploy.
5. Project Settings, Domains: add `fabsheet.org` (and `www` if you want).

> Note: `ACCESS_PATH_PREFIX` is read at build time (it sets Next's `basePath`).
> If you change it later, you must redeploy for it to take effect.

---

## 5. DNS for fabsheet.org

You bought the domain at Namecheap, so DNS lives there by default. Two options:

**Option A (simplest) — DNS at Namecheap.**
In Namecheap, Domain List, Manage on `fabsheet.org`, Advanced DNS, add the
records Vercel shows you under Settings, Domains. Typically:
- `A` record host `@` value `76.76.21.21`
- `CNAME` host `www` value `cname.vercel-dns.com.`
Delete the default Namecheap parking records first. Wait 5–15 minutes for
Vercel to verify the domain and issue the TLS cert.

**Option B — move DNS to Cloudflare (recommended only if you want Cloudflare's
analytics or want to share the account ID you already use for R2).**
Add the site in Cloudflare, copy the two assigned nameservers, then in
Namecheap, Domain List, Manage, Nameservers, switch to Custom DNS and paste
those two. Once Cloudflare reports active, add the same A/CNAME records there.
Proxy status: DNS only (grey cloud) so Vercel terminates TLS.

Once the domain is verified, the live URL is
`https://fabsheet.org/r/<prefix>/dashboard`.

---

## 6. Verify the deployment

- `https://fabsheet.org/dashboard` returns 404 (no prefix).
- `https://fabsheet.org/r/<prefix>/dashboard` loads the Raven's app.
- On the iPad, tapping Upload Timesheet, Take photo opens the rear camera.
- A photo of a real sheet uploads, runs Claude Vision, and lands on Review with
  extracted rows. (Requires a funded Anthropic account, see below.)
- Settings, API usage shows real call counts and estimated cost.

### Anthropic credit note

Claude Vision requires a positive credit balance on your Anthropic account. A
valid key with a $0 balance returns `400 credit balance is too low`, which the
app surfaces on upload. Add credits under console.anthropic.com, Plans &
Billing. Budget about $0.01 to $0.02 per sheet.

---

## 7. Rotate the access prefix (if it leaks)

1. Generate a new prefix:
   `node -e "console.log('r/' + require('crypto').randomBytes(6).toString('hex'))"`
2. Update `ACCESS_PATH_PREFIX` in Vercel env vars.
3. Redeploy (the prefix is build-time).
4. Update the iPad bookmark to the new URL. The old prefix now 404s.

No data changes; this is purely the front-door path.

---

## 8. Spin up the multi-tenant deployment (when you sell to the president)

Same repo, second Vercel project, different env:

```
APP_MODE=multi_tenant
# ACCESS_PATH_PREFIX is ignored in multi_tenant mode (leave unset)
APP_SECRET=<a different random secret>
DATABASE_URL=<a Neon database; can be the same one or a separate one>
RESEND_API_KEY=<required for magic-link login emails>
NEXT_PUBLIC_APP_URL=https://app.fabsheet.org
```

Add a domain like `app.fabsheet.org`. Behavior changes with zero code edits:

- Visiting any page redirects to `/login`.
- Login is a magic link emailed via Resend (no passwords).
- After sign-in, URLs are `/<tenantSlug>/dashboard`, etc.
- Users only see their own tenant's data.

You can run both deployments off the same Neon database safely because every
query is tenant-scoped. The Raven's single-tenant URL keeps working unchanged.

---

## 9. Add a new tenant (new customer)

Until an admin UI exists, add tenants with a one-off script or psql. Example
script (run with `pnpm exec tsx`):

```ts
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const t = await db.tenant.create({
  data: { slug: "acme", name: "Acme Fabrication", displayName: "Acme Fabrication", contactEmail: "ops@acme.com" },
});
await db.division.create({ data: { tenantId: t.id, name: "Main", slug: "main" } });
await db.company.create({ data: { tenantId: t.id, name: "Acme Fabrication" } });
await db.user.create({ data: { tenantId: t.id, email: "owner@acme.com", name: "Owner", role: "admin" } });
// seed that tenant's labor codes / descriptions as needed
```

The new tenant signs in (multi_tenant) at `/acme/dashboard` after a magic link
to `owner@acme.com`. For a single-tenant deployment for them instead, deploy a
new Vercel project with `APP_MODE=single_tenant`, `DEFAULT_TENANT_SLUG=acme`, and
a fresh `ACCESS_PATH_PREFIX`.

---

## 10. Add a division within a tenant

```ts
await db.division.create({ data: { tenantId: <tenantId>, name: "Machining", slug: "machining" } });
```

When a tenant has more than one division, the division picker appears in the UI
automatically. With a single division (Raven's, "Welding") no picker shows.
Assign jobs/employees to a division by setting their `divisionId`.

---

## 11. Back up the Neon database

Neon keeps automatic point-in-time history on its own, but for an independent
copy:

```bash
# Logical dump (run anywhere with psql tools installed)
pg_dump "$DATABASE_URL" -Fc -f tracksheet-$(date +%Y%m%d).dump

# Restore into a fresh database
pg_restore --clean --no-owner -d "$TARGET_DATABASE_URL" tracksheet-YYYYMMDD.dump
```

Schedule the dump from any machine/cron that can reach Neon. Store the dumps off
Neon (e.g. in the same R2 account, a different bucket).

---

## Full environment variable list (Vercel)

```
APP_MODE=single_tenant
DEFAULT_TENANT_SLUG=ravens
ACCESS_PATH_PREFIX=r/<your-prefix>
APP_SECRET=<random 32+ chars>

DATABASE_URL=postgres://...neon...?sslmode=require

EXTRACTOR=claude
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-6
DAILY_OCR_CAP=100

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=fabsheet-ravens
R2_PUBLIC_URL=            # optional

RESEND_API_KEY=re_...
DEFAULT_FROM_EMAIL=ravens@fabsheet.org
DEFAULT_TO_EMAILS=hr@ravensmarine.com,office@ravensmarine.com

NEXT_PUBLIC_APP_NAME=FabSheet
NEXT_PUBLIC_APP_URL=https://fabsheet.org
```
