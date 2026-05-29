import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storageBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Health probe for uptime monitoring. 200 when all green, 503 if any
 * dependency is down. Checks DB connectivity, storage config, and whether the
 * OCR backend is configured. Does NOT call the Anthropic API (that costs
 * money) — it only verifies a key is present.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (e) {
    checks.database = { ok: false, detail: e instanceof Error ? e.message : "unreachable" };
  }

  // Storage
  checks.storage = { ok: true, detail: storageBackend() };

  // OCR backend configured (key present, not a live call)
  const ocrConfigured = (process.env.EXTRACTOR ?? "claude") === "mock" || Boolean(process.env.ANTHROPIC_API_KEY);
  checks.ocr = { ok: ocrConfigured, detail: ocrConfigured ? (process.env.EXTRACTOR ?? "claude") : "no ANTHROPIC_API_KEY" };

  // Email configured (not fatal — disk/console fallback exists)
  checks.email = { ok: true, detail: process.env.RESEND_API_KEY ? "resend" : "console-fallback" };

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), checks },
    { status: allOk ? 200 : 503 },
  );
}
