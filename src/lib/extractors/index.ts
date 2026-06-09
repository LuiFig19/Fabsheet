import { prisma } from "@/lib/db";
import { getDrizzleDb } from "@/lib/drizzle/client";
import { auditLog, ocrCache } from "@/lib/drizzle/schema";
import { decryptSecret, sha256 } from "@/lib/crypto";
import { ClaudeVisionExtractor, compressForVision } from "./claude";
import { MockExtractor } from "./mock";
import { extractedTimesheetSchema, type ExtractedTimesheet, type TimesheetExtractor } from "./types";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// 45s gives a comfortable margin: typical Vision scans land 8-15s, the
// double-scan path runs in parallel so wall-clock stays at one scan, and the
// /upload Vercel function maxDuration is 60s. Single scans only have one
// retry, so this rarely waits the full window unless Anthropic is degraded.
const HARD_TIMEOUT_MS = 45_000;
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s. Try again, or contact support.`)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export type { ExtractedTimesheet, ExtractedRow, ExtractedHeader, TimesheetExtractor } from "./types";

type Price = { input: number; output: number };
const MODEL_PRICES: { match: RegExp; price: Price }[] = [
  { match: /haiku-4-5|haiku-4\.5/i, price: { input: 1 / 1_000_000, output: 5 / 1_000_000 } },
  { match: /sonnet/i, price: { input: 3 / 1_000_000, output: 15 / 1_000_000 } },
  { match: /opus-4\.[5-9]|opus-4-[5-9]|opus-4_[5-9]/i, price: { input: 5 / 1_000_000, output: 25 / 1_000_000 } },
  { match: /opus/i, price: { input: 15 / 1_000_000, output: 75 / 1_000_000 } },
];

function priceForModel(model: string): Price {
  return MODEL_PRICES.find((m) => m.match.test(model))?.price ?? MODEL_PRICES[1].price;
}

export function estimateCost(inputTokens: number, outputTokens: number, modelName = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"): number {
  const price = priceForModel(modelName);
  return inputTokens * price.input + outputTokens * price.output;
}

/** Resolve the Anthropic key: env wins, then the encrypted Settings value. */
export async function resolveAnthropicKey(): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const company = await prisma.company.findFirst();
  return decryptSecret(company?.anthropicKeyEnc);
}

const primaryModel = () => process.env.OCR_PRIMARY_MODEL ?? "claude-haiku-4-5-20251001";
const verificationModel = () => process.env.OCR_VERIFICATION_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

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
  // Adaptive verification is ON unless explicitly disabled. Clean sheets use
  // one fast Haiku pass; uncertain sheets get a second Sonnet pass and merge.
  const doubleScan = (process.env.OCR_DOUBLE_SCAN ?? "true").toLowerCase() !== "false";
  return new ClaudeVisionExtractor(key, primaryModel(), doubleScan, verificationModel());
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
  const drizzleDb = getDrizzleDb();
  const hash = sha256(compressed.buffer);
  const usingMockEnv = (process.env.EXTRACTOR ?? "claude").toLowerCase() === "mock";

  // 1. cache (keyed by content hash of the compressed bytes)
  const cached = await drizzleDb.query.ocrCache.findFirst({ where: eq(ocrCache.fileHash, hash) });
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
      await drizzleDb.insert(auditLog).values({
        id: randomUUID(),
        tenantId,
        entityType: "Ocr",
        entityId: hash,
        action: "ocr_cap_block",
        after: { cap, callsToday },
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
    await drizzleDb.insert(auditLog).values({
      id: randomUUID(),
      tenantId,
      entityType: "Ocr",
      entityId: hash,
      action: "ocr_call",
      inputTokens,
      outputTokens,
      costUsd: estimateCost(inputTokens, outputTokens, usedModel),
      model: usedModel,
    });
    // cache real results only
    const existing = await drizzleDb.query.ocrCache.findFirst({ where: eq(ocrCache.fileHash, hash), columns: { id: true } });
    if (existing) {
      await drizzleDb.update(ocrCache).set({ resultJson: result, model: usedModel }).where(eq(ocrCache.fileHash, hash));
    } else {
      await drizzleDb.insert(ocrCache).values({ id: randomUUID(), fileHash: hash, model: usedModel, resultJson: result });
    }
  }

  return { result, source: extractor.name === "claude" ? "claude" : "mock", cappedFallback: false };
}
