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
  // their own code — only Decking has its own).
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
 * are DERIVED here — the manager never re-enters them.
 *
 * Rules for warnings (these are what flag in Review, nothing else):
 *  - JOB # not found in jobs[]  -> warn the row.
 *  - Both task AND action bubbles empty AND notes empty -> warn "no work
 *    indicated". (Notes alone = legitimate "Other" work — not flagged.)
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

    const decimalHours = computeDecimalHours(row.startedTime.value, row.finishedTime.value);

    drafts.push({
      workOrderNumber: wo,
      customerName: customer,
      unitNumber,
      unitTotal,
      description,
      laborCode,
      startTime: row.startedTime.value,
      endTime: row.finishedTime.value,
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
 * Fuzzy match an OCR'd employee name to one of the active employees. Returns
 * the matched id or null. Case-insensitive; accepts a partial first-name +
 * last-initial style like "Glenn Sw" matching "Glenn Swinger".
 */
export function matchEmployee(name: string, employees: { id: string; name: string; active: boolean }[]): { id: string; name: string } | null {
  if (!name) return null;
  const q = name.toLowerCase().trim().replace(/\s+/g, " ");
  const active = employees.filter((e) => e.active);
  // exact
  const exact = active.find((e) => e.name.toLowerCase() === q);
  if (exact) return exact;
  // startsWith (first word + first chars of second)
  const parts = q.split(" ");
  const candidates = active.filter((e) => {
    const en = e.name.toLowerCase();
    return parts.every((p, i) => {
      const seg = en.split(" ")[i] ?? "";
      return seg.startsWith(p);
    });
  });
  if (candidates.length === 1) return candidates[0];
  // last-resort substring on full name
  const sub = active.filter((e) => e.name.toLowerCase().includes(q));
  if (sub.length === 1) return sub[0];
  return null;
}

/** Parse a YYYY-MM-DD string from the OCR header into a Date, or null. */
export function parseHeaderDate(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`); // noon UTC to avoid TZ drift
  return Number.isNaN(d.getTime()) ? null : d;
}
