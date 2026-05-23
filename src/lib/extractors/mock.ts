import type { ExtractedTimesheet, ExtractorUsage, TimesheetExtractor } from "./types";

const f = (value: string, confidence: number) => ({ value, confidence });
const n = (value: number, confidence: number) => ({ value, confidence });

/**
 * Dev-only extractor. Activated with EXTRACTOR=mock so local development and
 * dev-server restarts never spend Anthropic credits. Returns a realistic
 * Glenn Swinger / WO 4354 sheet with deliberate imperfections:
 *  - one ambiguous work order (4354 vs 4364, low confidence)
 *  - one smudged/low-confidence labor code
 *  - one illegible description (the row that needs manager confirmation)
 *  - one fully blank trailing row
 */
export class MockExtractor implements TimesheetExtractor {
  readonly name = "mock";
  lastUsage: ExtractorUsage | null = null;

  async extract(_file: Buffer, _mimeType: string): Promise<ExtractedTimesheet> {
    await new Promise((r) => setTimeout(r, 700));
    this.lastUsage = null; // no API cost

    return {
      header: {
        employeeName: f("Glenn Swinger", 0.82),
        workOrder: f("4354", 0.9),
        customerName: f("RCCL RB1", 0.78),
        shiftStart: f("07:00", 0.95),
        shiftEnd: f("16:00", 0.95),
        date: f("", 0), // no clear date on the sheet
      },
      rows: [
        {
          workOrder: f("4354", 0.96),
          customerName: f("RCCL RB1", 0.9),
          partId: f("FR-100", 0.85),
          description: f("Frame", 0.94),
          code: f("110 Weld/Fab", 0.93),
          startTime: f("07:00", 0.95),
          endTime: f("11:00", 0.95),
          decimalHours: n(4.0, 0.7),
        },
        {
          workOrder: f("4364", 0.41), // ambiguous: 4354 vs 4364
          customerName: f("RCCL RB1", 0.7),
          partId: f("", 0),
          description: f("Decking", 0.8),
          code: f("140 Labor Decking", 0.86),
          startTime: f("11:30", 0.92),
          endTime: f("13:30", 0.92),
          decimalHours: n(2.0, 0.7),
        },
        {
          workOrder: f("4354", 0.9),
          customerName: f("RCCL RB1", 0.88),
          partId: f("RL-12", 0.8),
          description: f("Rails", 0.72),
          code: f("110 Weld/Fab", 0.38), // smudged code
          startTime: f("13:30", 0.9),
          endTime: f("15:00", 0.9),
          decimalHours: n(1.5, 0.7),
        },
        {
          workOrder: f("4354", 0.6),
          customerName: f("", 0),
          partId: f("", 0),
          description: f("", 0.2), // illegible, needs confirmation
          code: f("", 0.25),
          startTime: f("15:00", 0.7),
          endTime: f("16:00", 0.7),
          decimalHours: n(1.0, 0.6),
        },
      ],
      rawText:
        "RAVEN'S MARINE TIME\nNAME: Glenn Sw\nWO# 4354  CUST: RCCL RB1\nSHIFT 7:00-4:00\n7-11 4354 Frame 110 FR-100\n11:30-1:30 43?4 Decking 140\n1:30-3 4354 Rails 11? RL-12\n3-4 4354 ____ ___",
      warnings: [
        "Row 2 work order is ambiguous (4354 vs 4364). Confirm before approving.",
        "Row 3 labor code is smudged (read as 110, low confidence).",
        "Row 4 description and code are illegible. Manager confirmation required.",
        "No date found in header.",
      ],
    };
  }
}
