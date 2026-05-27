import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Read-only config probe. No secret values are returned, only existence
// + safe-to-show derived values (allowed-email count, From address). Sits
// under the access prefix so unauthenticated readers can hit it during
// initial setup before any account is signed in.
export async function GET() {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  let dbOk = false;
  let userCount = 0;
  try {
    userCount = await prisma.user.count();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    deploy: {
      app_mode: process.env.APP_MODE ?? null,
      default_tenant_slug: process.env.DEFAULT_TENANT_SLUG ?? null,
      access_path_prefix: process.env.ACCESS_PATH_PREFIX ?? null,
      next_public_app_url: process.env.NEXT_PUBLIC_APP_URL ?? null,
      next_public_app_name: process.env.NEXT_PUBLIC_APP_NAME ?? null,
    },
    auth: {
      better_auth_secret_set: Boolean(process.env.BETTER_AUTH_SECRET),
      better_auth_url: process.env.BETTER_AUTH_URL ?? null,
      auth_mode: process.env.AUTH_MODE ?? null,
      allowed_emails_count: allowed.length,
      allowed_emails_redacted: allowed.map((e) => {
        const [u, d] = e.split("@");
        return `${u.slice(0, 2)}***@${d ?? ""}`;
      }),
    },
    email: {
      resend_api_key_set: Boolean(process.env.RESEND_API_KEY),
      default_from_email: process.env.DEFAULT_FROM_EMAIL ?? null,
    },
    ocr: {
      extractor: process.env.EXTRACTOR ?? null,
      anthropic_api_key_set: Boolean(process.env.ANTHROPIC_API_KEY),
      anthropic_model: process.env.ANTHROPIC_MODEL ?? null,
    },
    storage: {
      r2_account_id_set: Boolean(process.env.R2_ACCOUNT_ID),
      r2_access_key_id_set: Boolean(process.env.R2_ACCESS_KEY_ID),
      r2_secret_access_key_set: Boolean(process.env.R2_SECRET_ACCESS_KEY),
      r2_bucket: process.env.R2_BUCKET ?? null,
    },
    db: {
      database_url_set: Boolean(process.env.DATABASE_URL),
      reachable: dbOk,
      user_count: userCount,
    },
  });
}
