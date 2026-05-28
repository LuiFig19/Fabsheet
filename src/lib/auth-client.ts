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
  // App is served at the domain root now (no access prefix). Use the live
  // origin in the browser; fall back to env on the server.
  if (typeof window === "undefined") {
    return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/r\/[A-Za-z0-9_-]+$/, "");
  }
  return window.location.origin;
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
