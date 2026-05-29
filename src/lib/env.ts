import { z } from "zod";

/**
 * Validate environment at module load. Import `env` from here instead of
 * reading process.env directly, so a missing/invalid var fails loudly at boot
 * rather than surfacing as a confusing `undefined` deep in a request.
 *
 * Only variables the app actually depends on are listed. Optional integrations
 * (R2, Resend) are `.optional()` so local dev runs on the disk/console
 * fallbacks without ceremony.
 */
const schema = z.object({
  // Core
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid Postgres URL"),
  APP_MODE: z.enum(["single_tenant", "multi_tenant"]).default("single_tenant"),
  DEFAULT_TENANT_SLUG: z.string().min(1).default("ravens"),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be >= 16 chars"),
  BETTER_AUTH_URL: z.string().url().optional(),
  AUTH_MODE: z.enum(["allowlist", "open"]).default("allowlist"),
  ALLOWED_EMAILS: z.string().optional(),
  AUTH_DISABLED: z.enum(["true", "false"]).optional(),

  // OCR
  EXTRACTOR: z.enum(["claude", "mock"]).default("claude"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  DAILY_OCR_CAP: z.coerce.number().int().positive().default(100),
  // Read each sheet twice and reconcile for accuracy. ON by default; set
  // "false" to halve Vision cost at the expense of accuracy.
  OCR_DOUBLE_SCAN: z.enum(["true", "false"]).default("true"),

  // Storage (optional; disk fallback when absent)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional().or(z.literal("")),

  // Email (optional; "would send" console fallback when absent)
  RESEND_API_KEY: z.string().optional(),
  DEFAULT_FROM_EMAIL: z.string().optional(),

  // Cron
  CRON_SECRET: z.string().optional(),

  // Public
  NEXT_PUBLIC_APP_NAME: z.string().default("FabSheet"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    // Surfaces at server boot / build, not mid-request.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();

/** Whether the OCR backend should be the real Claude Vision call. */
export const usingClaude = env.EXTRACTOR === "claude";
