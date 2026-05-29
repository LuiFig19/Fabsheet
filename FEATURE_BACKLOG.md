# Feature backlog

Ranked ideas from the hardening brainstorm. The top 3 shipped; the rest live
here. Each has a one-line pitch and the pushback that kept it out of scope.

## Shipped

- **Bulk-approve clean uploads** — one button approves every needs-review
  upload with zero flags, so the manager only hand-reviews problem sheets.
  (Review queue → "Approve all clean".)
- **QuickBooks payroll CSV** — Reports → "Payroll CSV" exports approved hours
  per employee per day for the range, shaped for a QB Time-by-Employee import.
- **Overlap detection** — dashboard flags when one welder has two entries with
  overlapping start/end times on the same day (double-logged hours).

## Backlog (not built)

### Job profitability ($)
Multiply approved hours by a per-code labor rate to show labor dollars burned
vs budget per job. **Why not yet:** needs labor rates entered and stored, which
the shop may consider sensitive; also turns the tool into a costing system,
which is scope beyond "augment the paper process".

### "Unaccounted for today"
List active employees with no approved hours by mid-afternoon so the manager
can chase missing sheets. **Why not yet:** edges toward surveillance; needs a
clear framing as "missing paperwork" not "who's slacking", and a configurable
cutoff time.

### Re-run OCR on a sheet
Button on a reviewed upload to re-run Claude Vision when the first read was
poor. **Why not yet:** costs another API call; the manual-edit path already
covers a bad read; would want a per-day cap interaction.

### Automated DB backup to R2
Scheduled `pg_dump` → R2 with 30/12/5 retention. **Why not yet:** Vercel cron
can trigger it but `pg_dump` isn't available in the serverless runtime; needs
either a small external worker or Neon's own export API.

### Upstash rate limiting
5 magic-link requests / email / 10 min, 30 uploads / user / 10 min.
**Why not yet:** needs an Upstash Redis account + credentials. BetterAuth's
per-route protection + the allowlist cover the gap for now.

### Sentry error tracking
Client + server error capture. **Why not yet:** needs a Sentry account; current
errors go to Vercel Runtime Logs + the `AuditLog`/console.

### Pinch-to-zoom photo viewer
Native touch pinch-zoom on the Review photo (currently button zoom + rotate).
**Why not yet:** needs a gesture lib or careful pointer-event handling; button
zoom is functional on the iPad today.

### Per-unit auto-crop in Review
When a flagged field is focused, auto-zoom the photo to that row. **Why not
yet:** crop coordinates depend on photo angle/skew; fragile without a detected
form bounding box. Manual pan/zoom works in the meantime.
