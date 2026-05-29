# Security

## Threat model

FabSheet is a single-tenant-per-deploy internal tool for a fabrication shop's
office staff. The data is timesheet hours, job numbers, employee names, and
photos of paper sheets (which contain handwriting and sometimes signatures).
There is no public sign-up. The adversaries we design against:

1. A random person who finds the domain. Mitigated by required auth.
2. A former employee whose access should be revoked. Mitigated by the email
   allowlist + session revocation.
3. Cross-site attacks (CSRF, clickjacking, XSS). Mitigated by framework
   defaults + the headers below.

We are NOT defending against a malicious authenticated admin, or a compromised
host. Those are out of scope for an internal tool of this size.

## Authentication

- **Magic link only** (BetterAuth). No passwords to leak or phish.
- **Allowlist** (`AUTH_MODE=allowlist` + `ALLOWED_EMAILS`): only listed emails
  receive a link. Requests for non-listed emails return a generic success so
  the allowlist can't be probed for which addresses exist.
- **Sessions**: 30-day expiry, refreshed weekly. Stored server-side in the
  `Session` table; the cookie holds only a token.
- **Cookies**: `HttpOnly`, `Secure` (in production), `SameSite=Lax`, `Path=/`.
  Set in `lib/auth.ts` under `advanced.defaultCookieAttributes`.
- Revoke a user: remove them from `ALLOWED_EMAILS` (blocks new links) and
  delete their `Session` rows (kills the active session immediately).

## Transport + headers

Set in `next.config.mjs` `headers()`:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY` (+ CSP `frame-ancestors 'none'`) — no embedding.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`: `default-src 'self'`, scripts/styles limited to
  self + inline (Next requirement), `connect-src` limited to self + Anthropic
  + Resend + the R2 host, `img-src` self + data/blob + R2.
- `Permissions-Policy`: camera allowed (for the iPad capture), mic + geo denied.

Verify with https://securityheaders.com against the live domain.

## Images

Timesheet photos live in Cloudflare R2. They are NEVER served via raw public
R2 URLs in production. Retrieval goes through `lib/storage.ts` `getUploadUrl`,
which issues a 1-hour signed URL (or uses a configured public base only if you
deliberately set `R2_PUBLIC_URL`). R2 encrypts objects at rest by default.

## Server Actions / CSRF

Next.js Server Actions are POST-only with an origin check and an encrypted
action ID, which provides CSRF protection. BetterAuth's own routes carry their
CSRF protection. The login form posts through a Server Action
(`lib/login-actions.ts`), not a raw fetch.

## Secrets

- All secrets are server-side env vars. The only `NEXT_PUBLIC_*` values are the
  app name and URL (non-sensitive).
- After any deploy, audit with: `pnpm build` then grep `.next` for key-shaped
  strings (`sk-ant`, `re_`, R2 secret) — there should be zero matches.

## Audit log

Every mutation writes an `AuditLog` row (tenant, entity, action, before/after,
timestamp). Treat it as append-only: the app never updates or deletes audit
rows. (A future hardening step is a DB trigger to enforce this at the Postgres
level; currently it's an app-level invariant.)

## Known gaps / backlog

- Rate limiting (Upstash) is specced but not wired — needs a Redis account.
  Until then, BetterAuth's per-route protections + the allowlist are the guard.
- Magic-link tokens are managed by BetterAuth (single-use, 15-min expiry).
  Confirm hashing-at-rest matches your BetterAuth version's default.
