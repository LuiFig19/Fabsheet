const DEFAULT_ALLOWED_EMAILS = [
  "luifig19@gmail.com",
  "jeremiah@fanaticnode.com",
  "ravensmusic9@gmail.com",
];

const DEFAULT_OWNER_EMAILS = [
  "luifig19@gmail.com",
  "jeremiah@fanaticnode.com",
];

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function configuredEmails(envValue: string | undefined, defaults: string[]): string[] {
  return Array.from(
    new Set([
      ...defaults,
      ...(envValue ?? "")
        .split(/[\s,;]+/)
        .map(normalizeEmail)
        .filter(Boolean),
    ]),
  );
}

export function allowedEmails(): string[] {
  return configuredEmails(process.env.ALLOWED_EMAILS, DEFAULT_ALLOWED_EMAILS);
}

export function ownerEmails(): string[] {
  return configuredEmails(process.env.OWNER_EMAILS, DEFAULT_OWNER_EMAILS);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if ((process.env.AUTH_MODE ?? "allowlist") !== "allowlist") return true;
  return allowedEmails().includes(normalizeEmail(email));
}

export async function isSignInEmailAllowed(email: string | null | undefined): Promise<boolean> {
  const clean = normalizeEmail(email);
  if (!clean) return false;
  if (isAllowedEmail(clean)) return true;
  if ((process.env.AUTH_MODE ?? "allowlist") !== "allowlist") return true;

  const { prisma } = await import("@/lib/db");
  const user = await prisma.user.findUnique({ where: { email: clean }, select: { active: true } });
  let invite: { id: string } | null = null;
  try {
    invite = await prisma.tenantInvite.findFirst({ where: { email: clean, active: true }, select: { id: true } });
  } catch {
    invite = null;
  }
  return Boolean(user?.active || invite);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return ownerEmails().includes(normalizeEmail(email));
}
