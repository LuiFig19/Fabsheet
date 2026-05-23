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
