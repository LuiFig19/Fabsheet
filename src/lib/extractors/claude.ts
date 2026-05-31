import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import {
  extractedTimesheetSchema,
  type ExtractedTimesheet,
  type ExtractorUsage,
  type TimesheetExtractor,
} from "./types";
import { mergeScans } from "./merge";
import { VISION_SYSTEM_PROMPT, TIMESHEET_TOOL } from "./claudeVisionPrompt";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function normalizeMime(mimeType: string): string {
  return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
}

/**
 * Compress an uploaded image before sending to Claude Vision. Vision's useful
 * resolution caps around 1568px on the long edge - bigger images add seconds
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
 * PDFs are sent as a native document block (Claude reads PDFs directly - no
 * local rasterization). Images are sent as image blocks. All images are
 * pre-compressed by compressForVision().
 */
export class ClaudeVisionExtractor implements TimesheetExtractor {
  readonly name = "claude";
  lastUsage: ExtractorUsage | null = null;

  private client: Anthropic;
  private model: string;
  private doubleScan: boolean;

  constructor(apiKey: string, model: string, doubleScan = true) {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set. Add it in Settings to enable Claude Vision OCR.");
    }
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.doubleScan = doubleScan;
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

  /**
   * Public entry point. With double-scan enabled (default) the same image is
   * read twice in independent calls and the two readings are reconciled: fields
   * that agree get a small confidence boost, fields that disagree are kept at a
   * low confidence so the Review screen flags them for a human. This catches
   * the handwriting the model is genuinely unsure about instead of silently
   * trusting one pass. If the second pass errors we fall back to the first.
   */
  async extract(file: Buffer, mimeType: string): Promise<ExtractedTimesheet> {
    if (!this.doubleScan) {
      const only = await this.scanOnce(file, mimeType);
      this.lastUsage = { inputTokens: only.inputTokens, outputTokens: only.outputTokens, model: this.model };
      return only.result;
    }

    // CRITICAL: parallel, not sequential. With two ~10-15s Vision calls in
    // series we used to blow past the 30s upload timeout; in parallel the
    // wall-clock is max(t1, t2) instead of t1+t2 so the upload completes in
    // about the same time as a single-scan extract.
    const [r1, r2] = await Promise.allSettled([
      this.scanOnce(file, mimeType),
      this.scanOnce(file, mimeType),
    ]);

    const first = r1.status === "fulfilled" ? r1.value : null;
    const second = r2.status === "fulfilled" ? r2.value : null;

    if (first && second) {
      this.lastUsage = {
        inputTokens: first.inputTokens + second.inputTokens,
        outputTokens: first.outputTokens + second.outputTokens,
        model: this.model,
      };
      return mergeScans(first.result, second.result);
    }
    const only = first ?? second;
    if (!only) {
      const err = r1.status === "rejected" ? r1.reason : r2.status === "rejected" ? r2.reason : new Error("OCR failed");
      throw err instanceof Error ? err : new Error(String(err));
    }
    this.lastUsage = { inputTokens: only.inputTokens, outputTokens: only.outputTokens, model: this.model };
    return only.result;
  }

  /** One full read (with the existing single-retry-on-invalid-schema loop). */
  private async scanOnce(file: Buffer, mimeType: string): Promise<ScanResult> {
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

      const toolUse = resp.content.find((b) => b.type === "tool_use" && b.name === TIMESHEET_TOOL.name);
      if (!toolUse || toolUse.type !== "tool_use") {
        lastError = "Model did not return a submit_timesheet tool call.";
        continue;
      }

      const parsed = extractedTimesheetSchema.safeParse(toolUse.input);
      if (parsed.success) return { result: parsed.data, inputTokens, outputTokens };
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }

    throw new Error(`Claude Vision returned data that did not match the V5 schema after a retry. ${lastError}`);
  }
}

type ScanResult = { result: ExtractedTimesheet; inputTokens: number; outputTokens: number };
