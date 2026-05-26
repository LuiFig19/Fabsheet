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
 * (false). The 1xx series is direct fabrication work (Weld/Fab, Cut, Decking,
 * Floats, Bumper, Helping Welder, Special Projects, Fit-Up/Install). The 2xx
 * series is non-production support time (Shipping Prep, Wash, Load/Unload,
 * Welding Machine Repair, Admin, Maintenance, Inventory). Anything else
 * (blank, "999 Other") counts as non-productive.
 *
 * Entries store the labor code as a string like "110 Weld/Fab", so we read the
 * first run of digits.
 */
export function isProductiveCode(laborCode: string | null | undefined): boolean {
  if (!laborCode) return false;
  const m = /^\s*(\d+)/.exec(laborCode);
  if (!m) return false;
  return m[1].startsWith("1");
}

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
