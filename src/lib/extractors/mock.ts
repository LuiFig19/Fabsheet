import type { ExtractedTimesheet, ExtractorUsage, TimesheetExtractor } from "./types";

const f = (value: string, confidence: number) => ({ value, confidence });
const fn = (value: string | null, confidence: number) => ({ value, confidence });

/**
 * Dev-only extractor (EXTRACTOR=mock). Returns a realistic V5 sheet for Glenn
 * Swinger / WO 4354 with the imperfections a real photo produces, so the
 * Review UI has something to flag and the X-cancel logic gets exercised:
 *
 *  - Row 1: clean Frame row.
 *  - Row 2: an X over a Decking bubble — Rails is the real selection.
 *  - Row 3: a JOB # that does not exist in the Jobs table (manager must fix).
 *  - Row 4: blank UNIT on a multi-unit job (the server flags via UNIT logic).
 *  - Row 5: a Notes line with extra specifier text ("port side rail").
 *  - Row 6: pure Notes / "Other" work — no bubble filled.
 *  - Row 7: empty.
 */
export class MockExtractor implements TimesheetExtractor {
  readonly name = "mock";
  lastUsage: ExtractorUsage | null = null;

  async extract(_file: Buffer, _mimeType: string): Promise<ExtractedTimesheet> {
    await new Promise((r) => setTimeout(r, 600));
    this.lastUsage = null;

    return {
      header: {
        employeeName: f("Glenn Swinger", 0.92),
        date: f(new Date().toISOString().slice(0, 10), 0.9),
      },
      rows: [
        // Row 1 — clean frame work, single unit job.
        {
          rowNumber: 1,
          jobNumber: f("4354", 0.96),
          unitNumber: fn(null, 0),
          unitTotal: fn(null, 0),
          startedTime: f("07:00", 0.95),
          finishedTime: f("11:00", 0.95),
          taskBubble: fn("Frame", 0.94),
          actionBubble: fn(null, 0),
          notes: fn(null, 0),
        },
        // Row 2 — welder bubbled Decking then X'd it, real choice is Rails.
        {
          rowNumber: 2,
          jobNumber: f("4354", 0.92),
          unitNumber: fn(null, 0),
          unitTotal: fn(null, 0),
          startedTime: f("11:30", 0.9),
          finishedTime: f("13:30", 0.9),
          taskBubble: fn("Rails", 0.88), // X-cancel logic picked the non-X bubble
          actionBubble: fn(null, 0),
          notes: fn("port side rail", 0.86),
        },
        // Row 3 — JOB # that isn't in the jobs table (server will flag the WO).
        {
          rowNumber: 3,
          jobNumber: f("9999", 0.78),
          unitNumber: fn(null, 0),
          unitTotal: fn(null, 0),
          startedTime: f("13:30", 0.9),
          finishedTime: f("14:30", 0.9),
          taskBubble: fn("Tread", 0.85),
          actionBubble: fn(null, 0),
          notes: fn(null, 0),
        },
        // Row 4 — multi-unit job, welder left UNIT blank (server will flag).
        {
          rowNumber: 4,
          jobNumber: f("4571", 0.93),
          unitNumber: fn(null, 0),
          unitTotal: fn(null, 0),
          startedTime: f("14:30", 0.9),
          finishedTime: f("15:30", 0.9),
          taskBubble: fn("Frame", 0.9),
          actionBubble: fn(null, 0),
          notes: fn(null, 0),
        },
        // Row 5 — forklift action, notes describing what was moved.
        {
          rowNumber: 5,
          jobNumber: f("4354", 0.92),
          unitNumber: fn(null, 0),
          unitTotal: fn(null, 0),
          startedTime: f("15:30", 0.9),
          finishedTime: f("16:00", 0.9),
          taskBubble: fn(null, 0),
          actionBubble: fn("Forklift", 0.94),
          notes: fn("moved steel to bay 3", 0.82),
        },
        // Row 6 — "Other" work, no bubbles at all, notes carries the meaning.
        {
          rowNumber: 6,
          jobNumber: f("4354", 0.85),
          unitNumber: fn(null, 0),
          unitTotal: fn(null, 0),
          startedTime: f("16:00", 0.85),
          finishedTime: f("16:30", 0.85),
          taskBubble: fn(null, 0),
          actionBubble: fn(null, 0),
          notes: fn("cleaned up tools and area", 0.8),
        },
        // Row 7 — empty.
        null,
      ],
      rawText:
        "RAVEN'S MARINE V5\nNAME: Glenn Sw  DATE: today\n#1 4354  7:00-11:00  Frame\n#2 4354  11:30-13:30  Rails (Decking X'd)  notes: port side rail\n#3 9999  13:30-14:30  Tread\n#4 4571  14:30-15:30  Frame (no unit)\n#5 4354  15:30-16:00  Forklift  notes: moved steel to bay 3\n#6 4354  16:00-16:30  notes: cleaned up tools and area",
      warnings: [
        "Row 2: welder X'd one bubble, kept the other (Rails). Confirm.",
        "Row 4: multi-unit job — UNIT was left blank.",
      ],
    };
  }
}
