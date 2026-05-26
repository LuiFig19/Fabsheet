import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import {
  extractedTimesheetSchema,
  type ExtractedTimesheet,
  type ExtractorUsage,
  type TimesheetExtractor,
} from "./types";
import { VISION_SYSTEM_PROMPT, TIMESHEET_TOOL } from "./claudeVisionPrompt";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function normalizeMime(mimeType: string): string {
  return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
}

/**
 * Compress an uploaded image before sending to Claude Vision. Vision's useful
 * resolution caps around 1568px on the long edge — bigger images add seconds
 * of upload + processing without improving accuracy on handwriting. A typical
 * 4000x3000 phone photo (~5 MB) becomes ~250 KB at quality 85.
 *
 * PDFs and unknown types pass through untouched.
 */
export async function compressForVision(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const mt = normalizeMime(mimeType);
  if (!IMAGE_TYPES.has(mt) && mt !== "image/jpg") return { buffer, mimeType };
  try {
    const out = await sharp(buffer)
      .rotate() // honor EXIF orientation so portraits don't come in sideways
      .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { buffer: out, mimeType: "image/jpeg" };
  } catch {
    // If sharp can't decode it (rare HEIC etc), send the original and let Claude try.
    return { buffer, mimeType: mt };
  }
}

/**
 * Production OCR for the V5 form. Calls Anthropic's vision API with the form
 * structure in the system prompt, FORCES a tool call so the response is
 * always structurally valid JSON, validates with Zod, retries once with the
 * error fed back, and gives up with a clear error if the model still can't
 * comply.
 *
 * PDFs are sent as a native document block (Claude reads PDFs directly — no
 * local rasterization). Images are sent as image blocks. All images are
 * pre-compressed by compressForVision().
 */
export class ClaudeVisionExtractor implements TimesheetExtractor {
  readonly name = "claude";
  lastUsage: ExtractorUsage | null = null;

  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set. Add it in Settings to enable Claude Vision OCR.");
    }
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  private buildSource(file: Buffer, mimeType: string): Record<string, unknown> {
    const mt = normalizeMime(mimeType);
    const data = file.toString("base64");
    if (mt === "application/pdf") {
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
    }
    if (IMAGE_TYPES.has(mt)) {
      return { type: "image", source: { type: "base64", media_type: mt as "image/jpeg", data } };
    }
    return { type: "image", source: { type: "base64", media_type: "image/jpeg", data } };
  }

  async extract(file: Buffer, mimeType: string): Promise<ExtractedTimesheet> {
    const source = this.buildSource(file, mimeType);

    const baseUserContent = [
      source,
      {
        type: "text",
        text: "Read this Raven's Marine V5 timesheet. Call submit_timesheet with all 7 row slots (use null for blank rows) and a confidence on every field.",
      },
    ] as unknown as Anthropic.MessageParam["content"];

    let lastError = "";
    let inputTokens = 0;
    let outputTokens = 0;

    for (let attempt = 0; attempt < 2; attempt++) {
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: baseUserContent }];
      if (attempt > 0) {
        messages.push({
          role: "user",
          content: `Your previous tool input failed validation: ${lastError}. Call submit_timesheet again with corrected, schema-valid values. Remember the rows array must have exactly 7 entries (null for blank rows).`,
        });
      }

      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: VISION_SYSTEM_PROMPT,
        tools: [TIMESHEET_TOOL as unknown as Anthropic.Tool],
        tool_choice: { type: "tool", name: TIMESHEET_TOOL.name },
        messages,
      });

      inputTokens += resp.usage.input_tokens;
      outputTokens += resp.usage.output_tokens;
      this.lastUsage = { inputTokens, outputTokens, model: this.model };

      const toolUse = resp.content.find((b) => b.type === "tool_use" && b.name === TIMESHEET_TOOL.name);
      if (!toolUse || toolUse.type !== "tool_use") {
        lastError = "Model did not return a submit_timesheet tool call.";
        continue;
      }

      const parsed = extractedTimesheetSchema.safeParse(toolUse.input);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }

    throw new Error(`Claude Vision returned data that did not match the V5 schema after a retry. ${lastError}`);
  }
}
