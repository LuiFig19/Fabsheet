import type { ExtractedRow, ExtractedTimesheet } from "@/lib/extractors/types";
import { computeDecimalHours } from "@/lib/utils";

/**
 * V5 bubble -> labor-code derivation. The form has no Code field; the manager
 * never picks one. The system reads the bubble and assigns the code.
 *
 * If a row has neither a task bubble nor an action bubble, the code is "" and
 * the manager is asked to pick the right bubble in Review.
 */
export const TASK_TO_CODE: Record<string, string> = {
  // Component / fabrication tasks (all map to 110 Weld/Fab unless explicitly
  // their own code - only Decking has its own).
  Frame: "110",
  Decking: "140",
  Rails: "110",
  ADA: "110",
  Tread: "110",
  "5th W": "110",
  Splice: "110",
  Pickets: "110",
  Mesh: "110",
  // Action codes.
  Rework: "130",
  Forklift: "230",
  Cutting: "120",
  "Machine Repair": "240",
};

const CODE_LABELS: Record<string, string> = {
  "110": "110 Weld/Fab",
  "120": "120 Cut",
  "130": "130 Repair/Reworking",
  "140": "140 Labor Decking",
  "230": "230 Load/Unload Trucks",
  "240": "240 Welding Machine Repair",
};

/** Derive a "110 Weld/Fab" style label from a bubble. Empty if no mapping. */
export function codeFromBubble(taskBubble: string | null, actionBubble: string | null): string {
  const key = actionBubble || taskBubble;
  if (!key) return "";
  const num = TASK_TO_CODE[key];
  if (!num) return "";
  return CODE_LABELS[num] ?? num;
}

export type EntryDraft = {
  workOrderNumber: string;
  customerName: string;
  unitNumber: number | null;
  unitTotal: number | null;
  description: string; // the bubble label (Frame, Rails, Rework, Forklift, ...) or "Other"
  laborCode: string; // derived from description
  startTime: string;
  endTime: string;
  decimalHours: number;
  notes: string;
  confidenceByField: Record<string, number>;
  // Row-level warnings produced by mapping (UNIT mismatches, job not found,
  // both bubbles empty, etc). Shown in Review per-row, not just as a banner.
  warnings: string[];
};

export type MappingInput = {
  ex: ExtractedTimesheet;
  jobs: { id: string; workOrderNumber: string; customerName: string; quantity: number }[];
};

export type MappingOutput = {
  drafts: EntryDraft[];
};

