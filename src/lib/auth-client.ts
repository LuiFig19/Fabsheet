"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

/**
 * Derive the BetterAuth base URL at runtime from window.location so it always
 * matches the current origin + any access-prefix basePath the deploy uses.
 * This avoids the trap where NEXT_PUBLIC_APP_URL contains a path that
 * `new URL(path, base)` would discard, sending fetches to the unprefixed
 * endpoint (which 404s under Next.js basePath and surfaces as
 * "TypeError: Failed to fetch" due to missing CORS headers on the 404).
 */
function getBaseURL(): string {
  if (typeof window === "undefined") {
    // Server-side (used by server actions calling auth.api). Falls back to env.
    return process.env.NEXT_PUBLIC_APP_URL || "";
  }
  const origin = window.location.origin;
  // If the page is served under a /r/<token>/ basePath, include it. Otherwise
  // baseURL is just the origin.
  const m = /^(\/r\/[A-Za-z0-9_-]+)(?:\/|$)/.exec(window.location.pathname);
  return m ? origin + m[1] : origin;
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
