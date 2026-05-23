import crypto from "crypto";

// AES-256-GCM at rest for API keys stored in the DB via Settings. The key is
// derived from APP_SECRET (set this in production). Env-provided API keys take
// precedence over stored ones, so this only matters when keys are typed into
// the Settings screen.
const SECRET = process.env.APP_SECRET ?? "ravens-marine-dev-secret-change-me";
const KEY = crypto.createHash("sha256").update(SECRET).digest(); // 32 bytes

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(blob: string | null | undefined): string {
  if (!blob) return "";
  try {
    const [ivB, tagB, encB] = blob.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "********";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
