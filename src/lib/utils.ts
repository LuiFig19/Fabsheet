import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "HH:MM" -> minutes since midnight, or null. */
export function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Decimal hours between start and end. Crossing midnight is treated as +24h. */
export function computeDecimalHours(start: string, end: string): number {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

export function fmtHours(h: number): string {
  return (Math.round((h || 0) * 100) / 100).toFixed(2);
}

/**
 * Classify a Raven's labor code as production-hours (true) vs. overhead/support
 * (false). Production codes are direct fabrication work; everything else is
 * non-production support time. Codes that don't match are non-productive
 * (blank, "999 Other", unknown). Entries store the code as a string like
 * "110 Weld/Fab", so we read the first run of digits.
 *
 * Productive (counts toward the weekly target):
 *   110 Weld/Fab, 120 Cut, 125 Cut for Stock, 130 Repair/Reworking,
 *   140 Labor Decking, 150 Floats, 160 Bumper, 170 Helping Welder,
 *   180 Special Projects, 280 Fit-Up/Install.
 * Non-productive:
 *   210 Shipping Prep, 220 Wash, 230 Load/Unload (forklift),
 *   240 Welding Machine Repair, 250 Admin, 260 Maintenance, 270 Inventory.
 */
const PRODUCTIVE_CODES = new Set([
  "110", "120", "125", "130", "140", "150", "160", "170", "180", "280",
]);

export function isProductiveCode(laborCode: string | null | undefined): boolean {
  if (!laborCode) return false;
  const m = /^\s*(\d+)/.exec(laborCode);
  if (!m) return false;
  return PRODUCTIVE_CODES.has(m[1]);
}

/** Prisma `where` fragment that matches productive laborCode strings. */
export const productiveCodeWhere = {
  OR: Array.from(PRODUCTIVE_CODES).map((c) => ({ laborCode: { startsWith: c } })),
};
export const nonProductiveCodeWhere = {
  AND: Array.from(PRODUCTIVE_CODES).map((c) => ({ NOT: { laborCode: { startsWith: c } } })),
};

/**
 * Mon 00:00 of this work week, Sun 00:00 (= end of Saturday), and how many
 * work days remain. The shop week is Mon-Sat (Saturday is OT), with Sunday
 * as the rest/collection day. All timesheets should be in by Sunday so the
 * prior week is complete.
 *
 *  - On Mon-Sat: this calendar week is "now." Saturday counts as still in
 *    progress (OT day) rather than rolling forward.
 *  - On Sun: the work week is over; the next Monday is the new week's
 *    starting line at 0/target.
 *
 * `daysRemaining` is measured in **Mon-Fri** standard work days, because the
 * production target is sized for Mon-Fri with Saturday as bonus headroom.
 * Saturday returns 0 (target should already be hit by then in the normal case).
 */
export function workWeekProgress(now = new Date()) {
  const ref = new Date(now);
  ref.setHours(0, 0, 0, 0);
  const dow = ref.getDay(); // 0=Sun..6=Sat
  const onWeekend = dow === 0; // Sunday only; Saturday is still a work day

  const monday = new Date(ref);
  if (dow === 0) {
    monday.setDate(ref.getDate() + 1); // Sun -> next Mon
  } else {
    monday.setDate(ref.getDate() - (dow - 1)); // Mon-Sat -> this week's Monday
  }
  // Exclusive end: next Sunday 00:00 (= end of Saturday). Mon-Sat fall inside.
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 6);

  // Work days remaining (Mon=5, Tue=4, ..., Fri=1, Sat=0, Sun=5 of next week).
  let daysRemaining: number;
  if (dow === 0) daysRemaining = 5;        // Sunday → new week, full Mon-Fri ahead
  else if (dow === 6) daysRemaining = 0;   // Saturday → standard week is over (OT day)
  else daysRemaining = 5 - (dow - 1);      // Mon=5, Tue=4, Wed=3, Thu=2, Fri=1

  return { weekStart: monday, weekEnd, daysRemaining, onWeekend };
}


