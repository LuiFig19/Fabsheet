import { z } from "zod";

// Every extracted value carries a confidence 0..1. The UI never reads text to
// decide what is uncertain; it reads these numbers.
export const fieldStr = z.object({
  value: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0),
});
export const fieldNum = z.object({
  value: z.number().default(0),
  confidence: z.number().min(0).max(1).default(0),
});

export const extractedHeaderSchema = z.object({
  employeeName: fieldStr,
  workOrder: fieldStr,
  customerName: fieldStr,
  shiftStart: fieldStr, // HH:MM
  shiftEnd: fieldStr, // HH:MM
  date: fieldStr, // YYYY-MM-DD
});

export const extractedRowSchema = z.object({
  workOrder: fieldStr,
  customerName: fieldStr,
  partId: fieldStr,
  description: fieldStr, // one of the 9 options or empty
  code: fieldStr, // one of the 17 codes or empty
  startTime: fieldStr, // HH:MM
  endTime: fieldStr, // HH:MM
  decimalHours: fieldNum,
});

export const extractedTimesheetSchema = z.object({
  header: extractedHeaderSchema,
  rows: z.array(extractedRowSchema),
  rawText: z.string().default(""),
  warnings: z.array(z.string()).default([]),
});

export type FieldStr = z.infer<typeof fieldStr>;
export type FieldNum = z.infer<typeof fieldNum>;
export type ExtractedHeader = z.infer<typeof extractedHeaderSchema>;
export type ExtractedRow = z.infer<typeof extractedRowSchema>;
export type ExtractedTimesheet = z.infer<typeof extractedTimesheetSchema>;

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
