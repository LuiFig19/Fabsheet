import { z } from "zod";

// Every extracted value carries a confidence 0..1. The UI never reads text to
// decide what is uncertain; it reads these numbers.
export const fieldStr = z.object({
  value: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0),
});
export const fieldStrNullable = z.object({
  value: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
});

// V5 form: header has only NAME and DATE. No customer / WO / shift on the header.
export const extractedHeaderSchema = z.object({
  employeeName: fieldStr,
  date: fieldStr, // YYYY-MM-DD
});

/**
 * One row on the V5 timesheet. The form has 7 rows; empty rows are returned as
 * null in the rows[] array so the welder's position is preserved.
 *
 * The form has NO customer / labor code / part id fields - those are derived
 * on the server from `jobNumber` (via Jobs table) and the bubble selection
 * (via TASK_TO_CODE mapping). The vision model must not invent them.
 */
export const extractedRowSchema = z.object({
  rowNumber: z.number().int().min(1).max(7),
  jobNumber: fieldStr,
  unitNumber: fieldStrNullable,
  unitTotal: fieldStrNullable,
  startedTime: fieldStr, // HH:MM (24h)
  finishedTime: fieldStr, // HH:MM (24h)
  taskBubble: fieldStrNullable, // one of: Frame, Decking, Rails, ADA, Tread, 5th W, Splice, Pickets, Mesh
  actionBubble: fieldStrNullable, // one of: Rework, Forklift, Cutting, Machine Repair
  notes: fieldStrNullable,
});

export const extractedTimesheetSchema = z.object({
  header: extractedHeaderSchema,
  // Each slot is either a row object or null (= row was blank on the form).
  rows: z.array(extractedRowSchema.nullable()),
  rawText: z.string().default(""),
  warnings: z.array(z.string()).default([]),
});

export type FieldStr = z.infer<typeof fieldStr>;
export type FieldStrNullable = z.infer<typeof fieldStrNullable>;
export type ExtractedHeader = z.infer<typeof extractedHeaderSchema>;
export type ExtractedRow = z.infer<typeof extractedRowSchema>;
export type ExtractedTimesheet = z.infer<typeof extractedTimesheetSchema>;

/** The exact bubble strings the vision model is allowed to return. */
export const TASK_BUBBLES = ["Frame", "Decking", "Rails", "ADA", "Tread", "5th W", "Splice", "Pickets", "Mesh"] as const;
export const ACTION_BUBBLES = ["Rework", "Forklift", "Cutting", "Machine Repair"] as const;
export type TaskBubble = (typeof TASK_BUBBLES)[number];
export type ActionBubble = (typeof ACTION_BUBBLES)[number];

export type ExtractorUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
};

// The ONLY contract between the app and any OCR backend.
export interface TimesheetExtractor {
  readonly name: string;
  extract(file: Buffer, mimeType: string): Promise<ExtractedTimesheet>;
  // Set after extract(). null for backends with no API cost (mock, cache).
  lastUsage: ExtractorUsage | null;
}