function parseIntOrNull(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number.parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function rowIsBlank(r: ExtractedRow | null): boolean {
  if (!r) return true;
  return !r.jobNumber.value && !r.startedTime.value && !r.finishedTime.value && !r.taskBubble.value && !r.actionBubble.value && !r.notes.value;
}

/**
 * Convert raw OCR rows into editable entry drafts plus per-row warnings. Empty
 * rows are dropped (position is just for the OCR side). Customer + labor code
 * are DERIVED here - the manager never re-enters them.
 *
 * Rules for warnings (these are what flag in Review, nothing else):
 *  - JOB # not found in jobs[]  -> warn the row.
 *  - Both task AND action bubbles empty AND notes empty -> warn "no work
 *    indicated". (Notes alone = legitimate "Other" work - not flagged.)
 *  - UNIT validation against job.quantity per the iteration spec.
 */
export function entriesFromExtraction(input: MappingInput): MappingOutput {
  const drafts: EntryDraft[] = [];
  for (const r of input.ex.rows) {
    if (rowIsBlank(r)) continue;
    const row = r!;
    const warnings: string[] = [];

    const wo = row.jobNumber.value.trim();
    const matched = input.jobs.find((j) => j.workOrderNumber === wo);
    const customer = matched?.customerName ?? "";
    if (wo && !matched) warnings.push(`JOB # ${wo} is not in the jobs list. Add it in Settings, or fix the number.`);

    const task = row.taskBubble.value;
    const action = row.actionBubble.value;
    const notes = row.notes.value ?? "";
    const description = action || task || (notes ? "Other" : "");
    const laborCode = codeFromBubble(task, action);

    if (!task && !action && !notes) warnings.push("No task, action, or notes filled. Pick one in Review.");

    const unitNumber = parseIntOrNull(row.unitNumber.value);
    const unitTotal = parseIntOrNull(row.unitTotal.value);
    if (matched) {
      const v = validateUnit(unitNumber, unitTotal, matched.quantity, wo);
      if (v) warnings.push(v);
    }

    // Normalize times from whatever shorthand the welder wrote (5, 5:30,
    // 1, 1pm, 12, etc.) to HH:MM 24-hour. If we can't parse, store empty
    // so the field gets flagged in Review.
    const startTime = normalizeShopTime(row.startedTime.value) || row.startedTime.value;
    const endTime = normalizeShopTime(row.finishedTime.value) || row.finishedTime.value;
    const decimalHours = computeDecimalHours(startTime, endTime);
    if (!normalizeShopTime(row.startedTime.value)) warnings.push(`Could not read start time "${row.startedTime.value}".`);
    if (!normalizeShopTime(row.finishedTime.value)) warnings.push(`Could not read finish time "${row.finishedTime.value}".`);

    drafts.push({
      workOrderNumber: wo,
      customerName: customer,
      unitNumber,
      unitTotal,
      description,
      laborCode,
      startTime,
      endTime,
      decimalHours,
      notes,
      confidenceByField: {
        workOrderNumber: row.jobNumber.confidence,
        unitNumber: row.unitNumber.confidence,
        unitTotal: row.unitTotal.confidence,
        description: Math.max(row.taskBubble.confidence, row.actionBubble.confidence),
        startTime: row.startedTime.confidence,
        endTime: row.finishedTime.confidence,
        notes: row.notes.confidence,
      },
      warnings,
    });
  }
  return { drafts };
}

/**
 * UNIT __ of __ validation per the iteration spec:
 *  - jobQuantity == 1 and welder left UNIT blank: fine, no flag.
 *  - jobQuantity == 1 and welder wrote a number: flag (likely mistake).
 *  - jobQuantity  > 1 and welder left UNIT blank: flag.
 *  - jobQuantity  > 1 and welder wrote a number > jobQuantity: flag.
 *  - jobQuantity  > 1 and welder wrote "of N" with N != jobQuantity: warn only.
 */
export function validateUnit(unitNumber: number | null, unitTotal: number | null, jobQuantity: number, wo: string): string | null {
  if (jobQuantity <= 1) {
    if (unitNumber != null) return `Job ${wo} has only 1 unit, but welder wrote unit ${unitNumber}.`;
    return null;
  }
  if (unitNumber == null) return `Job ${wo} has ${jobQuantity} units. Welder did not specify which one.`;
  if (unitNumber > jobQuantity) return `Welder wrote unit ${unitNumber} but job ${wo} only has ${jobQuantity} units.`;
  if (unitTotal != null && unitTotal !== jobQuantity) return `Welder wrote "of ${unitTotal}" but job ${wo} has ${jobQuantity} units. Saving as ${jobQuantity}.`;
  return null;
}

/** Match a work order string to a known job id. Exact WO match only. */
export function matchJobId(
  workOrderNumber: string,
  jobs: { id: string; workOrderNumber: string }[],
): string | null {
  const wo = workOrderNumber.trim();
  return jobs.find((j) => j.workOrderNumber === wo)?.id ?? null;
}

/**
 * Match an OCR'd employee name to one of the active employees.
 *  - If the welder writes just a first name and that first name is unique in
 *    the active roster, match it.
 *  - If the welder writes "Glenn Sw" (first + last-initial style), match it.
 *  - If the first name has duplicates (e.g. two "Luis"es), require a last
 *    name. Otherwise return null so the manager picks.
 *  - If the name doesn't appear at all, return null (new employee — flag).
 */
export function matchEmployee(name: string, employees: { id: string; name: string; active: boolean }[]): { id: string; name: string } | null {
  if (!name) return null;
  const q = name.toLowerCase().trim().replace(/\s+/g, " ");
  if (!q) return null;
  const active = employees.filter((e) => e.active);

  // 1. exact full-name match
  const exact = active.find((e) => e.name.toLowerCase() === q);
  if (exact) return exact;

  // 2. first-name unique match (the common case — welder wrote "Glenn")
  const parts = q.split(" ");
  if (parts.length === 1) {
    const firstName = parts[0];
    const byFirst = active.filter((e) => e.name.toLowerCase().split(" ")[0] === firstName);
    if (byFirst.length === 1) return byFirst[0];
    if (byFirst.length > 1) return null; // duplicate first names — manager picks
  }

  // 3. partial match: each input segment starts with the corresponding name
  //    segment ("Glenn Sw" -> "Glenn Swinger", "Luis F" -> "Luis Figueroa")
  const candidates = active.filter((e) => {
    const segs = e.name.toLowerCase().split(" ");
    return parts.every((p, i) => (segs[i] ?? "").startsWith(p));
  });
  if (candidates.length === 1) return candidates[0];

  // 4. substring fallback (handles initials, middle bits)
  const sub = active.filter((e) => e.name.toLowerCase().includes(q));
  if (sub.length === 1) return sub[0];
  return null;
}

/**
 * Parse a date string from the OCR header. Accepts the formats welders
 * actually write:
 *   - 1/1/26, 01/01/26, 1/1/2026, 01/01/2026
 *   - 1-1-26, 01-01-2026
 *   - 2026-01-01 (ISO, what the Vision model returns when it can)
 * Two-digit years assume 2000+ (so 26 -> 2026, 99 -> 2099). The shop is in
 * the US so MM/DD ordering is assumed.
 */
export function parseHeaderDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;

  // ISO yyyy-mm-dd
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) return makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // m/d/y or m-d-y (US ordering: month first)
  const us = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/.exec(t);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    let year = Number(us[3]);
    if (year < 100) year += 2000; // 26 -> 2026
    return makeDate(year, month, day);
  }

  return null;
}
function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Noon UTC so the date doesn't drift across local time zones.
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize a time string from the timesheet. Raven's runs day-shift only
 * (5 AM through 4 PM), so:
 *   - "5"     -> "05:00"  (5 AM)
 *   - "7:30"  -> "07:30"
 *   - "12"    -> "12:00"  (noon)
 *   - "1"     -> "13:00"  (1 PM — no night shift, so 1-4 always PM)
 *   - "1:30"  -> "13:30"
 *   - "13:00" -> "13:00"  (already 24h, pass through)
 *   - "16:00" -> "16:00"
 * Anything we can't parse returns "" so the field is flagged for review.
 */
export function normalizeShopTime(s: string | null | undefined): string {
  if (!s) return "";
  const t = String(s).trim().toLowerCase();
  if (!t) return "";

  // Explicit AM/PM in case the welder wrote "5pm" or "5 pm"
  const ampm = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(t);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2] ?? "0");
    if (ampm[3] === "pm" && h !== 12) h += 12;
    if (ampm[3] === "am" && h === 12) h = 0;
    return fmtHHMM(h, m);
  }

  // HH:MM or H:MM
  const colon = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (colon) {
    let h = Number(colon[1]);
    const m = Number(colon[2]);
    if (h >= 1 && h <= 4) h += 12; // Raven's day-shift PM inference
    return fmtHHMM(h, m);
  }

  // Just a number ("5", "12")
  const intOnly = /^(\d{1,2})$/.exec(t);
  if (intOnly) {
    let h = Number(intOnly[1]);
    if (h >= 1 && h <= 4) h += 12; // PM inference
    return fmtHHMM(h, 0);
  }

  return ""; // unparseable — caller flags
}
function fmtHHMM(h: number, m: number): string {
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
