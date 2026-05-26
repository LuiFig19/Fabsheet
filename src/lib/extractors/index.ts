import { prisma } from "@/lib/db";
import { decryptSecret, sha256 } from "@/lib/crypto";
import { ClaudeVisionExtractor, compressForVision } from "./claude";
import { MockExtractor } from "./mock";
import { extractedTimesheetSchema, type ExtractedTimesheet, type TimesheetExtractor } from "./types";

const HARD_TIMEOUT_MS = 30_000;
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s. Try again, or contact support.`)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export type { ExtractedTimesheet, ExtractedRow, ExtractedHeader, TimesheetExtractor } from "./types";

// Sonnet pricing (USD per token). Used to estimate cost in the API usage view.
const COST_PER_INPUT_TOKEN = 3 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 15 / 1_000_000;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
}

/** Resolve the Anthropic key: env wins, then the encrypted Settings value. */
export async function resolveAnthropicKey(): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const company = await prisma.company.findFirst();
  return decryptSecret(company?.anthropicKeyEnc);
}

const model = () => process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

/**
 * Build the configured extractor. EXTRACTOR=mock forces the dev extractor;
 * anything else (default) uses Claude Vision. The UI never calls this; it goes
 * through runExtraction below so caching, the daily cap, and cost logging are
 * always applied.
 */
async function getExtractor(): Promise<TimesheetExtractor> {
  const choice = (process.env.EXTRACTOR ?? "claude").toLowerCase();
  if (choice === "mock") return new MockExtractor();
  const key = await resolveAnthropicKey();
  return new ClaudeVisionExtractor(key, model());
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type ExtractionOutcome = {
  result: ExtractedTimesheet;
  source: "cache" | "claude" | "mock";
  cappedFallback: boolean; // true if daily cap forced a mock fallback
};

/**
 * The orchestrated extraction path used by the upload action.
 *  1. Hash the file. If we already have a cached result for this exact image,
 *     return it (no second charge on a manager retry).
 *  2. Enforce the daily API cap. If exceeded, log it and fall back to mock so
 *     a runaway loop cannot burn money overnight.
 *  3. Run the configured extractor. Log token usage + estimated cost to
 *     AuditLog, and cache real results by hash.
 */
export async function runExtraction(file: Buffer, mimeType: string, tenantId?: string): Promise<ExtractionOutcome> {
  // Compress phone photos to a Vision-friendly size BEFORE hashing - saves
  // 3-8s per call and makes the cache key match what we actually send.
  const compressed = await compressForVision(file, mimeType);
  const hash = sha256(compressed.buffer);
  const usingMockEnv = (process.env.EXTRACTOR ?? "claude").toLowerCase() === "mock";

  // 1. cache (keyed by content hash of the compressed bytes)
  const cached = await prisma.ocrCache.findUnique({ where: { fileHash: hash } });
  if (cached) {
    const parsed = extractedTimesheetSchema.safeParse(cached.resultJson);
    if (parsed.success) return { result: parsed.data, source: "cache", cappedFallback: false };
  }

  // 2. daily cap, per tenant (only meaningful for real API calls)
  if (!usingMockEnv) {
    const company = tenantId
      ? await prisma.company.findFirst({ where: { tenantId } })
      : await prisma.company.findFirst();
    const envCap = Number(process.env.DAILY_OCR_CAP);
    const cap = company?.dailyApiCap ?? (Number.isFinite(envCap) ? envCap : 100);
    const callsToday = await prisma.auditLog.count({
      where: { action: "ocr_call", createdAt: { gte: startOfToday() }, ...(tenantId ? { tenantId } : {}) },
    });
    if (callsToday >= cap) {
      await prisma.auditLog.create({
        data: { tenantId, entityType: "Ocr", entityId: hash, action: "ocr_cap_block", after: { cap, callsToday } },
      });
      const mock = new MockExtractor();
      const result = await mock.extract(compressed.buffer, compressed.mimeType);
      return { result, source: "mock", cappedFallback: true };
    }
  }

  // 3. run with a hard 30s app-side timeout so the UI never hangs forever.
  const extractor = await getExtractor();
  const result = await withTimeout(extractor.extract(compressed.buffer, compressed.mimeType), HARD_TIMEOUT_MS, "Vision call");

  if (extractor.lastUsage) {
    const { inputTokens, outputTokens, model: usedModel } = extractor.lastUsage;
    await prisma.auditLog.create({
      data: {
        tenantId,
        entityType: "Ocr",
        entityId: hash,
        action: "ocr_call",
        inputTokens,
        outputTokens,
        costUsd: estimateCost(inputTokens, outputTokens),
        model: usedModel,
      },
    });
    // cache real results only
    await prisma.ocrCache.upsert({
      where: { fileHash: hash },
      create: { fileHash: hash, model: usedModel, resultJson: result },
      update: { resultJson: result, model: usedModel },
    });
  }

  return { result, source: extractor.name === "claude" ? "claude" : "mock", cappedFallback: false };
}
