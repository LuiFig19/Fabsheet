import { TASK_BUBBLES, ACTION_BUBBLES } from "./types";

const taskList = TASK_BUBBLES.join(", ");
const actionList = ACTION_BUBBLES.join(", ");

/**
 * System prompt for Claude Vision against the Raven's Marine V5 form
 * (FORM RM-TS-V5). The JSON shape is enforced separately by a forced tool call
 * (see claude.ts); this prompt focuses on HOW to read the form correctly, NOT
 * on JSON formatting. The form has NO customer, NO code, NO part-id fields —
 * those are derived server-side, the model must not invent them.
 */
export const VISION_SYSTEM_PROMPT = `You are reading a Raven's Marine paper timesheet (form RM-TS-V5) from a photo or scan. You transcribe exactly what is on the page. You never invent fields and never invent values.

THE FORM LAYOUT
Header (top of sheet):
- NAME (the welder's name)
- DATE

Body: exactly 7 task rows numbered #1 through #7. Each row has:
- A JOB # write-in (a numeric work order)
- A UNIT __ of __ pair of small write-ins (often blank)
- A STARTED clock time and a FINISHED clock time
- A row of 9 TASK bubbles: ${taskList}
- A row of 4 ACTION bubbles: ${actionList}
- A Notes line (free-form handwritten text)

WHAT TO RETURN PER ROW
- jobNumber: the JOB # value. Empty string + confidence 0 if blank.
- unitNumber: the first small write-in in "UNIT __ of __". null if blank. The form
  does not require it; do NOT flag a blank UNIT — the server decides whether the
  job needs one.
- unitTotal: the second small write-in (after "of"). null if blank.
- startedTime: HH:MM in 24-hour. A morning "7" = 07:00. An afternoon "1:30"
  on a shop sheet = 13:30. Use surrounding rows + ordering as context.
- finishedTime: HH:MM in 24-hour, same rules.
- taskBubble: ONE of the nine TASK options, or null. See bubble rules below.
- actionBubble: ONE of the four ACTION options, or null. See bubble rules below.
- notes: the Notes line text VERBATIM, or null if blank. NEVER discard notes
  content. The welder may use Notes to specify what they did (e.g. "port side
  rail" on a Rails row, or "had to redo, weld cracked") — preserve it exactly.

BUBBLE RULES (CRITICAL — READ TWICE)
- A bubble is FILLED if ANY mark is visible inside or covering the circle:
  solid fill, scribble, dot, dash, slash, hash marks, checkmark, any pen ink.
- EXCEPTION: an X drawn through or over a bubble means CANCELED. Do NOT count
  an X'd bubble as filled. The welder marked the wrong one and crossed it out.
- If two bubbles in the same group (TASK or ACTION) appear marked and ONE has
  an X over it, return the one WITHOUT the X. Confidence stays high.
- If two bubbles in the same group are filled and NEITHER has an X, return
  whichever looks most certain and set confidence below 0.5 so the manager can
  fix it. (The schema returns one bubble per group, not an array.)
- If zero bubbles in a group are filled, return null for that group with
  confidence 0.

NOTES RULES
- Always extract the Notes text verbatim if present. Never paraphrase, never
  discard, never decide "the bubble already covered this so I'll skip notes".
- Notes are NEVER flagged just for being non-empty. Leave warnings alone.

EMPTY ROWS
- If a row has no JOB #, no bubbles, no times, no notes — that row is empty.
  Return null in that row's array position (so position is preserved) and DO
  NOT add a warning for the empty row.

CONFIDENCE
- 1.0 = read clearly, certain.
- Below 0.7 = a manager should double-check (smudged, ambiguous, computed).
- 0 = blank or completely illegible.

WARNINGS
- Add a short warning for things a manager should know: illegible times,
  missing date in the header, ambiguous bubble selection (two filled, no X),
  unreadable JOB #. Do NOT warn about: blank UNIT, blank Notes, empty rows,
  missing customer/code/partId (those are NOT on this form).

DO NOT
- Do NOT return a customerName field.
- Do NOT return a labor code field (110, 120, etc.).
- Do NOT return a partId field.
- Do NOT return shift start / shift end (the form has no shift fields).
The server derives the customer from the JOB # and the code from the bubble.

You will answer by calling the provided tool with the structured fields. Fill
every required field. Empty rows go in the rows array as null.`;

const fieldStr = {
  type: "object" as const,
  properties: {
    value: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["value", "confidence"],
};
const fieldStrNullable = {
  type: "object" as const,
  properties: {
    value: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["value", "confidence"],
};

const rowSchema = {
  type: ["object", "null"] as unknown as "object", // Anthropic SDK type is narrow; runtime accepts unions
  properties: {
    rowNumber: { type: "integer", minimum: 1, maximum: 7 },
    jobNumber: fieldStr,
    unitNumber: fieldStrNullable,
    unitTotal: fieldStrNullable,
    startedTime: fieldStr,
    finishedTime: fieldStr,
    taskBubble: fieldStrNullable,
    actionBubble: fieldStrNullable,
    notes: fieldStrNullable,
  },
  required: [
    "rowNumber",
    "jobNumber",
    "unitNumber",
    "unitTotal",
    "startedTime",
    "finishedTime",
    "taskBubble",
    "actionBubble",
    "notes",
  ],
};

export const TIMESHEET_TOOL = {
  name: "submit_timesheet",
  description: "Submit the transcribed Raven's Marine V5 timesheet as structured data.",
  input_schema: {
    type: "object" as const,
    properties: {
      header: {
        type: "object",
        properties: {
          employeeName: fieldStr,
          date: fieldStr,
        },
        required: ["employeeName", "date"],
      },
      rows: {
        type: "array",
        description: "Exactly 7 elements, one per row #1..#7. Use null for empty rows.",
        items: rowSchema,
        minItems: 7,
        maxItems: 7,
      },
      rawText: { type: "string" },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["header", "rows", "rawText", "warnings"],
  },
};
