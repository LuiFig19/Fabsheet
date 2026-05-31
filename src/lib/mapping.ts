import type { ExtractedRow, ExtractedTimesheet } from "@/lib/extractors/types";
import { computeDecimalHours, normalizeShopTime, shopTimeToMinutes } from "@/lib/utils";
import { warn, type Warning } from "@/lib/warnings";

// Re-export so existing test imports (mapping.test.ts) keep working.
export { normalizeShopTime } from "@/lib/utils";

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
  // Row-level warnings. Mostly "warn" severity (real review needs). The
  // mapping layer never emits "info" warnings - those are sheet-wide and live
  // in the upload action.
  warnings: Warning[];
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
 * Convert raw OCR rows into editable entry drafts plus row-level warnings.
 * Empty rows are dropped silently (welders often use 1-2 rows out of 7 — that
 * is normal, not a "missing data" situation). Customer + labor code are
 * DERIVED here, never re-entered.
 *
 * Row warnings are only added for things a manager would genuinely act on:
 *  - JOB # not in the jobs list. (The one canonical hard flag.)
 *  - UNIT validation against job.quantity.
 *  - Times outside the shop workday after inference (genuinely odd).
 *  - End time before start time after inference (definite error).
 *  - Times completely unreadable (rare; the model normally produces 24h).
 *
 * Routine AM/PM resolution (5 -> 17:00, 1:00 -> 13:00, 7 -> 07:00 etc.) is
 * SILENT — that's expected behavior, not a flag. Blank bubbles/notes are
 * also silent: the welder may have only filled what was needed.
 */
export function entriesFromExtraction(input: MappingInput): MappingOutput {
  const drafts: EntryDraft[] = [];
  let prevFinishMins: number | null = null;

  for (const r of input.ex.rows) {
    if (rowIsBlank(r)) continue;
    const row = r!;
    const warnings: Warning[] = [];

    const wo = row.jobNumber.value.trim();
    const matched = input.jobs.find((j) => j.workOrderNumber === wo);
    const customer = matched?.customerName ?? "";
    if (wo && !matched) warnings.push(warn(`JOB # ${wo} is not in the jobs list. Add it in Settings, or fix the number.`));

    const task = row.taskBubble.value;
    const action = row.actionBubble.value;
    const notes = row.notes.value ?? "";
    const description = action || task || (notes ? "Other" : "");
    const laborCode = codeFromBubble(task, action);

    const unitNumber = parseIntOrNull(row.unitNumber.value);
    const unitTotal = parseIntOrNull(row.unitTotal.value);
    if (matched) {
      const v = validateUnit(unitNumber, unitTotal, matched.quantity, wo);
      if (v) warnings.push(warn(v));
    }

    // Normalize times. Use chronological context so 6 in a row that follows a
    // PM finish resolves to 18:00, not 06:00.
    const rawStart = row.startedTime.value;
    const rawEnd = row.finishedTime.value;
    const startTime = normalizeShopTime(rawStart, { kind: "start", previousMinutes: prevFinishMins });
    const startMins = shopTimeToMinutes(startTime);
    const endTime = normalizeShopTime(rawEnd, { kind: "finish", previousMinutes: startMins ?? prevFinishMins });
    const endMins = shopTimeToMinutes(endTime);
    const decimalHours = startTime && endTime ? computeDecimalHours(startTime, endTime) : 0;

    // Only flag genuinely broken times. Routine AM/PM resolution is silent.
    // Overtime past 4 PM is normal at this shop and does NOT get flagged.
    if (rawStart && !startTime) warnings.push(warn(`Could not read start time "${rawStart}".`));
    if (rawEnd && !endTime) warnings.push(warn(`Could not read finish time "${rawEnd}".`));
    if (startMins != null && endMins != null && endMins <= startMins) {
      warnings.push(warn(`Finish ${endTime} is at or before start ${startTime}. Check the order.`));
    }

    if (endMins != null) prevFinishMins = endMins;

    drafts.push({
      workOrderNumber: wo,
      customerName: customer,
      unitNumber,
      unitTotal,
      description,
      laborCode,
      startTime: startTime || rawStart,
      endTime: endTime || rawEnd,
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

// normalizeShopTime moved to @/lib/utils (re-exported at the top of this file).
