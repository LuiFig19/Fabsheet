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
 * Mon 00:00 of this work week, Sat 00:00 (= end of Fri), and how many work days
 * are left including today. Sat/Sun roll forward: the next Mon-Fri is "this
 * work week" with all 5 days remaining and zero hours logged so far.
 */
export function workWeekProgress(now = new Date()) {
  const ref = new Date(now);
  ref.setHours(0, 0, 0, 0);
  const dow = ref.getDay(); // 0=Sun..6=Sat
  // On Sat/Sun, jump to next Monday so the goal resets cleanly.
  const onWeekend = dow === 0 || dow === 6;
  const monday = new Date(ref);
  if (onWeekend) {
    monday.setDate(ref.getDate() + (dow === 6 ? 2 : 1));
  } else {
    monday.setDate(ref.getDate() - (dow - 1));
  }
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  // Mon=5 remaining (Mon..Fri), Tue=4, Wed=3, Thu=2, Fri=1, weekend=5 (next week)
  const todayDow = onWeekend ? 1 : dow; // treat weekends as "Monday of next week"
  const daysRemaining = onWeekend ? 5 : 5 - (todayDow - 1);

  return { weekStart: monday, weekEnd: saturday, daysRemaining, onWeekend };
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

/** Budget usage color tier per spec: green <75%, yellow 75-100%, red >100%. */
export function budgetTier(used: number, budget: number): "green" | "yellow" | "red" | "none" {
  if (!budget || budget <= 0) return "none";
  const pct = used / budget;
  if (pct > 1) return "red";
  if (pct >= 0.75) return "yellow";
  return "green";
}
