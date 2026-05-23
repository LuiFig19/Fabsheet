import { LABOR_CODES, TASK_DESCRIPTIONS } from "@/lib/domain";

const codeLines = LABOR_CODES.map((c) => `  ${c.code}  ${c.description}`).join("\n");
const descLine = TASK_DESCRIPTIONS.join(", ");

/**
 * System prompt for Claude Vision. Describes the exact Raven's Marine paper
 * form, the valid enums, and the confidence semantics. The JSON SHAPE is
 * enforced separately by a forced tool call (see claude.ts), so this prompt
 * focuses on HOW to read the form, not on JSON formatting.
 */
export const VISION_SYSTEM_PROMPT = `You read photos and scans of a single, fixed paper timesheet used by Raven's Marine, a metal fabrication shop. You transcribe exactly what is written. You never invent data.

THE FORM LAYOUT
Header fields (top of sheet):
- NAME (the welder)
- WORK ORDER # (a top-level WO that may also be written per row)
- CUSTOMER NAME (top-level, may also be per row)
- SHIFT START (clock time)
- SHIFT END (clock time)
- DATE

Body: up to 9 task rows. Each row has:
- WORK ORDER #
- CUSTOMER NAME
- PART ID
- DESCRIPTION: the worker circles ONE of these nine: ${descLine}
- CODE: the worker writes one of the labor codes below
- TIME: a start time, an end time, and decimal hours

VALID LABOR CODES (code then meaning). The CODE field should be one of these:
${codeLines}

VALID DESCRIPTIONS (the worker circles one): ${descLine}

READING RULES
- Transcribe only what is visible. If a row is blank, return empty strings with confidence 0. Do not fill blank rows with guesses.
- Times: normalize to 24-hour HH:MM. A morning "7" with no colon means 07:00; an afternoon "1:30" likely means 13:30 in a shop day. Use the shift times and surrounding rows as context, but do not invent times that are not written.
- decimalHours: if the worker wrote a decimal hours value, transcribe it. If only start and end are written, compute end minus start as decimal hours and lower the confidence to about 0.7 to signal it was computed, not read.
- DESCRIPTION: snap to the closest of the nine valid options if it is clearly one of them. If it is illegible or not one of the nine, return the raw text you see (or empty) and set a low confidence.
- CODE: return the numeric code, optionally with its meaning. If illegible, return what you can and set low confidence.
- date: format YYYY-MM-DD. If no date is visible, empty string, confidence 0, and add a warning.

CONFIDENCE
- Set confidence between 0 and 1 for EVERY field.
- 1.0 means you read it clearly and are certain.
- Below 0.7 means the manager should double check (smudged, ambiguous, computed, or snapped to an enum you are unsure about).
- 0 means blank or completely illegible.

WARNINGS
- Add a short human-readable warning for anything a manager should know: illegible fields, missing date, ambiguous work order numbers, a code that is not in the valid list, etc.

You will return your answer by calling the provided tool with the structured fields. Fill every field. Do not include commentary outside the tool call.`;

/** JSON Schema for the forced tool call. Mirrors ExtractedTimesheet. */
const field = (valueType: "string" | "number") => ({
  type: "object",
  properties: {
    value: { type: valueType },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["value", "confidence"],
});

export const TIMESHEET_TOOL = {
  name: "submit_timesheet",
  description: "Submit the transcribed Raven's Marine timesheet as structured data.",
  input_schema: {
    type: "object" as const,
    properties: {
      header: {
        type: "object",
        properties: {
          employeeName: field("string"),
          workOrder: field("string"),
          customerName: field("string"),
          shiftStart: field("string"),
          shiftEnd: field("string"),
          date: field("string"),
        },
        required: ["employeeName", "workOrder", "customerName", "shiftStart", "shiftEnd", "date"],
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            workOrder: field("string"),
            customerName: field("string"),
            partId: field("string"),
            description: field("string"),
            code: field("string"),
            startTime: field("string"),
            endTime: field("string"),
            decimalHours: field("number"),
          },
          required: ["workOrder", "customerName", "partId", "description", "code", "startTime", "endTime", "decimalHours"],
        },
      },
      rawText: { type: "string" },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["header", "rows", "rawText", "warnings"],
  },
};
