import { promises as fs } from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Image storage abstraction. Uses Cloudflare R2 (S3-compatible) when configured,
// otherwise falls back to local disk under /uploads (dev). Browser never gets
// R2 credentials; all puts happen server-side.

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

let _client: S3Client | null = null;
function r2(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

export type StoredObject = {
  backend: "r2" | "disk";
  key: string; // R2 object key, or disk filename
  url: string | null; // public URL if R2_PUBLIC_URL set, else null (use signed)
};

/**
 * Persist an uploaded image. The object key is derived from the upload id so
 * retrieval is deterministic, scoped by tenant for isolation.
 */
export async function putUpload(
  tenantSlug: string,
  uploadId: string,
  filename: string,
  body: Buffer,
  contentType: string,
): Promise<StoredObject> {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `tenants/${tenantSlug}/uploads/${uploadId}-${safe}`;

  if (r2Configured()) {
    await r2().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    return { backend: "r2", key, url: base ? `${base}/${key}` : null };
  }

  // disk fallback (dev)
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const diskName = `${uploadId}-${safe}`;
  await fs.writeFile(path.join(UPLOAD_DIR, diskName), body);
  return { backend: "disk", key: diskName, url: null };
}

/**
 * Resolve a viewable URL for a stored object. R2 with a public base returns the
 * public URL; R2 without one returns a short-lived signed URL; disk returns the
 * local API path.
 */
export async function getUploadUrl(obj: { storageKey?: string | null; filePath: string; storageUrl?: string | null }): Promise<string> {
  if (obj.storageUrl) return obj.storageUrl;
  if (r2Configured() && obj.storageKey) {
    return getSignedUrl(
      r2(),
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: obj.storageKey }),
      { expiresIn: 3600 },
    );
  }
  // disk
  return `/api/uploads/${encodeURIComponent(obj.filePath)}`;
}

export function storageBackend(): "r2" | "disk" {
  return r2Configured() ? "r2" : "disk";
}
