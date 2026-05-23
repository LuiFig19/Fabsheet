import Anthropic from "@anthropic-ai/sdk";
import {
  extractedTimesheetSchema,
  type ExtractedTimesheet,
  type ExtractorUsage,
  type TimesheetExtractor,
} from "./types";
import { VISION_SYSTEM_PROMPT, TIMESHEET_TOOL } from "./claudeVisionPrompt";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function normalizeMime(mimeType: string): string {
  if (mimeType === "image/jpg") return "image/jpeg";
  return mimeType;
}

/**
 * Production OCR. Calls Anthropic's vision API with the form structure and
 * valid enums in the system prompt, and FORCES a tool call so the response is
 * always structurally valid JSON. The result is then validated with Zod; on
 * failure it retries once with the error fed back, then gives up with a clear
 * error so the upload action can offer "try again or enter manually".
 *
 * Note on PDFs: rather than rasterizing page 1 locally (native canvas/gm deps,
 * fragile on Windows), PDFs are sent to Claude as a native document block.
 * Claude reads multi-page PDFs directly. Images are sent as image blocks.
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

  // Return type kept loose: the content-block param union and PDF "document"
  // support vary across Anthropic SDK minor versions. The wire shapes below are
  // what the API expects; the SDK passes them through.
  private buildSource(file: Buffer, mimeType: string): Record<string, unknown> {
    const mt = normalizeMime(mimeType);
    const data = file.toString("base64");
    if (mt === "application/pdf") {
      return {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      };
    }
    if (IMAGE_TYPES.has(mt)) {
      return {
        type: "image",
        source: { type: "base64", media_type: mt as "image/jpeg", data },
      };
    }
    // Default to JPEG if the browser sent an odd type for a photo.
    return { type: "image", source: { type: "base64", media_type: "image/jpeg", data } };
  }

  async extract(file: Buffer, mimeType: string): Promise<ExtractedTimesheet> {
    const source = this.buildSource(file, mimeType);

    const baseUserContent = [
      source,
      {
        type: "text",
        text: "Transcribe this Raven's Marine timesheet. Call submit_timesheet with every field filled and a confidence on each.",
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
          content: `Your previous tool input failed validation: ${lastError}. Call submit_timesheet again with corrected, schema-valid values.`,
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

      const toolUse = resp.content.find(
        (b) => b.type === "tool_use" && b.name === TIMESHEET_TOOL.name,
      );
      if (!toolUse || toolUse.type !== "tool_use") {
        lastError = "Model did not return a submit_timesheet tool call.";
        continue;
      }

      const parsed = extractedTimesheetSchema.safeParse(toolUse.input);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }

    throw new Error(`Claude Vision returned data that did not match the timesheet schema after a retry. ${lastError}`);
  }
}