export function fmtMoney(n: number): string {
  return `$${(Math.round((n || 0) * 100) / 100).toFixed(2)}`;
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function toDateInputValue(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

/**
 * Shop workday bounds in shop-local clock hours.
 *
 *  Standard workday: 5 AM - 4 PM (Mon-Fri, sometimes Saturday).
 *  Overtime past 4 PM is NORMAL at this shop and must not be flagged. These
 *  constants are used only to resolve AM/PM on ambiguous handwriting (e.g.
 *  "1" obviously means 1 PM because 1 AM is outside any shift), never as a
 *  hard upper bound for "is this entry valid?".
 *
 * Future-config: move to Company.workdayStartHour / workdayEndHour when the
 * shop ever runs a second shift. For now this is hardcoded across the codebase.
 */
export const SHOP_DAY_START_HOUR = 5;
export const SHOP_DAY_END_HOUR = 16; // 4 PM

/**
 * Translate "HH:MM" 24-hour to minutes since midnight, or null. Mirrors
 * timeToMinutes but tolerates the normalized HH:MM output of normalizeShopTime.
 */
export function shopTimeToMinutes(hhmm: string): number | null {
  return timeToMinutes(hhmm);
}

export type ShopTimeKind = "start" | "finish";

/**
 * Read whatever the welder wrote and return clean "HH:MM" 24-hour. The shop
 * runs day-shift 5 AM to 4 PM with occasional overtime, so:
 *  - 1..4   = PM (1..4 AM is well outside any shift, so they meant 13..16).
 *  - 5,6    = default AM (workday start). Resolve to PM only when context
 *             demands: a finish time whose start was already past this hour
 *             AM, or any time whose preceding row already crossed noon.
 *  - 7..11  = AM (only fits the morning side of the workday).
 *  - 12     = noon.
 *  - 13..23 (already 24h), inputs with a leading zero on a 1-digit hour
 *             ("04:00", "06:30"), and explicit am/pm: pass through verbatim.
 *
 * Returns "" only when the input is genuinely unparseable. The colon is
 * optional ("5" === "5:00"). Overtime past 4 PM is normal and never
 * suppressed — the caller decides whether to flag anything, and we don't.
 */
export function normalizeShopTime(
  s: string | null | undefined,
  ctx: { kind?: ShopTimeKind; previousMinutes?: number | null } = {},
): string {
  if (!s) return "";
  const t = String(s).trim().toLowerCase();
  if (!t) return "";
  const kind: ShopTimeKind = ctx.kind ?? "start";
  const prev = ctx.previousMinutes ?? null;

  // 1. Explicit am/pm
  const ampm = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(t);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2] ?? "0");
    if (ampm[3] === "pm" && h !== 12) h += 12;
    if (ampm[3] === "am" && h === 12) h = 0;
    return fmtHHMM(h, m);
  }

  // Leading zero on a 1-digit hour means the source already used 24-hour
  // notation ("04:00" came from Vision, not the welder). Trust it as-is, do
  // NOT apply the 1..4 PM rule.
  const looks24h = /^0\d(:\d{2})?$/.test(t);

  // 2. Pull hour + optional minutes from "HH:MM" or bare number.
  const colon = /^(\d{1,2}):(\d{2})$/.exec(t);
  const bare = /^(\d{1,2})$/.exec(t);
  let h: number, m: number;
  if (colon) { h = Number(colon[1]); m = Number(colon[2]); }
  else if (bare) { h = Number(bare[1]); m = 0; }
  else return "";

  if (m > 59 || h > 23) return "";

  // 3. Already in 24-hour territory, midnight, or zero-padded: trust verbatim.
  if (h >= 13) return fmtHHMM(h, m);
  if (h === 0) return fmtHHMM(0, m);
  if (looks24h) return fmtHHMM(h, m);

  // 4. h in 1..12 — disambiguate using shop hours + chronological context.
  if (h === 12) return fmtHHMM(12, m);
  if (h >= 1 && h <= 4) return fmtHHMM(h + 12, m); // 1..4 = PM (1..4 AM outside shift)
  if (h === 5 || h === 6) {
    // 5/6 AM is the typical workday start. Flip to PM only when context
    // makes AM impossible: prior row already crossed noon, or this is a
    // finish time whose start was at or after this AM hour.
    const continuedFromPm = prev != null && prev >= 12 * 60;
    const finishBeforeStart = kind === "finish" && prev != null && prev >= h * 60;
    if (continuedFromPm || finishBeforeStart) return fmtHHMM(h + 12, m);
    return fmtHHMM(h, m);
  }
  // h in 7..11 — always AM in this shop (7..11 PM is past any normal OT).
  return fmtHHMM(h, m);
}

function fmtHHMM(h: number, m: number): string {
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** True when the HH:MM time lies within the shop workday. */
export function withinShopDay(hhmm: string): boolean {
  const mins = timeToMinutes(hhmm);
  if (mins == null) return false;
  return mins >= SHOP_DAY_START_HOUR * 60 && mins <= SHOP_DAY_END_HOUR * 60;
}

/**
 * Current calendar date + hour in Raven's local timezone (Eastern). Shop ops
 * (the daily "did everyone submit?" check, the 6 PM cutoff) should never key
 * off server-UTC time or browser-local time.
 */
const SHOP_TIMEZONE = "America/New_York";
export function easternNow(now: Date = new Date()): { dateIso: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { dateIso: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** UTC range that covers a YYYY-MM-DD calendar day. Used to match upload.date
 *  values (stored at noon UTC). */
export function utcDayBounds(dateIso: string): { start: Date; end: Date } {
  const start = new Date(`${dateIso}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Budget usage color tier per spec: green <75%, yellow 75-100%, red >100%. */
export function budgetTier(used: number, budget: number): "green" | "yellow" | "red" | "none" {
  if (!budget || budget <= 0) return "none";
  const pct = used / budget;
  if (pct > 1) return "red";
  if (pct >= 0.75) return "yellow";
  return "green";
}
