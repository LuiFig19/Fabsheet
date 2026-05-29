import { describe, it, expect } from "vitest";
import { mergeScans } from "./merge";
import type { ExtractedRow, ExtractedTimesheet } from "./types";

const fstr = (value: string, confidence: number) => ({ value, confidence });
const fnull = (value: string | null, confidence: number) => ({ value, confidence });

function row(n: number, over: Partial<ExtractedRow> = {}): ExtractedRow {
  return {
    rowNumber: n,
    jobNumber: fstr("4354", 0.9),
    unitNumber: fnull(null, 0.9),
    unitTotal: fnull(null, 0.9),
    startedTime: fstr("07:00", 0.9),
    finishedTime: fstr("11:00", 0.9),
    taskBubble: fnull("Frame", 0.9),
    actionBubble: fnull(null, 0.9),
    notes: fnull(null, 0.9),
    ...over,
  };
}

function sheet(over: Partial<ExtractedTimesheet> = {}): ExtractedTimesheet {
  return {
    header: { employeeName: fstr("Glenn", 0.8), date: fstr("2026-05-27", 0.8) },
    rows: [row(1)],
    rawText: "",
    warnings: [],
    ...over,
  };
}

describe("mergeScans (double-scan reconciliation)", () => {
  it("boosts confidence when both passes agree", () => {
    const a = sheet({ header: { employeeName: fstr("Glenn", 0.6), date: fstr("2026-05-27", 0.6) } });
    const b = sheet({ header: { employeeName: fstr("Glenn", 0.7), date: fstr("2026-05-27", 0.5) } });
    const m = mergeScans(a, b);
    expect(m.header.employeeName.value).toBe("Glenn");
    expect(m.header.employeeName.confidence).toBeCloseTo(0.75); // max(0.6,0.7)+0.05
  });

  it("agreement is case/space insensitive and never exceeds 1", () => {
    const a = sheet({ header: { employeeName: fstr("  Glenn ", 0.99), date: fstr("2026-05-27", 0.9) } });
    const b = sheet({ header: { employeeName: fstr("glenn", 0.99), date: fstr("2026-05-27", 0.9) } });
    const m = mergeScans(a, b);
    expect(m.header.employeeName.confidence).toBeLessThanOrEqual(1);
    expect(m.header.employeeName.confidence).toBeGreaterThan(0.9);
  });

  it("on disagreement keeps the higher-confidence value but caps confidence for review", () => {
    const a = sheet({
      header: { employeeName: fstr("Glenn", 0.9), date: fstr("2026-05-27", 0.9) },
      rows: [row(1, { jobNumber: fstr("4354", 0.9) })],
    });
    const b = sheet({
      header: { employeeName: fstr("Glen", 0.6), date: fstr("2026-05-27", 0.9) },
      rows: [row(1, { jobNumber: fstr("4355", 0.6) })],
    });
    const m = mergeScans(a, b);
    expect(m.header.employeeName.value).toBe("Glenn"); // higher confidence wins
    expect(m.header.employeeName.confidence).toBeLessThanOrEqual(0.49); // flagged
    expect(m.rows[0]?.jobNumber.value).toBe("4354");
    expect(m.rows[0]?.jobNumber.confidence).toBeLessThanOrEqual(0.49);
  });

  it("keeps a row only one pass saw, but marks it uncertain", () => {
    const a = sheet({ rows: [row(1), row(2)] });
    const b = sheet({ rows: [row(1)] });
    const m = mergeScans(a, b);
    expect(m.rows).toHaveLength(7);
    expect(m.rows[1]).not.toBeNull();
    expect(m.rows[1]?.jobNumber.confidence).toBeLessThanOrEqual(0.49);
    expect(m.rows[2]).toBeNull();
  });

  it("always returns exactly 7 row slots", () => {
    const m = mergeScans(sheet(), sheet());
    expect(m.rows).toHaveLength(7);
  });
});
