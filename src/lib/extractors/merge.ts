import type { ExtractedRow, ExtractedTimesheet } from "./types";

/**
 * Reconcile two independent reads of the same sheet (the double-scan path).
 * Fields that agree get a small confidence boost; any disagreement is capped
 * well under the default 0.7 review threshold so it surfaces in Review. A row
 * only one pass saw is kept but treated as uncertain. Pure + dependency-free so
 * it can be unit-tested without the Vision SDK.
 */
const AGREE_BOOST = 0.05;
const DISAGREE_CAP = 0.49;

type Field = { value: string | null; confidence: number };

function norm(v: string | null | undefined): string {
  return (v ?? "").toString().trim().toLowerCase();
}

function mergeField<T extends Field>(a: T, b: T): T {
  if (norm(a.value) === norm(b.value)) {
    return { ...a, confidence: Math.min(1, Math.max(a.confidence, b.confidence) + AGREE_BOOST) };
  }
  const pick = a.confidence >= b.confidence ? a : b;
  return { ...pick, confidence: Math.min(pick.confidence, DISAGREE_CAP) };
}

function dampenField<T extends Field>(f: T): T {
  return { ...f, confidence: Math.min(f.confidence, DISAGREE_CAP) };
}

function mergeRow(a: ExtractedRow, b: ExtractedRow): ExtractedRow {
  return {
    rowNumber: a.rowNumber,
    jobNumber: mergeField(a.jobNumber, b.jobNumber),
    unitNumber: mergeField(a.unitNumber, b.unitNumber),
    unitTotal: mergeField(a.unitTotal, b.unitTotal),
    startedTime: mergeField(a.startedTime, b.startedTime),
    finishedTime: mergeField(a.finishedTime, b.finishedTime),
    taskBubble: mergeField(a.taskBubble, b.taskBubble),
    actionBubble: mergeField(a.actionBubble, b.actionBubble),
    notes: mergeField(a.notes, b.notes),
  };
}

function dampenRow(r: ExtractedRow): ExtractedRow {
  return {
    rowNumber: r.rowNumber,
    jobNumber: dampenField(r.jobNumber),
    unitNumber: dampenField(r.unitNumber),
    unitTotal: dampenField(r.unitTotal),
    startedTime: dampenField(r.startedTime),
    finishedTime: dampenField(r.finishedTime),
    taskBubble: dampenField(r.taskBubble),
    actionBubble: dampenField(r.actionBubble),
    notes: dampenField(r.notes),
  };
}

export function mergeScans(a: ExtractedTimesheet, b: ExtractedTimesheet): ExtractedTimesheet {
  const byNum = (rows: (ExtractedRow | null)[]) => {
    const m = new Map<number, ExtractedRow>();
    for (const r of rows) if (r) m.set(r.rowNumber, r);
    return m;
  };
  const am = byNum(a.rows);
  const bm = byNum(b.rows);

  const rows: (ExtractedRow | null)[] = [];
  for (let n = 1; n <= 7; n++) {
    const ar = am.get(n);
    const br = bm.get(n);
    if (ar && br) rows.push(mergeRow(ar, br));
    else if (ar || br) rows.push(dampenRow((ar ?? br)!)); // only one pass saw it
    else rows.push(null);
  }

  return {
    header: {
      employeeName: mergeField(a.header.employeeName, b.header.employeeName),
      date: mergeField(a.header.date, b.header.date),
    },
    rows,
    rawText: a.rawText.length >= b.rawText.length ? a.rawText : b.rawText,
    warnings: Array.from(new Set([...(a.warnings ?? []), ...(b.warnings ?? [])])),
  };
}
