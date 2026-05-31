/**
 * Two-tier warning model for timesheet review.
 *
 *  - "warn" = a real review flag. The sheet stays in needs_review until a
 *    human acts on it, and bulk-approve refuses to auto-approve it.
 *  - "info" = a soft heads-up. Shown in the UI in a lighter style, never
 *    forces needs_review and never blocks bulk-approve.
 *
 * Stored in the upload's Json `warnings` column. Legacy data is plain
 * strings (treated as severity="warn" for backward compatibility).
 */
export type Warning = { kind: "warn" | "info"; text: string };

export type RawWarning = string | Warning;

export function toWarning(raw: RawWarning): Warning {
  if (typeof raw === "string") return { kind: "warn", text: raw };
  return { kind: raw.kind === "info" ? "info" : "warn", text: raw.text };
}

/** Normalize a mixed array (any combination of strings and objects). */
export function toWarnings(raw: unknown): Warning[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      if (typeof w === "string") return { kind: "warn", text: w } as Warning;
      if (w && typeof w === "object" && "text" in w) {
        const obj = w as { kind?: unknown; text?: unknown };
        const kind = obj.kind === "info" ? "info" : "warn";
        const text = typeof obj.text === "string" ? obj.text : "";
        return text ? ({ kind, text } as Warning) : null;
      }
      return null;
    })
    .filter((w): w is Warning => w !== null);
}

export function hardWarnings(raw: unknown): Warning[] {
  return toWarnings(raw).filter((w) => w.kind === "warn");
}

export function softWarnings(raw: unknown): Warning[] {
  return toWarnings(raw).filter((w) => w.kind === "info");
}

export const warn = (text: string): Warning => ({ kind: "warn", text });
export const info = (text: string): Warning => ({ kind: "info", text });
